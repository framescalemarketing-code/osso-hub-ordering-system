import { getCurrentEmployee } from '@/lib/auth';
import { integrations } from '@/lib/integrations/config';

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

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Integration Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {checks.map(c => (
            <div key={c.name} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
              <span className={`w-3 h-3 rounded-full ${c.connected ? 'bg-green-500' : 'bg-gray-600'}`} />
              <span className="text-sm font-medium">{c.name}</span>
              <span className={`text-xs ml-auto ${c.connected ? 'text-green-400' : 'text-gray-500'}`}>
                {c.connected ? 'Connected' : 'Not configured'}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Add API keys to your .env.local file to enable integrations. See .env.example for all available keys.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Current User</h2>
        <div className="text-sm space-y-2">
          <p><span className="text-gray-400">Name:</span> {employee?.first_name} {employee?.last_name}</p>
          <p><span className="text-gray-400">Email:</span> {employee?.email}</p>
          <p><span className="text-gray-400">Role:</span> <span className="capitalize">{employee?.role}</span></p>
        </div>
      </div>
    </div>
  );
}
