import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Customer, Order, Reminder } from '@/lib/types';

type ReminderRow = Reminder & {
  customer?: Pick<Customer, 'first_name' | 'last_name'> | null;
  order?: Pick<Order, 'order_number'> | null;
};

export default async function RemindersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: reminders } = await supabase
    .from('reminders')
    .select('*, customer:customers(first_name, last_name), order:orders(order_number)')
    .order('due_at', { ascending: true })
    .limit(100);
  const typedReminders = reminders as ReminderRow[] | null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reminders &amp; Follow-ups</h1>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Subject</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Order</th>
                <th className="text-left px-4 py-3">Due</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {typedReminders?.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 capitalize">{r.reminder_type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">{r.subject}</td>
                  <td className="px-4 py-3 text-gray-500">{r.customer?.first_name} {r.customer?.last_name}</td>
                  <td className="px-4 py-3 text-gray-500">{r.order?.order_number || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(r.due_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      r.status === 'sent' ? 'bg-green-100 text-green-700' :
                      r.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      'bg-amber-100 text-amber-700'
                    }`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!typedReminders || typedReminders.length === 0) && (
          <div className="px-4 py-12 text-center text-gray-400">No reminders</div>
        )}
      </div>
    </div>
  );
}
