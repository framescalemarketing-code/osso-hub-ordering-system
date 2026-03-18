import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { syncToClickUp } from '@/lib/integrations/clickup';
import { syncToNetSuite } from '@/lib/integrations/netsuite';
import { syncToQuickBooks } from '@/lib/integrations/quickbooks';
import { syncToMailchimp } from '@/lib/integrations/mailchimp';
import { writeOrderToBigQuery } from '@/lib/integrations/bigquery';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get employee
  const { data: employee } = await supabase.from('employees').select('id, role').eq('auth_user_id', user.id).single();
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 403 });

  const body = await request.json();
  const { order_type, customer_id, program_id, prescription_id, items, shipping_address } = body;

  if (!customer_id || !items?.length) {
    return NextResponse.json({ error: 'Customer and items required' }, { status: 400 });
  }

  // Calculate totals
  const subtotal = items.reduce((sum: number, i: any) => sum + (Number(i.line_total) || 0), 0);
  const tax = Math.round(subtotal * 0.0875 * 100) / 100;
  const total = subtotal + tax;

  // Determine initial status
  let status = 'processing';
  if (order_type === 'program' && program_id) {
    const { data: program } = await supabase.from('programs').select('approval_required').eq('id', program_id).single();
    if (program?.approval_required) status = 'pending_approval';
  }

  // Create order
  const { data: order, error: orderError } = await supabase.from('orders').insert({
    order_type,
    status,
    customer_id,
    employee_id: employee.id,
    program_id: program_id || null,
    prescription_id: prescription_id || null,
    subtotal, tax, discount: 0, total,
    shipping_address: shipping_address || null,
  }).select().single();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  // Insert order items
  const orderItems = items.map((item: any) => ({
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

  // Get full customer for integrations
  const { data: customer } = await supabase.from('customers').select('*').eq('id', customer_id).single();

  // If program order needs approval, create approval request
  if (status === 'pending_approval' && program_id) {
    const { data: program } = await supabase.from('programs').select('approver_emails').eq('id', program_id).single();
    if (program?.approver_emails?.length) {
      const approvals = program.approver_emails.map((email: string) => ({
        order_id: order.id,
        approver_email: email,
        requested_by: employee.id,
      }));
      await supabase.from('approvals').insert(approvals);

      // Send approval emails via API
      await fetch(new URL('/api/approvals/send', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id }),
      });
    }
  }

  // Fire-and-forget integrations (non-blocking)
  const fullOrder = { ...order, customer, items: savedItems || [] };
  const serviceClient = createServiceClient();

  async function logSync(integration: string, recordId: string, fn: () => Promise<string | null>) {
    try {
      const externalId = await fn();
      await serviceClient.from('sync_log').insert({
        integration, record_type: 'order', record_id: recordId,
        external_id: externalId, status: 'success', attempts: 1, last_attempt_at: new Date().toISOString(),
      });
      return externalId;
    } catch (err: any) {
      await serviceClient.from('sync_log').insert({
        integration, record_type: 'order', record_id: recordId,
        status: 'failed', error_message: err.message, attempts: 1, last_attempt_at: new Date().toISOString(),
      });
      return null;
    }
  }

  // Run integrations in parallel, non-blocking
  const syncPromises = [
    logSync('clickup', order.id, () => syncToClickUp(fullOrder)),
    logSync('netsuite', order.id, () => syncToNetSuite(fullOrder)),
    logSync('quickbooks', order.id, () => syncToQuickBooks(fullOrder)),
    logSync('bigquery', order.id, () => writeOrderToBigQuery(fullOrder).then(() => null)),
  ];

  if (customer?.marketing_consent) {
    syncPromises.push(logSync('mailchimp', customer.id, () => syncToMailchimp(customer)));
  }

  // Don't await — let them complete in the background
  Promise.allSettled(syncPromises).then(async (results) => {
    // Update order with external IDs
    const updates: any = {};
    const [clickup, netsuite, quickbooks] = results;
    if (clickup.status === 'fulfilled' && clickup.value) updates.clickup_task_id = clickup.value;
    if (netsuite.status === 'fulfilled' && netsuite.value) updates.netsuite_id = netsuite.value;
    if (quickbooks.status === 'fulfilled' && quickbooks.value) updates.quickbooks_id = quickbooks.value;
    if (Object.keys(updates).length) {
      await serviceClient.from('orders').update(updates).eq('id', order.id);
    }
  });

  return NextResponse.json({ order: { ...order, items: savedItems } }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
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
