import { createServerSupabaseClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function CustomersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: customers } = await supabase
    .from('customers')
    .select('*, program:programs(company_name)')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-left px-4 py-3">Program</th>
              <th className="text-left px-4 py-3">HIPAA</th>
              <th className="text-left px-4 py-3">Marketing</th>
              <th className="text-left px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((c: any) => (
              <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name}</td>
                <td className="px-4 py-3 text-gray-400">{c.email || '—'}</td>
                <td className="px-4 py-3 text-gray-400">{c.phone || '—'}</td>
                <td className="px-4 py-3 text-gray-400">{c.program?.company_name || '—'}</td>
                <td className="px-4 py-3">{c.hipaa_consent_signed ? '✓' : '✗'}</td>
                <td className="px-4 py-3">{c.marketing_consent ? '✓' : '—'}</td>
                <td className="px-4 py-3 text-gray-400">{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!customers || customers.length === 0) && (
          <div className="px-4 py-12 text-center text-gray-500">No customers yet</div>
        )}
      </div>
    </div>
  );
}
