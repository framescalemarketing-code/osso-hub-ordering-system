import { getCurrentEmployee } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const employee = await getCurrentEmployee();
  if (!employee) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <Sidebar
        employeeName={`${employee.first_name} ${employee.last_name}`}
        role={employee.role}
      />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
