import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentEmployee } from '@/lib/auth';
import { DEFAULT_PROGRAM_GUIDELINES, PROGRAM_GUIDELINE_SOURCE } from '@/lib/program-guidelines';
import ProgramGuidelinesEditor from '@/components/ProgramGuidelinesEditor';

export default async function ProgramSettingsPage() {
  const employee = await getCurrentEmployee();
  const canManage = ['admin', 'manager'].includes(employee?.role || '');

  if (!canManage) {
    redirect('/');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Link href="/settings" className="text-sm font-semibold text-[#7d6541] hover:text-[#48341f]">
          {'<- Settings'}
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2a1f12]">Programs</h1>
          <p className="mt-1 text-sm text-[#6f5b40]">
            Program guideline baseline for company onboarding, enrollment checks, and order governance.
          </p>
          <p className="mt-1 text-xs text-[#7b6340]">
            Source reference:{' '}
            <a href={PROGRAM_GUIDELINE_SOURCE} target="_blank" rel="noreferrer" className="underline hover:text-gray-600">
              osso-internal-quote-tool
            </a>
          </p>
        </div>
      </div>

      <div className="pos-panel p-6">
        <h2 className="mb-4 text-lg font-semibold">Default Program Guidelines</h2>
        <ProgramGuidelinesEditor defaults={DEFAULT_PROGRAM_GUIDELINES} />
      </div>

      <div className="pos-panel p-6">
        <h2 className="mb-3 text-lg font-semibold">Operational Notes</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
          <li>Company-level restricted guidelines should be stored per company profile and reviewed during order intake.</li>
          <li>Enrollment CSV updates should be uploaded on each roster change to keep eligibility matching accurate.</li>
          <li>Use program approver emails for gated approval flows when company policy requires authorization.</li>
        </ul>
      </div>

      <Link
        href="/programs"
        className="pos-btn-primary inline-flex"
      >
        Open Companies
      </Link>
    </div>
  );
}
