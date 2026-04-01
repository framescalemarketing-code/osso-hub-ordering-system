import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { enqueueOrderIntegrationJobs } from '@/lib/integrations/job-queue';
import type { Order, OrderItem } from '@/lib/types';

async function triggerOrderJobProcessor(request: NextRequest, orderId: string) {
  const secret = process.env.JOB_RUNNER_SECRET;
  if (!secret) return;

  try {
    const res = await fetch(new URL('/api/jobs/process', request.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-job-secret': secret,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Job processor request failed: ${res.status} ${body}`);
    }
  } catch (err: unknown) {
    const serviceClient = createServiceClient();
    const message = err instanceof Error ? err.message : 'Failed to trigger order job processor';
    await serviceClient.from('sync_log').insert({
      integration: 'job_queue',
      record_type: 'order',
      record_id: orderId,
      status: 'failed',
      error_message: message,
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
    });
  }
}

type OrderInputItem = Partial<OrderItem> & {
  glasses_type: OrderItem['glasses_type'];
  quantity?: number;
};

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: employee } = await supabase.from('employees').select('id, role').eq('auth_user_id', user.id).single();
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 403 });

  const body = await request.json();
  const {
    order_type,
    customer_id,
    program_id,
    prescription_id,
    items,
    shipping_address,
    discount,
    requires_eligibility_review,
    eligibility_reason,
    intake_enrollment_id,
    program_guidelines_snapshot,
  } = body as {
    order_type: Order['order_type'];
    customer_id: string;
    program_id?: string | null;
    prescription_id?: string | null;
    items: OrderInputItem[];
    shipping_address?: Order['shipping_address'];
    discount?: number;
    requires_eligibility_review?: boolean;
    eligibility_reason?: string | null;
    intake_enrollment_id?: string | null;
    program_guidelines_snapshot?: string | null;
  };

  if (!customer_id || !items?.length) {
    return NextResponse.json({ error: 'Customer and items required' }, { status: 400 });
  }
  if (!order_type || !['regular', 'program'].includes(order_type)) {
    return NextResponse.json({ error: 'order_type must be regular or program' }, { status: 400 });
  }

  const subtotal = items.reduce((sum, i) => sum + (Number(i.line_total) || 0), 0);
  const requestedDiscount = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const normalizedDiscount = order_type === 'program' ? 0 : requestedDiscount;
  const taxableSubtotal = Math.max(subtotal - normalizedDiscount, 0);
  const tax = Math.round(taxableSubtotal * 0.0875 * 100) / 100;
  const total = taxableSubtotal + tax;

  let status = 'processing';
  let program: { approval_required?: boolean; approver_emails?: string[]; contact_email?: string | null } | null = null;
  if (order_type === 'program' && program_id) {
    const { data, error } = await supabase
      .from('programs')
      .select('approval_required, approver_emails, contact_email')
      .eq('id', program_id)
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    program = data;
    if (program.approval_required || requires_eligibility_review) status = 'pending_approval';
  }

  const approvalReason = requires_eligibility_review
    ? `Eligibility review required${eligibility_reason ? `: ${eligibility_reason}` : ''}`
    : null;

  const internalNotes = [
    approvalReason,
    intake_enrollment_id ? `Enrollment reference: ${intake_enrollment_id}` : null,
    program_guidelines_snapshot ? `Program guidelines snapshot: ${program_guidelines_snapshot}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_type,
      status,
      customer_id,
      employee_id: employee.id,
      program_id: program_id || null,
      prescription_id: prescription_id || null,
      subtotal,
      tax,
      discount: normalizedDiscount,
      total,
      shipping_address: shipping_address || null,
      internal_notes: internalNotes || null,
      customer_notes: approvalReason,
    })
    .select()
    .single();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  const orderItems = items.map((item) => ({
    order_id: order.id,
    glasses_type: item.glasses_type,
    frame_brand: item.frame_brand || null,
    frame_model: item.frame_model || null,
    frame_color: item.frame_color || null,
    frame_size: item.frame_size || null,
    frame_price: Number(item.frame_price) || 0,
    lens_type: item.lens_type || null,
    lens_material: item.lens_material || null,
    lens_coating: item.lens_coating || [],
    lens_tint: item.lens_tint || null,
    lens_price: Number(item.lens_price) || 0,
    lens_vendor: item.lens_vendor || null,
    quantity: Number(item.quantity) || 1,
    line_total: Number(item.line_total) || 0,
    notes: item.notes || null,
  }));

  const { data: savedItems, error: itemsError } = await supabase.from('order_items').insert(orderItems).select();
  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const customerResult = await supabase.from('customers').select('*').eq('id', customer_id).single();
  const customer = customerResult.data;

  if (customerResult.error) {
    return NextResponse.json({ error: customerResult.error.message }, { status: 500 });
  }

  if (status === 'pending_approval' && program_id) {
    const approverEmails = new Set<string>(program?.approver_emails || []);
    if (requires_eligibility_review && program?.contact_email) {
      approverEmails.add(program.contact_email);
    }

    if (approverEmails.size > 0) {
      const approvals = Array.from(approverEmails).map((email: string) => ({
        order_id: order.id,
        approver_email: email,
        requested_by: employee.id,
        notes: approvalReason,
      }));
      await supabase.from('approvals').insert(approvals);
    }
  }

  const serviceClient = createServiceClient();
  try {
    await enqueueOrderIntegrationJobs(serviceClient, order.id, customer || null);
    await triggerOrderJobProcessor(request, order.id);
  } catch (queueError: unknown) {
    const message = queueError instanceof Error ? queueError.message : 'Failed to enqueue integration jobs';
    await serviceClient.from('sync_log').insert({
      integration: 'job_queue',
      record_type: 'order',
      record_id: order.id,
      status: 'failed',
      error_message: message,
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
    });
  }

  if (
    status === 'pending_approval' &&
    program_id &&
    ((program?.approver_emails?.length || 0) > 0 || (requires_eligibility_review && !!program?.contact_email))
  ) {
    await fetch(new URL('/api/approvals/send', request.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: order.id }),
    });
  }

  return NextResponse.json({ order: { ...order, items: savedItems } }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const status = url.searchParams.get('status');
  const orderType = url.searchParams.get('order_type');

  let query = supabase
    .from('orders')
    .select('*, customer:customers(first_name, last_name, email), employee:employees(first_name, last_name)', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status) query = query.eq('status', status);
  if (orderType) query = query.eq('order_type', orderType);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orders: data, total: count, page, limit });
}
