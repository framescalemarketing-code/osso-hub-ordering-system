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
    { label: 'Total Orders', value: ordersRes.count ?? 0, href: '/orders' },
    { label: 'Customers', value: customersRes.count ?? 0, href: '/customers' },
    { label: 'Pending Approvals', value: pendingRes.count ?? 0, href: '/orders?status=pending_approval' },
    { label: "Today's Orders", value: todayRes.count ?? 0, href: '/orders' },
  ];

  // Recent orders
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('id, order_number, order_type, status, total, created_at, customer:customers(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(10);
  const typedRecentOrders = recentOrders as DashboardOrder[] | null;

  function statusClass(status: string) {
    if (status === 'completed') return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    if (status === 'pending_approval') return 'bg-amber-50 text-amber-800 border border-amber-200';
    if (status === 'cancelled') return 'bg-rose-50 text-rose-700 border border-rose-200';
    return 'bg-[#f6efe3] text-[#5a4322] border border-[#d6c09b]';
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2a1f12]">Dashboard</h1>
        <Link
          href="/orders/new"
          className="pos-btn-primary"
        >
          + New Order
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <Link key={s.label} href={s.href} className="pos-panel block p-6 transition hover:border-[#ccb089] hover:bg-[#fffdf8]">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7b6340]">{s.label}</p>
            <p className="mt-2 text-3xl font-extrabold text-[#2a1f12]">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Link href="/eligibility" className="pos-panel p-5 transition hover:border-[#ccb089] hover:bg-[#fffdf8]">
          <h3 className="text-base font-bold text-[#2a1f12]">Eligibility Snapshot</h3>
          <p className="mt-1 text-sm text-[#6f5b40]">Open roster lookup and quickly add employees to customers.</p>
        </Link>
        <Link href="/programs" className="pos-panel p-5 transition hover:border-[#ccb089] hover:bg-[#fffdf8]">
          <h3 className="text-base font-bold text-[#2a1f12]">Company Snapshot</h3>
          <p className="mt-1 text-sm text-[#6f5b40]">Review company presets, guidelines, and approval settings.</p>
        </Link>
        <Link href="/search" className="pos-panel p-5 transition hover:border-[#ccb089] hover:bg-[#fffdf8]">
          <h3 className="text-base font-bold text-[#2a1f12]">Quick Find</h3>
          <p className="mt-1 text-sm text-[#6f5b40]">Jump to orders, customers, or companies from one search workspace.</p>
        </Link>
      </div>

      <div className="pos-panel-strong overflow-hidden">
        <div className="border-b border-[#d6c09b] px-5 py-4">
          <h2 className="text-lg font-bold text-[#2a1f12]">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[#e4d4ba] text-xs uppercase tracking-wide text-[#7d6541]">
                <th className="px-4 py-3 text-left">Order #</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {typedRecentOrders && typedRecentOrders.length > 0 ? (
                typedRecentOrders.map(order => (
                  <tr key={order.id} className="border-b border-[#f1e5d3] hover:bg-[#fffcf7]">
                    <td className="px-4 py-3">
                      <Link href={`/orders/${order.id}`} className="font-semibold text-[#6f522d] hover:text-[#47331b]">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {order.customer?.first_name} {order.customer?.last_name}
                    </td>
                    <td className="px-4 py-3 capitalize">{order.order_type}</td>
                    <td className="px-4 py-3">
                      <span className={`pos-badge ${statusClass(order.status)}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#3b2c1b]">${Number(order.total).toFixed(2)}</td>
                    <td className="px-4 py-3 text-[#705c40]">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#7b6340]">
                    No orders yet. <Link href="/orders/new" className="font-semibold text-[#6f522d] hover:underline">Create your first order</Link>
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
