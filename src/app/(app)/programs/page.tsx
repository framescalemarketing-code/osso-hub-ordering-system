import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth';
import ProgramForm from '@/components/ProgramForm';
import type { Program } from '@/lib/types';

type ProgramListItem = Pick<
  Program,
  'id' | 'company_name' | 'contact_name' | 'contact_email' | 'approval_required' | 'invoice_terms' | 'is_active'
>;

type ActiveEnrollmentRow = {
  program_id: string;
};

function getProgramTypeLabel(program?: { approval_required: boolean; program_type?: string | null } | null) {
  if (!program) return 'Unassigned';
  return program.program_type?.trim() || (program.approval_required ? 'Approval Required' : 'Direct');
}

export default async function ProgramsPage() {
  const supabase = await createServerSupabaseClient();
  const employee = await getCurrentEmployee();

  const [programsRes, enrollmentsRes] = await Promise.all([
    supabase
      .from('programs')
      .select('id, company_name, contact_name, contact_email, approval_required, invoice_terms, is_active')
      .order('company_name'),
    supabase
      .from('program_enrollments')
      .select('program_id')
      .eq('status', 'active'),
  ]);

  const programs = programsRes.data as ProgramListItem[] | null;
  const enrollments = enrollmentsRes.data as ActiveEnrollmentRow[] | null;
  const activeCounts = new Map<string, number>();
  for (const row of enrollments || []) {
    activeCounts.set(row.program_id, (activeCounts.get(row.program_id) || 0) + 1);
  }

  const canManage = ['admin', 'manager'].includes(employee?.role || '');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Programs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Click a company to open its profile, address, and member details.
          </p>
        </div>
      </div>

      {canManage && <ProgramForm />}

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="hidden xl:grid xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-4 border-b border-gray-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Company</span>
          <span>POC Name</span>
          <span>POC Email</span>
          <span>Program Type</span>
          <span>Employee Count</span>
        </div>

        <div>
          {programs?.map((program) => {
            const activeCount = activeCounts.get(program.id) || 0;

            return (
              <Link
                key={program.id}
                href={`/programs/${program.id}`}
                className="block border-b border-gray-100 px-4 py-4 transition hover:bg-gray-50"
              >
                <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">Company</p>
                    <p className="font-medium text-gray-900">{program.company_name}</p>
                    <p className="text-xs text-gray-500">{program.is_active ? 'Active program' : 'Inactive program'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">POC Name</p>
                    <p className="text-gray-600">{program.contact_name || '-'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">POC Email</p>
                    <p className="break-all text-gray-600">{program.contact_email || '-'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">Program Type</p>
                    <p className="text-gray-600">{getProgramTypeLabel(program)}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">Employee Count</p>
                    <p className="text-gray-600">{activeCount} active member{activeCount === 1 ? '' : 's'}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {(!programs || programs.length === 0) && (
          <div className="px-4 py-12 text-center text-gray-400">No programs yet</div>
        )}
      </div>
    </div>
  );
}
