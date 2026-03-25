'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

interface AppShellProps {
  employeeName: string;
  role: string;
  children: React.ReactNode;
}

export default function AppShell({ employeeName, role, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!mobileOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  function submitGlobalSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = globalSearch.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:block lg:w-64 lg:shrink-0">
        <Sidebar employeeName={employeeName} role={role} />
      </div>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[#bda882]/45 bg-[#fffaf2]/90 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3.5 lg:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="pos-btn-secondary inline-flex items-center justify-center px-3 py-2 lg:hidden"
            >
              Menu
            </button>

            <div className="hidden min-w-36 text-sm font-bold tracking-wide text-[#3d2f1d] lg:block">OSSO Hub</div>

            <form onSubmit={submitGlobalSearch} className="flex min-w-52 flex-1 items-center gap-2">
              <input
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                className="pos-input"
                placeholder="Search orders, customers, companies..."
              />
              <button type="submit" className="pos-btn-primary whitespace-nowrap px-4 py-2">Search</button>
            </form>

            <div className="ml-auto hidden items-center gap-2 lg:flex">
              <Link href="/orders/new" className="pos-btn-secondary px-3 py-2 text-xs">New Order</Link>
              <Link href="/eligibility" className="pos-btn-secondary px-3 py-2 text-xs">Eligibility</Link>
            </div>

            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7d6541] lg:hidden">OSSO Hub</div>
            <div className="w-10 lg:hidden" aria-hidden="true" />
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-360">{children}</div>
        </main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-[#20160b]/45" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-[#fefcf7] shadow-2xl">
            <Sidebar employeeName={employeeName} role={role} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
