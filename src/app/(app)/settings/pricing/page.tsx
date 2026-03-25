import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentEmployee } from '@/lib/auth';
import PricingSettingsEditor from '@/components/PricingSettingsEditor';

export default async function PricingSettingsPage() {
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
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2a1f12]">Pricing</h1>
          <p className="mt-1 text-sm text-[#6f5b40]">
            Canonical pricing matrix used by company package planning and order quoting logic.
          </p>
        </div>
      </div>

      <div className="pos-panel p-6">
        <h2 className="mb-4 text-lg font-semibold">Editable Pricing Matrix</h2>
        <PricingSettingsEditor />
      </div>
    </div>
  );
}
