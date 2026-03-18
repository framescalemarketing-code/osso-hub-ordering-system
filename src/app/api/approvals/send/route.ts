import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { integrations } from '@/lib/integrations/config';

// Send approval request emails
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { order_id } = body;
  if (!order_id) return NextResponse.json({ error: 'order_id required' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: approvals } = await supabase
    .from('approvals')
    .select('*, order:orders(order_number, total, order_type, customer:customers(first_name, last_name), program:programs(company_name))')
    .eq('order_id', order_id)
    .eq('status', 'pending');

  if (!approvals?.length) return NextResponse.json({ message: 'No pending approvals' });

  if (!integrations.resend.enabled()) {
    return NextResponse.json({ message: 'Email not configured, approvals created but not emailed' });
  }

  const { Resend } = await import('resend');
  const resend = new Resend(integrations.resend.apiKey());
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  for (const approval of approvals) {
    const order = approval.order;
    const approveUrl = `${appUrl}/approve?token=${approval.token}&action=approve`;
    const rejectUrl = `${appUrl}/approve?token=${approval.token}&action=reject`;

    await resend.emails.send({
      from: integrations.resend.from(),
      to: approval.approver_email,
      subject: `Approval Needed: Order ${order.order_number} — ${order.program?.company_name || 'Program Order'}`,
      html: `
        <h2>Order Approval Request</h2>
        <p>A new order requires your approval:</p>
        <table style="border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:4px 12px;font-weight:bold">Order</td><td style="padding:4px 12px">${order.order_number}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold">Employee</td><td style="padding:4px 12px">${order.customer?.first_name} ${order.customer?.last_name}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold">Company</td><td style="padding:4px 12px">${order.program?.company_name || 'N/A'}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold">Total</td><td style="padding:4px 12px">$${Number(order.total).toFixed(2)}</td></tr>
        </table>
        <p>
          <a href="${approveUrl}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:white;text-decoration:none;border-radius:8px;margin-right:8px">Approve</a>
          <a href="${rejectUrl}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:white;text-decoration:none;border-radius:8px">Reject</a>
        </p>
      `,
    });
  }

  return NextResponse.json({ message: `Sent ${approvals.length} approval requests` });
}
