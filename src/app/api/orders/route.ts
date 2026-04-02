import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { calculateOrderPricing, deriveGlassesType } from '@/lib/orders/pricing';
import { syncToClickUp } from '@/lib/integrations/clickup';
import { syncToNetSuite } from '@/lib/integrations/netsuite';
import { syncToQuickBooks } from '@/lib/integrations/quickbooks';
import { syncToMailchimp } from '@/lib/integrations/mailchimp';
import { writeOrderToBigQuery } from '@/lib/integrations/bigquery';
import type { Customer, Order, OrderIntake, OrderItem, OrderPricingSummary } from '@/lib/types';

type OrderInputItem = Partial<OrderItem> & {
  glasses_type: OrderItem['glasses_type'];
  quantity?: number;
};

function splitFrameSelection(frameSelected: string) {
  const parts = frameSelected
    .split('|')
    .map(part => part.trim())
    .filter(Boolean);

  return {
    brand: parts[0] || null,
    model: parts.slice(1).join(' | ') || frameSelected || null,
  };
}

function buildItemFromIntake(intake: OrderIntake, summary: OrderPricingSummary): OrderInputItem {
  const frameInfo = splitFrameSelection(intake.product.frameSelected);

  return {
    glasses_type: deriveGlassesType(intake),
    frame_brand: frameInfo.brand,
    frame_model: frameInfo.model,
    frame_color: intake.product.tint || null,
    frame_size: intake.product.sideShieldClearanceCode || null,
    frame_price: Number(intake.product.framePrice) || 0,
    lens_type: intake.product.lensType || null,
    lens_material: intake.product.lensMaterial || null,
    lens_coating: intake.product.lensCoating ? [intake.product.lensCoating] : [],
    lens_tint: intake.product.tint || null,
    lens_price: Math.max(summary.totalFees - (Number(intake.product.framePrice) || 0), 0),
    lens_vendor: null,
    quantity: 1,
    line_total: summary.totalFees,
    notes: [intake.product.opticianNotes, intake.finance.notesToOps].filter(Boolean).join('\n') || null,
    configuration: intake.product,
    pricing_breakdown: summary.feeBreakdown,
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: employee } = await supabase.from('employees').select('id, role').eq('auth_user_id', user.id).single();
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 403 });

  const body = (await request.json()) as {
    order_type: Order['order_type'];
    customer_id: string;
    program_id?: string | null;
    prescription_id?: string | null;
    items?: OrderInputItem[];
    shipping_address?: Order['shipping_address'];
    intake?: OrderIntake;
  };

  const normalizedIntake = body.intake
    ? {
        ...body.intake,
        orderType: body.order_type,
        customerId: body.customer_id,
        prescriptionId: body.prescription_id || null,
      }
    : null;

  const backendSummary = normalizedIntake ? calculateOrderPricing(normalizedIntake) : null;
  const computedItems = normalizedIntake && backendSummary ? [buildItemFromIntake(normalizedIntake, backendSummary)] : body.items || [];

  if (!body.customer_id || computedItems.length === 0) {
    return NextResponse.json({ error: 'Customer and intake details are required' }, { status: 400 });
  }

  const subtotal = backendSummary
    ? backendSummary.totalFees
    : computedItems.reduce((sum, item) => sum + (Number(item.line_total) || 0), 0);
  const tax = 0;
  const discount = normalizedIntake ? Number(normalizedIntake.finance.discount) || 0 : 0;
  const total = backendSummary ? backendSummary.billTo + backendSummary.oopWithDiscount : subtotal;

  let status: Order['status'] = 'processing';
  if (normalizedIntake?.authorization.authRequested && normalizedIntake.authorization.authApprovalStatus !== 'approved') {
    status = 'pending_approval';
  } else if (body.order_type === 'program' && body.program_id) {
    const { data: program } = await supabase.from('programs').select('approval_required').eq('id', body.program_id).maybeSingle();
    if (program?.approval_required) {
      status = 'pending_approval';
    }
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_type: body.order_type,
      status,
      customer_id: body.customer_id,
      employee_id: employee.id,
      program_id: body.program_id || null,
      prescription_id: body.prescription_id || null,
      subtotal,
      tax,
      discount,
      total,
      shipping_address: body.shipping_address || null,
      internal_notes: normalizedIntake?.finance.notesToOps || null,
      customer_notes: normalizedIntake?.product.opticianNotes || null,
      intake_payload: normalizedIntake,
      pricing_summary: backendSummary,
      submitted_to_bill_at: normalizedIntake ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  const orderItems = computedItems.map(item => ({
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
    configuration: item.configuration || {},
    pricing_breakdown: item.pricing_breakdown || {},
  }));

  const { data: savedItems, error: itemsError } = await supabase.from('order_items').insert(orderItems).select();
  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const { data: customer } = await supabase.from('customers').select('*').eq('id', body.customer_id).single();

  if (status === 'pending_approval' && body.program_id) {
    const { data: program } = await supabase.from('programs').select('approver_emails').eq('id', body.program_id).single();
    if (program?.approver_emails?.length) {
      const approvals = program.approver_emails.map((email: string) => ({
        order_id: order.id,
        approver_email: email,
        requested_by: employee.id,
      }));
      await supabase.from('approvals').insert(approvals);

      await fetch(new URL('/api/approvals/send', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id }),
      });
    }
  }

  const fullOrder = {
    ...order,
    customer: customer as Customer,
    items: (savedItems || []) as OrderItem[],
  } as Order & { customer: Customer; items: OrderItem[] };
  const serviceClient = createServiceClient();

  async function logSync(integration: string, recordId: string, fn: () => Promise<string | null>) {
    try {
      const externalId = await fn();
      await serviceClient.from('sync_log').insert({
        integration,
        record_type: 'order',
        record_id: recordId,
        external_id: externalId,
        status: 'success',
        attempts: 1,
        last_attempt_at: new Date().toISOString(),
      });
      return externalId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown sync failure';
      await serviceClient.from('sync_log').insert({
        integration,
        record_type: 'order',
        record_id: recordId,
        status: 'failed',
        error_message: message,
        attempts: 1,
        last_attempt_at: new Date().toISOString(),
      });
      return null;
    }
  }

  const syncPromises = [
    logSync('clickup', order.id, () => syncToClickUp(fullOrder)),
    logSync('netsuite', order.id, () => syncToNetSuite(fullOrder)),
    logSync('quickbooks', order.id, () => syncToQuickBooks(fullOrder)),
    logSync('bigquery', order.id, () => writeOrderToBigQuery(fullOrder).then(() => null)),
  ];

  if (customer?.marketing_consent) {
    syncPromises.push(logSync('mailchimp', customer.id, () => syncToMailchimp(customer)));
  }

  Promise.allSettled(syncPromises).then(async results => {
    const updates: Partial<Pick<Order, 'clickup_task_id' | 'netsuite_id' | 'quickbooks_id'>> = {};
    const [clickup, netsuite, quickbooks] = results;
    if (clickup.status === 'fulfilled' && clickup.value) updates.clickup_task_id = clickup.value;
    if (netsuite.status === 'fulfilled' && netsuite.value) updates.netsuite_id = netsuite.value;
    if (quickbooks.status === 'fulfilled' && quickbooks.value) updates.quickbooks_id = quickbooks.value;
    if (Object.keys(updates).length) {
      await serviceClient.from('orders').update(updates).eq('id', order.id);
    }
  });

  return NextResponse.json({ order: { ...order, items: savedItems, pricing_summary: backendSummary } }, { status: 201 });
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
    .select('*, customer:customers(first_name, last_name, email), employee:employees(first_name, last_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status) query = query.eq('status', status);
  if (orderType) query = query.eq('order_type', orderType);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orders: data, total: count, page, limit });
}
