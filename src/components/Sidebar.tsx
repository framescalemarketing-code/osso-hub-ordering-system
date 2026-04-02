'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard', icon: 'DB' },
  { href: '/orders/new', label: 'New Order', icon: 'NO' },
  { href: '/orders', label: 'Orders', icon: 'OR' },
  { href: '/customers', label: 'Customers', icon: 'CU' },
  { href: '/programs', label: 'Programs', icon: 'PR' },
  { href: '/reminders', label: 'Reminders', icon: 'RE' },
  { href: '/settings', label: 'Settings', icon: 'ST' },
];

export default function Sidebar({ employeeName, role }: { employeeName: string; role: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="flex min-h-screen w-64 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-6">
        <h1 className="text-xl font-bold text-gray-900">OSSO Hub</h1>
        <p className="mt-1 text-xs text-gray-500">Ordering System</p>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-black/5 text-[11px] font-bold">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-4">
        <div className="text-sm font-medium text-gray-800">{employeeName}</div>
        <div className="text-xs capitalize text-gray-500">{role}</div>
        <button onClick={handleLogout} className="mt-3 text-xs text-gray-500 transition hover:text-red-500">
          Sign Out
        </button>
      </div>
    </aside>
  );
}
