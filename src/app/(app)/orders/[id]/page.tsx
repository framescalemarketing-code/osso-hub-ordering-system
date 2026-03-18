import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import OrderActions from '@/components/OrderActions';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const employee = await getCurrentEmployee();

  const { data: order } = await supabase
    .from('orders')
    .select('*, customer:customers(*), employee:employees(first_name, last_name), program:programs(company_name, invoice_terms), prescription:prescriptions(*), items:order_items(*), approvals:approvals(*)')
    .eq('id', id)
    .single();

  if (!order) notFound();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/orders" className="text-sm text-gray-400 hover:text-white">← Orders</Link>
          <h1 className="text-2xl font-bold mt-1">{order.order_number}</h1>
        </div>
        <OrderActions order={order} employeeRole={employee?.role || 'readonly'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                order.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                order.status === 'pending_approval' ? 'bg-yellow-900/30 text-yellow-400' :
                order.status === 'cancelled' ? 'bg-red-900/30 text-red-400' :
                'bg-blue-900/30 text-blue-400'
              }`}>{order.status.replace(/_/g, ' ')}</span>
              <span className="capitalize text-sm text-gray-400">{order.order_type} order</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-gray-400">Subtotal</p><p className="font-medium">${Number(order.subtotal).toFixed(2)}</p></div>
              <div><p className="text-gray-400">Tax</p><p className="font-medium">${Number(order.tax).toFixed(2)}</p></div>
              <div><p className="text-gray-400">Discount</p><p className="font-medium">${Number(order.discount).toFixed(2)}</p></div>
              <div><p className="text-gray-400">Total</p><p className="text-xl font-bold">${Number(order.total).toFixed(2)}</p></div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Items</h2>
            <div className="space-y-3">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div>
                    <p className="font-medium">{item.frame_brand} {item.frame_model}</p>
                    <p className="text-sm text-gray-400 capitalize">{item.glasses_type?.replace(/_/g, ' ')} · {item.lens_type} · {item.lens_material}</p>
                    {item.lens_vendor && <p className="text-xs text-blue-400 mt-1">Lens vendor: {item.lens_vendor} {item.lens_order_id ? `#${item.lens_order_id}` : ''}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${Number(item.line_total).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Approvals */}
          {order.approvals && order.approvals.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Approvals</h2>
              <div className="space-y-2">
                {order.approvals.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg text-sm">
                    <span>{a.approver_email}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      a.status === 'approved' ? 'bg-green-900/30 text-green-400' :
                      a.status === 'rejected' ? 'bg-red-900/30 text-red-400' :
                      'bg-yellow-900/30 text-yellow-400'
                    }`}>{a.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Customer</h3>
            <p className="font-medium">{order.customer?.first_name} {order.customer?.last_name}</p>
            <p className="text-sm text-gray-400">{order.customer?.email}</p>
            <p className="text-sm text-gray-400">{order.customer?.phone}</p>
          </div>

          {order.program && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Program</h3>
              <p className="font-medium">{order.program.company_name}</p>
              {order.program.invoice_terms && <p className="text-sm text-gray-400">Terms: {order.program.invoice_terms}</p>}
            </div>
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Created by</span><span>{order.employee?.first_name} {order.employee?.last_name}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Created</span><span>{new Date(order.created_at).toLocaleString()}</span></div>
              {order.invoice_number && <div className="flex justify-between"><span className="text-gray-400">Invoice</span><span>{order.invoice_number}</span></div>}
              {order.clickup_task_id && <div className="flex justify-between"><span className="text-gray-400">ClickUp</span><span className="text-blue-400">{order.clickup_task_id}</span></div>}
              {order.tracking_number && <div className="flex justify-between"><span className="text-gray-400">Tracking</span><span>{order.tracking_number}</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
