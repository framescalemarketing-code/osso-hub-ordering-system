import { createServerSupabaseClient } from '@/lib/supabase/server';
import Link from 'next/link';
import type { Customer, Order } from '@/lib/types';

type DashboardOrder = Order & {
  customer?: Pick<Customer, 'first_name' | 'last_name'> | null;
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const [ordersRes, customersRes, pendingRes, todayRes] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
    supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().split('T')[0]),
  ]);

  const stats = [
    { label: 'Total Orders', value: ordersRes.count ?? 0, color: 'blue' },
    { label: 'Customers', value: customersRes.count ?? 0, color: 'green' },
    { label: 'Pending Approvals', value: pendingRes.count ?? 0, color: 'yellow' },
    { label: "Today's Orders", value: todayRes.count ?? 0, color: 'purple' },
  ];

  // Recent orders
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('id, order_number, order_type, status, total, created_at, customer:customers(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(10);
  const typedRecentOrders = recentOrders as DashboardOrder[] | null;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/orders/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition"
        >
          + New Order
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-sm text-gray-400">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-4 py-3">Order #</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {typedRecentOrders && typedRecentOrders.length > 0 ? (
                typedRecentOrders.map(order => (
                  <tr key={order.id} className="border-b border-gray-800/50 hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <Link href={`/orders/${order.id}`} className="text-blue-400 hover:underline">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {order.customer?.first_name} {order.customer?.last_name}
                    </td>
                    <td className="px-4 py-3 capitalize">{order.order_type}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        order.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                        order.status === 'pending_approval' ? 'bg-yellow-900/30 text-yellow-400' :
                        order.status === 'cancelled' ? 'bg-red-900/30 text-red-400' :
                        'bg-blue-900/30 text-blue-400'
                      }`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">${Number(order.total).toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No orders yet. <Link href="/orders/new" className="text-blue-400 hover:underline">Create your first order</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
