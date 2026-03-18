import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth';
import ProgramForm from '@/components/ProgramForm';
import type { Program } from '@/lib/types';

export default async function ProgramsPage() {
  const supabase = await createServerSupabaseClient();
  const employee = await getCurrentEmployee();

  const { data: programs } = await supabase.from('programs').select('*').order('company_name');
  const typedPrograms = programs as Program[] | null;

  const canManage = ['admin', 'manager'].includes(employee?.role || '');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Programs</h1>
      </div>

      {canManage && <ProgramForm />}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left px-4 py-3">Company</th>
              <th className="text-left px-4 py-3">Contact</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Approval</th>
              <th className="text-left px-4 py-3">Terms</th>
              <th className="text-left px-4 py-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {typedPrograms?.map(p => (
              <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium">{p.company_name}</td>
                <td className="px-4 py-3 text-gray-400">{p.contact_name || '—'}</td>
                <td className="px-4 py-3 text-gray-400">{p.contact_email || '—'}</td>
                <td className="px-4 py-3">{p.approval_required ? 'Required' : 'No'}</td>
                <td className="px-4 py-3 text-gray-400">{p.invoice_terms}</td>
                <td className="px-4 py-3">{p.is_active ? '✓' : '✗'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!typedPrograms || typedPrograms.length === 0) && (
          <div className="px-4 py-12 text-center text-gray-500">No programs yet</div>
        )}
      </div>
    </div>
  );
}
