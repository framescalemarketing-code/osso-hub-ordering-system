import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { orderLensFromVendor } from '@/lib/integrations/lens-vendors';
import type { Order, OrderItem, Customer, Prescription } from '@/lib/types';

type LensOrder = Order & {
  customer?: Pick<Customer, 'first_name' | 'last_name'>;
  prescription?: Prescription | null;
  items?: OrderItem[];
};

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
  const typedOrder = order as LensOrder | null;

  if (!typedOrder) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const results = [];
  for (const item of (typedOrder.items || [])) {
    if (!item.lens_vendor || item.lens_vendor === 'other') continue;

    try {
      const result = await orderLensFromVendor({
        orderItem: item,
        prescription: typedOrder.prescription || {},
        patientName: `${typedOrder.customer?.first_name || ''} ${typedOrder.customer?.last_name || ''}`.trim(),
        orderNumber: typedOrder.order_number,
      });

      if (result) {
        await serviceClient.from('order_items').update({
          lens_order_id: result.vendorOrderId,
          lens_order_status: 'ordered',
          lens_ordered_at: new Date().toISOString(),
        }).eq('id', item.id);
        results.push({ item_id: item.id, vendor_order_id: result.vendorOrderId });
      }
    } catch (err: unknown) {
      results.push({ item_id: item.id, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  // Update order status
  await serviceClient.from('orders').update({ status: 'lens_ordered' }).eq('id', id);

  return NextResponse.json({ results });
}
