import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { orderLensFromVendor } from '@/lib/integrations/lens-vendors';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceClient = createServiceClient();

  const { data: order } = await serviceClient
    .from('orders')
    .select('*, customer:customers(first_name, last_name), prescription:prescriptions(*), items:order_items(*)')
    .eq('id', id)
    .single();

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const results = [];
  for (const item of (order.items || [])) {
    if (!item.lens_vendor || item.lens_vendor === 'other') continue;

    try {
      const result = await orderLensFromVendor({
        orderItem: item,
        prescription: order.prescription || {},
        patientName: `${order.customer.first_name} ${order.customer.last_name}`,
        orderNumber: order.order_number,
      });

      if (result) {
        await serviceClient.from('order_items').update({
          lens_order_id: result.vendorOrderId,
          lens_order_status: 'ordered',
          lens_ordered_at: new Date().toISOString(),
        }).eq('id', item.id);
        results.push({ item_id: item.id, vendor_order_id: result.vendorOrderId });
      }
    } catch (err: any) {
      results.push({ item_id: item.id, error: err.message });
    }
  }

  // Update order status
  await serviceClient.from('orders').update({ status: 'lens_ordered' }).eq('id', id);

  return NextResponse.json({ results });
}
