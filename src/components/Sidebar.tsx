'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/orders/new', label: 'New Order', icon: '➕' },
  { href: '/orders', label: 'Orders', icon: '📋' },
  { href: '/customers', label: 'Customers', icon: '👥' },
  { href: '/programs', label: 'Programs', icon: '🏢' },
  { href: '/reminders', label: 'Reminders', icon: '🔔' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar({ employeeName, role }: { employeeName: string; role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col min-h-screen">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">OSSO Hub</h1>
        <p className="text-xs text-gray-500 mt-1">Ordering System</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="text-sm text-white font-medium">{employeeName}</div>
        <div className="text-xs text-gray-500 capitalize">{role}</div>
        <button
          onClick={handleLogout}
          className="mt-3 text-xs text-gray-500 hover:text-red-400 transition"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
