import { getCurrentEmployee } from '@/lib/auth';
import { integrations, notifications } from '@/lib/integrations/config';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import RoleAccessManager from '@/components/RoleAccessManager';

export default async function SettingsPage() {
  const employee = await getCurrentEmployee();
  const canManage = ['admin', 'manager'].includes(employee?.role || '');

  if (!canManage) {
    redirect('/');
  }

  const checks = [
    { name: 'Supabase', connected: !!process.env.NEXT_PUBLIC_SUPABASE_URL, status: 'Connected' },
    { name: 'ClickUp', connected: integrations.clickup.enabled(), status: integrations.clickup.enabled() ? 'Connected' : 'Not configured' },
    { name: 'NetSuite', connected: integrations.netsuite.enabled(), status: integrations.netsuite.enabled() ? 'Connected' : 'Not configured' },
    { name: 'QuickBooks', connected: integrations.quickbooks.enabled(), status: integrations.quickbooks.enabled() ? 'Connected' : 'Not configured' },
    { name: 'Mailchimp', connected: integrations.mailchimp.enabled(), status: integrations.mailchimp.enabled() ? 'Connected' : 'Not configured' },
    { name: 'BigQuery', connected: integrations.bigquery.enabled(), status: integrations.bigquery.enabled() ? 'Connected' : 'Not configured' },
    { name: 'Nassau Lens', connected: integrations.nassau.enabled(), status: integrations.nassau.enabled() ? 'Connected' : 'Not configured' },
    { name: 'ABB Optical', connected: integrations.abb_optical.enabled(), status: integrations.abb_optical.enabled() ? 'Connected' : 'Not configured' },
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
        <h2 className="text-lg font-bold text-[#2a1f12] mb-4">Integration Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
      </div>

      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2">
        <Link
          href="/settings/programs"
          className="pos-panel p-6 transition hover:border-[#ccb089] hover:bg-[#fffdf8]"
        >
          <h2 className="text-lg font-bold text-[#2a1f12]">Programs</h2>
          <p className="mt-2 text-sm text-[#6f5b40]">
            Manage program templates, guideline defaults, and company package configuration support.
          </p>
        </Link>
        <Link
          href="/settings/pricing"
          className="pos-panel p-6 transition hover:border-[#ccb089] hover:bg-[#fffdf8]"
        >
          <h2 className="text-lg font-bold text-[#2a1f12]">Pricing</h2>
          <p className="mt-2 text-sm text-[#6f5b40]">
            Review EU package pricing, service tiers, add-ons, travel, and discount policies.
          </p>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2">
        <Link href="/eligibility" className="pos-panel p-6 transition hover:border-[#ccb089] hover:bg-[#fffdf8]">
          <h2 className="text-lg font-bold text-[#2a1f12]">Eligibility Workspace</h2>
          <p className="mt-2 text-sm text-[#6f5b40]">
            Lookup CSV roster records, inspect IDs/details, and add employees directly into customers.
          </p>
        </Link>
        <Link href="/search" className="pos-panel p-6 transition hover:border-[#ccb089] hover:bg-[#fffdf8]">
          <h2 className="text-lg font-bold text-[#2a1f12]">Global Search</h2>
          <p className="mt-2 text-sm text-[#6f5b40]">
            Open the quick-find workspace for orders, customers, and companies.
          </p>
        </Link>
      </div>

      <div className="pos-panel p-6">
        <h2 className="mb-4 text-lg font-bold text-[#2a1f12]">Current User</h2>
        <div className="text-sm space-y-2">
          <p><span className="text-[#7d6541]">Name:</span> {employee?.first_name} {employee?.last_name}</p>
          <p><span className="text-[#7d6541]">Email:</span> {employee?.email}</p>
          <p><span className="text-[#7d6541]">Role:</span> <span className="capitalize">{employee?.role}</span></p>
        </div>
        <div className="mt-4">
          <RoleAccessManager currentRole={employee?.role || 'readonly'} />
        </div>
      </div>
    </div>
  );
}
