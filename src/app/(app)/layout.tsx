import { getCurrentEmployee } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const employee = await getCurrentEmployee();
  if (!employee) redirect('/login');

  return (
    <AppShell employeeName={`${employee.first_name} ${employee.last_name}`} role={employee.role}>
      {children}
    </AppShell>
  );
}
