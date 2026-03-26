'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/orders/new', label: 'New Order' },
  { href: '/orders', label: 'Orders' },
  { href: '/customers', label: 'Customers' },
  { href: '/programs', label: 'Companies' },
  { href: '/eligibility', label: 'Eligibility' },
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
    <aside className={`flex min-h-screen flex-col border-r border-[#b59d76]/40 bg-[#f8f2e8] ${className}`}>
      <div className="border-b border-[#b59d76]/35 px-5 py-6">
        <h1 className="text-lg font-extrabold tracking-wide text-[#382715]">OSSO Hub</h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7d6541]">Ordering System</p>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? 'bg-linear-to-r from-[#8f6d3f] to-[#725326] text-white shadow-[0_10px_26px_rgba(77,54,24,0.28)]'
                  : 'text-[#4a3b28] hover:bg-white/75 hover:text-[#20170f]'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[#b59d76]/35 p-4">
        <div className="truncate text-sm font-semibold text-[#2e2317]">{employeeName}</div>
        <div className="text-xs capitalize text-[#7d6541]">{role}</div>
        <button onClick={handleLogout} className="mt-3 text-xs font-semibold text-[#6f5940] transition hover:text-[#b42318]">
          Sign Out
        </button>
      </div>
    </aside>
  );
}
