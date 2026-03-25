'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/orders/new', label: 'New Order' },
  { href: '/orders', label: 'Orders' },
  { href: '/customers', label: 'Customers' },
  { href: '/programs', label: 'Programs' },
  { href: '/reminders', label: 'Reminders' },
  { href: '/settings', label: 'Settings' },
];

interface SidebarProps {
  employeeName: string;
  role: string;
  className?: string;
  onNavigate?: () => void;
}

export default function Sidebar({ employeeName, role, className = '', onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className={`bg-white border-r border-gray-200 flex flex-col min-h-screen ${className}`}>
      <div className="p-5 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">OSSO Hub</h1>
        <p className="text-xs text-gray-500 mt-1">Ordering System</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="text-sm text-gray-800 font-medium truncate">{employeeName}</div>
        <div className="text-xs text-gray-500 capitalize">{role}</div>
        <button onClick={handleLogout} className="mt-3 text-xs text-gray-500 hover:text-red-500 transition">
          Sign Out
        </button>
      </div>
    </aside>
  );
}
