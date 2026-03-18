import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function RemindersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: reminders } = await supabase
    .from('reminders')
    .select('*, customer:customers(first_name, last_name), order:orders(order_number)')
    .order('due_at', { ascending: true })
    .limit(100);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reminders &amp; Follow-ups</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Subject</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Order</th>
              <th className="text-left px-4 py-3">Due</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {reminders?.map((r: any) => (
              <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/50">
                <td className="px-4 py-3 capitalize">{r.reminder_type.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3">{r.subject}</td>
                <td className="px-4 py-3 text-gray-400">{r.customer?.first_name} {r.customer?.last_name}</td>
                <td className="px-4 py-3 text-gray-400">{r.order?.order_number || '—'}</td>
                <td className="px-4 py-3 text-gray-400">{new Date(r.due_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    r.status === 'sent' ? 'bg-green-900/30 text-green-400' :
                    r.status === 'cancelled' ? 'bg-red-900/30 text-red-400' :
                    'bg-yellow-900/30 text-yellow-400'
                  }`}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!reminders || reminders.length === 0) && (
          <div className="px-4 py-12 text-center text-gray-500">No reminders</div>
        )}
      </div>
    </div>
  );
}
