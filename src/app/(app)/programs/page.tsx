import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth';
import ProgramForm from '@/components/ProgramForm';
import type { Program } from '@/lib/types';

type ProgramListItem = Pick<
  Program,
  | 'id'
  | 'company_name'
  | 'contact_name'
  | 'contact_email'
  | 'approval_required'
  | 'invoice_terms'
  | 'is_active'
  | 'program_type'
  | 'employee_count'
  | 'eu_package'
  | 'service_tier'
>;

type ActiveEnrollmentRow = {
  program_id: string;
};

export default async function CompaniesPage() {
  const supabase = await createServerSupabaseClient();
  const employee = await getCurrentEmployee();

  const [programsRes, enrollmentsRes] = await Promise.all([
    supabase
      .from('programs')
      .select('id, company_name, contact_name, contact_email, approval_required, invoice_terms, is_active, program_type, employee_count, eu_package, service_tier')
      .eq('is_active', true)
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
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="mt-1 text-sm text-gray-500">
            Click a company to open its profile, address, and member details.
          </p>
        </div>
      </div>

      {canManage && <ProgramForm />}

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="hidden xl:grid xl:grid-cols-[1.3fr_1fr_1fr_0.9fr_0.9fr_1fr] gap-4 border-b border-gray-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Company</span>
          <span>POC Name</span>
          <span>POC Email</span>
          <span>EU Package</span>
          <span>Service Tier</span>
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
                <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr_1fr_0.9fr_0.9fr_1fr]">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">Company</p>
                    <p className="font-medium text-gray-900">{program.company_name}</p>
                    <p className="text-xs text-gray-500">{program.is_active ? 'Active company program' : 'Inactive company program'}</p>
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">EU Package</p>
                    <p className="text-gray-600">{program.eu_package || '-'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">Service Tier</p>
                    <p className="text-gray-600">{program.service_tier || '-'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">Employee Count</p>
                    <p className="text-gray-600">
                      {program.employee_count ?? activeCount} active member{(program.employee_count ?? activeCount) === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {(!programs || programs.length === 0) && (
          <div className="px-4 py-12 text-center text-gray-400">No companies yet</div>
        )}
      </div>
    </div>
  );
}
