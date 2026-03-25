import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentEmployee } from '@/lib/auth';
import ProgramForm from '@/components/ProgramForm';

export default async function NewCompanyPage() {
  const employee = await getCurrentEmployee();
  const canManage = ['admin', 'manager', 'sales', 'optician'].includes(employee?.role || '');

  if (!canManage) {
    redirect('/programs');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Link href="/programs" className="text-sm font-semibold text-[#7d6541] hover:text-[#48341f]">
          {'<- Companies'}
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2a1f12]">Add New Company</h1>
          <p className="mt-1 text-sm text-[#6f5b40]">
            Complete the company intake details to create a new program profile.
          </p>
        </div>
      </div>

      <ProgramForm initiallyOpen showTrigger={false} />
    </div>
  );
}
