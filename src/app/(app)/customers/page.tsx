import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Customer } from '@/lib/types';

type CustomerWithProgram = Customer & {
  program?: { company_name: string } | null;
};

export default async function CustomersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: customers } = await supabase
    .from('customers')
    .select('*, program:programs(company_name)')
    .order('created_at', { ascending: false })
    .limit(100);
  const typedCustomers = customers as CustomerWithProgram[] | null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
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
            {typedCustomers?.map(c => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name}</td>
                <td className="px-4 py-3 text-gray-500">{c.email || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{c.phone || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{c.program?.company_name || '—'}</td>
                <td className="px-4 py-3">{c.hipaa_consent_signed ? '✓' : '✗'}</td>
                <td className="px-4 py-3">{c.marketing_consent ? '✓' : '—'}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!customers || customers.length === 0) && (
          <div className="px-4 py-12 text-center text-gray-400">No customers yet</div>
        )}
      </div>
    </div>
  );
}
