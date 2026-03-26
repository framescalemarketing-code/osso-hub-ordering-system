import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth';
import type { Program } from '@/lib/types';
import { formatInvoiceTerms } from '@/lib/program-options';

type ProgramListItem = Pick<
  Program,
  | 'id'
  | 'company_name'
  | 'company_code'
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
      .select('id, company_name, company_code, contact_name, contact_email, approval_required, invoice_terms, is_active, program_type, employee_count, eu_package, service_tier')
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

  const canManage = ['admin', 'manager', 'sales', 'optician'].includes(employee?.role || '');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2a1f12]">Companies</h1>
          <p className="mt-1 text-sm text-[#6f5b40]">
            Click a company to open its profile, address, and member details.
          </p>
        </div>
        {canManage && (
          <Link href="/programs/new" className="pos-btn-primary">
            + Add New Company
          </Link>
        )}
      </div>

      <div className="pos-panel-strong mt-6 overflow-hidden">
        <div className="hidden gap-4 border-b border-[#e4d4ba] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#7d6541] xl:grid xl:grid-cols-[1.2fr_0.8fr_1fr_1fr_0.9fr_0.9fr_1fr]">
          <span>Company</span>
          <span>Company Code</span>
          <span>Point of Contact</span>
          <span>Point of Contact Email</span>
          <span>EU Package</span>
          <span>Net Terms</span>
          <span>Employee Count</span>
        </div>

        <div>
          {programs?.map((program) => {
            const activeCount = activeCounts.get(program.id) || 0;

            return (
              <Link
                key={program.id}
                href={`/programs/${program.id}`}
                className="block border-b border-[#f1e5d3] px-4 py-4 transition hover:bg-[#fffcf7]"
              >
                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_1fr_1fr_0.9fr_0.9fr_1fr]">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9f8968] xl:hidden">Company</p>
                    <p className="font-semibold text-[#2f2416]">{program.company_name}</p>
                    <p className="text-xs text-[#6f5b40]">{program.is_active ? 'Active company program' : 'Inactive company program'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9f8968] xl:hidden">Company Code</p>
                    <p className="text-[#6f5b40]">{program.company_code || '-'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9f8968] xl:hidden">Point of Contact</p>
                    <p className="text-[#6f5b40]">{program.contact_name || '-'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9f8968] xl:hidden">Point of Contact Email</p>
                    <p className="break-all text-[#6f5b40]">{program.contact_email || '-'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9f8968] xl:hidden">EU Package</p>
                    <p className="text-[#6f5b40]">{program.eu_package || '-'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9f8968] xl:hidden">Net Terms</p>
                    <p className="text-[#6f5b40]">{formatInvoiceTerms(program.invoice_terms)}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9f8968] xl:hidden">Employee Count</p>
                    <p className="text-[#6f5b40]">
                      {program.employee_count ?? activeCount} active member{(program.employee_count ?? activeCount) === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {(!programs || programs.length === 0) && (
          <div className="px-4 py-12 text-center text-[#7b6340]">No companies yet</div>
        )}
      </div>
    </div>
  );
}
