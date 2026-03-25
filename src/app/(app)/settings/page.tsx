import { getCurrentEmployee } from '@/lib/auth';
import { integrations } from '@/lib/integrations/config';
import Link from 'next/link';

export default async function SettingsPage() {
  const employee = await getCurrentEmployee();

  const checks = [
    { name: 'Supabase', connected: !!process.env.NEXT_PUBLIC_SUPABASE_URL },
    { name: 'ClickUp', connected: integrations.clickup.enabled() },
    { name: 'NetSuite', connected: integrations.netsuite.enabled() },
    { name: 'QuickBooks', connected: integrations.quickbooks.enabled() },
    { name: 'Mailchimp', connected: integrations.mailchimp.enabled() },
    { name: 'BigQuery', connected: integrations.bigquery.enabled() },
    { name: 'Nassau Lens', connected: integrations.nassau.enabled() },
    { name: 'ABB Optical', connected: integrations.abb_optical.enabled() },
    { name: 'Email (Resend)', connected: integrations.resend.enabled() },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Integration Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {checks.map(c => (
            <div key={c.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span className={`w-3 h-3 rounded-full ${c.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-sm font-medium text-gray-800">{c.name}</span>
              <span className={`text-xs ml-auto ${c.connected ? 'text-green-600' : 'text-gray-400'}`}>
                {c.connected ? 'Connected' : 'Not configured'}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Add API keys to your .env.local file to enable integrations. See .env.example for all available keys.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2">
        <Link
          href="/settings/programs"
          className="rounded-xl border border-gray-200 bg-white p-6 transition hover:border-blue-300 hover:bg-blue-50"
        >
          <h2 className="text-lg font-semibold text-gray-900">Programs</h2>
          <p className="mt-2 text-sm text-gray-600">
            Manage program templates, guideline defaults, and company package configuration support.
          </p>
        </Link>
        <Link
          href="/settings/pricing"
          className="rounded-xl border border-gray-200 bg-white p-6 transition hover:border-blue-300 hover:bg-blue-50"
        >
          <h2 className="text-lg font-semibold text-gray-900">Pricing</h2>
          <p className="mt-2 text-sm text-gray-600">
            Review EU package pricing, service tiers, add-ons, travel, and discount policies.
          </p>
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Current User</h2>
        <div className="text-sm space-y-2">
          <p><span className="text-gray-500">Name:</span> {employee?.first_name} {employee?.last_name}</p>
          <p><span className="text-gray-500">Email:</span> {employee?.email}</p>
          <p><span className="text-gray-500">Role:</span> <span className="capitalize">{employee?.role}</span></p>
        </div>
      </div>
    </div>
  );
}
