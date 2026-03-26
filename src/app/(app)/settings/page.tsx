import { getCurrentEmployee } from '@/lib/auth';
import { integrations, notifications } from '@/lib/integrations/config';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import RoleAccessManager from '@/components/RoleAccessManager';

export default async function SettingsPage() {
  const employee = await getCurrentEmployee();
  const canManage = ['admin', 'manager'].includes(employee?.role || '');

  if (!employee) {
    redirect('/');
  }

  const checks = [
    { name: 'Supabase', connected: !!process.env.NEXT_PUBLIC_SUPABASE_URL, status: 'Connected' },
    { name: 'ClickUp', connected: integrations.clickup.enabled(), status: integrations.clickup.enabled() ? 'Connected' : 'Not configured' },
    { name: 'BigQuery', connected: integrations.bigquery.enabled(), status: integrations.bigquery.enabled() ? 'Connected' : 'Not configured' },
    {
      name: 'Email (Resend)',
      connected: integrations.resend.enabled() && notifications.enabled(),
      status: !integrations.resend.enabled() ? 'Not configured' : notifications.enabled() ? 'Connected' : 'Paused',
    },
  ];

  return (
    <div>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-[#2a1f12]">Settings</h1>

      <div className="pos-panel p-6 mb-6">
        <h2 className="text-lg font-bold text-[#2a1f12] mb-4">Core Integration Status</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {checks.map(c => (
            <div key={c.name} className="flex items-center gap-3 rounded-xl border border-[#e5d5bb] bg-[#fffdf8] p-3">
              <span className={`w-3 h-3 rounded-full ${c.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-sm font-semibold text-[#2f2416]">{c.name}</span>
              <span className={`text-xs ml-auto ${c.connected ? 'text-emerald-700' : 'text-[#9f8968]'}`}>
                {c.status}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-[#7b6340]">
          Add API keys to your .env.local file to enable integrations. See .env.example for all available keys.
        </p>
        {!notifications.enabled() && (
          <p className="mt-2 text-xs text-[#7b6340]">
            Outbound notifications stay paused until <code>ENABLE_EXTERNAL_NOTIFICATIONS=true</code>.
          </p>
        )}
        <p className="mt-2 text-xs text-[#7b6340]">
          Only the current operational outputs are kept active here: ClickUp, BigQuery, and approval email handling.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2">
        <Link
          href="/programs"
          className="pos-panel p-6 transition hover:border-[#ccb089] hover:bg-[#fffdf8]"
        >
          <h2 className="text-lg font-bold text-[#2a1f12]">Companies</h2>
          <p className="mt-2 text-sm text-[#6f5b40]">
            Manage company setup, approval contacts, and active program visibility.
          </p>
        </Link>
        <Link href="/eligibility" className="pos-panel p-6 transition hover:border-[#ccb089] hover:bg-[#fffdf8]">
          <h2 className="text-lg font-bold text-[#2a1f12]">Eligibility Workspace</h2>
          <p className="mt-2 text-sm text-[#6f5b40]">
            Lookup roster rows, inspect employee details, and add matched employees into customers.
          </p>
        </Link>
      </div>

      <div className="pos-panel p-6 mb-6">
        <h2 className="text-lg font-bold text-[#2a1f12]">Repo Focus</h2>
        <p className="mt-2 text-sm text-[#6f5b40]">
          The repo is intentionally focused on company setup, eligibility, orders, ClickUp, BigQuery, and approval handling. Out-of-sequence admin experiments and speculative downstream connectors have been removed.
        </p>
      </div>

      <div className="pos-panel p-6">
        <h2 className="mb-4 text-lg font-bold text-[#2a1f12]">Current User</h2>
        <div className="text-sm space-y-2">
          <p><span className="text-[#7d6541]">Name:</span> {employee?.first_name} {employee?.last_name}</p>
          <p><span className="text-[#7d6541]">Email:</span> {employee?.email}</p>
          <p><span className="text-[#7d6541]">Role:</span> <span className="capitalize">{employee?.role}</span></p>
        </div>
        {canManage && (
          <div className="mt-4">
            <RoleAccessManager currentRole={employee?.role || 'readonly'} />
          </div>
        )}
      </div>
    </div>
  );
}
