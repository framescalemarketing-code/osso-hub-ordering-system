import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { integrations } from '@/lib/integrations/config';
import type { Customer, Order, OrderItem, Program } from '@/lib/types';

type InvoiceOrder = Order & {
  customer?: Customer | null;
  program?: Program | null;
  items?: OrderItem[];
};

// Generate and send invoice for an order
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { order_id } = await request.json();
  if (!order_id) return NextResponse.json({ error: 'order_id required' }, { status: 400 });

  const serviceClient = createServiceClient();

  // Get full order
  const { data: order } = await serviceClient
    .from('orders')
    .select('*, customer:customers(*), items:order_items(*), program:programs(*)')
    .eq('id', order_id)
    .single();
  const typedOrder = order as InvoiceOrder | null;

  if (!typedOrder) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Generate invoice number
  const invoiceNumber = `INV-${typedOrder.order_number.replace('OSSO-', '')}`;

  // Build invoice HTML
  const invoiceHtml = buildInvoiceHtml(typedOrder, invoiceNumber);

  // Determine recipient
  const recipientEmail = typedOrder.order_type === 'program' && typedOrder.program?.contact_email
    ? typedOrder.program.contact_email
    : typedOrder.customer?.email;

  if (!recipientEmail) {
    return NextResponse.json({ error: 'No email address for invoice recipient' }, { status: 400 });
  }

  // Send via Resend
  if (integrations.resend.enabled()) {
    const { Resend } = await import('resend');
    const resend = new Resend(integrations.resend.apiKey());

    await resend.emails.send({
      from: integrations.resend.from(),
      to: recipientEmail,
      subject: `Invoice ${invoiceNumber} - OSSO Order ${order.order_number}`,
      html: invoiceHtml,
    });
  }

  // Update order
  await serviceClient.from('orders').update({
    invoice_number: invoiceNumber,
    invoice_sent_at: new Date().toISOString(),
  }).eq('id', order_id);

  return NextResponse.json({ invoice_number: invoiceNumber, sent_to: recipientEmail });
}

function buildInvoiceHtml(order: InvoiceOrder, invoiceNumber: string): string {
  const items = (order.items || []).map(item => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${item.frame_brand || ''} ${item.frame_model || ''} - ${(item.glasses_type || '').replace(/_/g, ' ')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${Number(item.line_total).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family:system-ui;max-width:600px;margin:0 auto;color:#333">
      <h1 style="color:#111">Invoice ${invoiceNumber}</h1>
      <p><strong>Order:</strong> ${order.order_number}</p>
      <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
      <p><strong>Customer:</strong> ${order.customer?.first_name} ${order.customer?.last_name}</p>
      ${order.program ? `<p><strong>Company:</strong> ${order.program.company_name}</p>` : ''}
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px;text-align:left">Item</th>
            <th style="padding:8px;text-align:center">Qty</th>
            <th style="padding:8px;text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>${items}</tbody>
      </table>
      <div style="text-align:right;margin-top:12px">
        <p>Subtotal: $${Number(order.subtotal).toFixed(2)}</p>
        <p>Tax: $${Number(order.tax).toFixed(2)}</p>
        ${Number(order.discount) > 0 ? `<p>Discount: -$${Number(order.discount).toFixed(2)}</p>` : ''}
        <p style="font-size:1.2em;font-weight:bold">Total: $${Number(order.total).toFixed(2)}</p>
      </div>
      ${order.program?.invoice_terms ? `<p style="margin-top:20px;color:#666">Terms: ${order.program.invoice_terms}</p>` : ''}
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
      <p style="color:#999;font-size:12px">OSSO Hub - On-Sight Safety Optics</p>
    </div>
  `;
}

