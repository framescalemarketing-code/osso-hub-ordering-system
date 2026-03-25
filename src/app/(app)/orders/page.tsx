import { createServerSupabaseClient } from '@/lib/supabase/server';
import Link from 'next/link';
import type { Customer, Employee, Order } from '@/lib/types';

type OrderListRow = Order & {
  customer?: Pick<Customer, 'first_name' | 'last_name'> | null;
  employee?: Pick<Employee, 'first_name' | 'last_name'> | null;
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string; type?: string }> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const page = parseInt(params.page || '1');
  const limit = 20;

  let query = supabase
    .from('orders')
    .select('*, customer:customers(first_name, last_name), employee:employees(first_name, last_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (params.status) query = query.eq('status', params.status);
  if (params.type) query = query.eq('order_type', params.type);

  const { data: orders, count } = await query;
  const typedOrders = orders as OrderListRow[] | null;
  const totalPages = Math.ceil((count || 0) / limit);

  function statusClass(status: string) {
    if (status === 'completed') return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    if (status === 'pending_approval') return 'bg-amber-50 text-amber-800 border border-amber-200';
    if (status === 'cancelled') return 'bg-rose-50 text-rose-700 border border-rose-200';
    return 'bg-[#f6efe3] text-[#5a4322] border border-[#d6c09b]';
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2a1f12]">Orders</h1>
        <Link href="/orders/new" className="pos-btn-primary">+ New Order</Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'draft', 'pending_approval', 'approved', 'processing', 'lens_ordered', 'completed', 'cancelled'].map(s => (
          <Link
            key={s}
            href={`/orders${s === 'all' ? '' : `?status=${s}`}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
              (s === 'all' && !params.status) || params.status === s
                ? 'bg-linear-to-r from-[#8f6d3f] to-[#725326] text-white shadow-[0_10px_20px_rgba(77,54,24,0.2)]'
                : 'border border-[#ccb089] bg-white/80 text-[#5a4428] hover:bg-white'
            }`}
          >
            {s.replace(/_/g, ' ')}
          </Link>
        ))}
      </div>

      <div className="pos-panel-strong overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-215 text-sm">
            <thead>
              <tr className="border-b border-[#e4d4ba] text-xs uppercase tracking-wide text-[#7d6541]">
                <th className="px-4 py-3 text-left">Order #</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {typedOrders?.map(order => (
                <tr key={order.id} className="border-b border-[#f1e5d3] hover:bg-[#fffcf7]">
                  <td className="px-4 py-3">
                    <Link href={`/orders/${order.id}`} className="font-semibold text-[#6f522d] hover:text-[#47331b]">{order.order_number}</Link>
                  </td>
                  <td className="px-4 py-3">{order.customer?.first_name} {order.customer?.last_name}</td>
                  <td className="px-4 py-3 capitalize">{order.order_type}</td>
                  <td className="px-4 py-3">
                    <span className={`pos-badge ${statusClass(order.status)}`}>{order.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[#3b2c1b]">${Number(order.total).toFixed(2)}</td>
                  <td className="px-4 py-3 text-[#705c40]">{order.employee?.first_name} {order.employee?.last_name}</td>
                  <td className="px-4 py-3 text-[#705c40]">{new Date(order.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!typedOrders || typedOrders.length === 0) && (
          <div className="px-4 py-12 text-center text-[#7b6340]">No orders found</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 justify-center mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <Link
              key={p}
              href={`/orders?page=${p}${params.status ? `&status=${params.status}` : ''}`}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                p === page
                  ? 'bg-linear-to-r from-[#8f6d3f] to-[#725326] text-white'
                  : 'border border-[#ccb089] bg-white/85 text-[#5a4428] hover:bg-white'
              }`}
            >{p}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
