import Link from 'next/link';
import { DEFAULT_PROGRAM_GUIDELINES, PROGRAM_GUIDELINE_SOURCE } from '@/lib/program-guidelines';

export default function ProgramSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-800">
          {'<- Settings'}
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Programs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Program guideline baseline for company onboarding, enrollment checks, and order governance.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Source reference:{' '}
            <a href={PROGRAM_GUIDELINE_SOURCE} target="_blank" rel="noreferrer" className="underline hover:text-gray-600">
              osso-internal-quote-tool
            </a>
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Default Program Guidelines</h2>
        <div className="space-y-4">
          {DEFAULT_PROGRAM_GUIDELINES.map((item) => (
            <div key={item.title} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-800">{item.title}</h3>
              <p className="mt-1 text-sm text-gray-700">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold">Operational Notes</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
          <li>Company-level restricted guidelines should be stored per company profile and reviewed during order intake.</li>
          <li>Enrollment CSV updates should be uploaded on each roster change to keep eligibility matching accurate.</li>
          <li>Use program approver emails for gated approval flows when company policy requires authorization.</li>
        </ul>
      </div>

      <Link
        href="/programs"
        className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Open Companies
      </Link>
    </div>
  );
}
