import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Public endpoint — approvers click links from email
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const action = url.searchParams.get('action');

  if (!token || !['approve', 'reject'].includes(action || '')) {
    return new NextResponse(renderHtml('Invalid Link', 'This approval link is invalid or has expired.'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const supabase = createServiceClient();

  // Find approval by token
  const { data: approval } = await supabase
    .from('approvals')
    .select('*, order:orders(order_number, total, status)')
    .eq('token', token)
    .single();

  if (!approval) {
    return new NextResponse(renderHtml('Not Found', 'This approval request was not found.'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (approval.status !== 'pending') {
    return new NextResponse(renderHtml('Already Processed', `This order was already ${approval.status}.`), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Update approval
  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  await supabase.from('approvals').update({
    status: newStatus,
    responded_at: new Date().toISOString(),
  }).eq('id', approval.id);

  // If approved, check if all approvals for this order are approved
  if (newStatus === 'approved') {
    const { data: allApprovals } = await supabase
      .from('approvals')
      .select('status')
      .eq('order_id', approval.order_id);

    const allApproved = allApprovals?.every((a: { status: string }) => a.status === 'approved');
    if (allApproved) {
      await supabase.from('orders').update({ status: 'approved' }).eq('id', approval.order_id);
    }
  } else {
    // Rejected — mark order as cancelled
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', approval.order_id);
  }

  const title = newStatus === 'approved' ? 'Approved ✓' : 'Rejected ✗';
  const msg = `Order ${approval.order.order_number} ($${Number(approval.order.total).toFixed(2)}) has been ${newStatus}.`;

  return new NextResponse(renderHtml(title, msg), {
    headers: { 'Content-Type': 'text/html' },
  });
}

function renderHtml(title: string, message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
  <style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a0a0a;color:white}
  .card{background:#111;border:1px solid #333;border-radius:16px;padding:48px;text-align:center;max-width:400px}
  h1{margin-bottom:12px}p{color:#999}</style></head>
  <body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}
