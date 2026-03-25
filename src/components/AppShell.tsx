'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';

interface AppShellProps {
  employeeName: string;
  role: string;
  children: React.ReactNode;
}

export default function AppShell({ employeeName, role, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden lg:block lg:w-64 lg:shrink-0">
        <Sidebar employeeName={employeeName} role={role} />
      </div>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="lg:hidden sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Menu
            </button>
            <div className="text-sm font-semibold text-gray-800">OSSO Hub</div>
            <div className="w-12" aria-hidden="true" />
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl">
            <Sidebar employeeName={employeeName} role={role} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
