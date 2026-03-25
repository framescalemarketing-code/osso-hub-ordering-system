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

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
        <Link href="/orders/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition">+ New Order</Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'draft', 'pending_approval', 'approved', 'processing', 'lens_ordered', 'completed', 'cancelled'].map(s => (
          <Link
            key={s}
            href={`/orders${s === 'all' ? '' : `?status=${s}`}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              (s === 'all' && !params.status) || params.status === s
                ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.replace(/_/g, ' ')}
          </Link>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="text-left px-4 py-3">Order #</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Employee</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {typedOrders?.map(order => (
                <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline font-medium">{order.order_number}</Link>
                  </td>
                  <td className="px-4 py-3">{order.customer?.first_name} {order.customer?.last_name}</td>
                  <td className="px-4 py-3 capitalize">{order.order_type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      order.status === 'completed' ? 'bg-green-100 text-green-700' :
                      order.status === 'pending_approval' ? 'bg-amber-100 text-amber-700' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      'bg-blue-100 text-blue-700'
                    }`}>{order.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-right">${Number(order.total).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500">{order.employee?.first_name} {order.employee?.last_name}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(order.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!typedOrders || typedOrders.length === 0) && (
          <div className="px-4 py-12 text-center text-gray-400">No orders found</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 justify-center mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <Link
              key={p}
              href={`/orders?page=${p}${params.status ? `&status=${params.status}` : ''}`}
              className={`w-8 h-8 flex items-center justify-center rounded ${p === page ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} text-sm`}
            >{p}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
