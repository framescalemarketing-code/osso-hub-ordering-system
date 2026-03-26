'use client';

import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

type SearchPreviewResults = {
  customers: Array<{ id: string; first_name: string; last_name: string; email: string | null; employer: string | null }>;
  companies: Array<{ id: string; company_name: string; company_code?: string | null; contact_name: string | null; contact_email: string | null }>;
  orders: Array<{ id: string; order_number: string; status: string; order_type: string }>;
};

interface AppShellProps {
  employeeName: string;
  role: string;
  children: React.ReactNode;
}

export default function AppShell({ employeeName, role, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResults, setPreviewResults] = useState<SearchPreviewResults>({
    customers: [],
    companies: [],
    orders: [],
  });
  const deferredSearch = useDeferredValue(globalSearch.trim());
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!searchRef.current?.contains(event.target as Node)) {
        setPreviewOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (deferredSearch.length < 2) return;

    const controller = new AbortController();

    fetch(`/api/search?q=${encodeURIComponent(deferredSearch)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Search failed');
        return response.json() as Promise<SearchPreviewResults>;
      })
      .then((data) => {
        setPreviewResults(data);
        setPreviewOpen(true);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== 'AbortError') {
          setPreviewResults({ customers: [], companies: [], orders: [] });
        }
      })
      .finally(() => setPreviewLoading(false));

    return () => controller.abort();
  }, [deferredSearch]);

  function submitGlobalSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = globalSearch.trim();
    if (!query) return;
    setPreviewOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  const hasPreviewResults =
    previewResults.orders.length > 0 || previewResults.customers.length > 0 || previewResults.companies.length > 0;

  function handlePreviewNavigate() {
    setPreviewOpen(false);
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

            <div ref={searchRef} className="relative flex min-w-52 flex-1">
              <form onSubmit={submitGlobalSearch} className="flex w-full items-center gap-2">
                <input
                  value={globalSearch}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setGlobalSearch(nextValue);
                    if (nextValue.trim().length < 2) {
                      setPreviewLoading(false);
                      setPreviewResults({ customers: [], companies: [], orders: [] });
                      setPreviewOpen(false);
                    } else {
                      setPreviewLoading(true);
                    }
                  }}
                  onFocus={() => {
                    if (deferredSearch.length >= 2) setPreviewOpen(true);
                  }}
                  className="pos-input"
                  placeholder="Search orders, customers, companies..."
                />
                <button type="submit" className="pos-btn-primary whitespace-nowrap px-4 py-2">Search</button>
              </form>

              {previewOpen && deferredSearch.length >= 2 && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] rounded-2xl border border-[#d8c5a3] bg-[#fffdf8] p-3 shadow-[0_24px_48px_rgba(66,43,18,0.18)]">
                  {previewLoading ? (
                    <p className="px-2 py-3 text-sm text-[#6f5b40]">Finding matches...</p>
                  ) : hasPreviewResults ? (
                    <div className="space-y-3">
                      {previewResults.orders.length > 0 && (
                        <div>
                          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9a835f]">Orders</p>
                          <div className="mt-1 space-y-1">
                            {previewResults.orders.slice(0, 4).map((order) => (
                              <Link
                                key={order.id}
                                href={`/orders/${order.id}`}
                                onClick={handlePreviewNavigate}
                                className="block rounded-xl px-3 py-2 text-sm text-[#3d2f1d] transition hover:bg-[#f8efdf]"
                              >
                                <span className="font-semibold">{order.order_number}</span>
                                <span className="ml-2 capitalize text-[#6f5b40]">{order.order_type}</span>
                                <span className="ml-2 text-[#9a835f]">{order.status}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {previewResults.customers.length > 0 && (
                        <div>
                          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9a835f]">Customers</p>
                          <div className="mt-1 space-y-1">
                            {previewResults.customers.slice(0, 4).map((customer) => (
                              <Link
                                key={customer.id}
                                href={`/customers/${customer.id}`}
                                onClick={handlePreviewNavigate}
                                className="block rounded-xl px-3 py-2 text-sm text-[#3d2f1d] transition hover:bg-[#f8efdf]"
                              >
                                <span className="font-semibold">{customer.first_name} {customer.last_name}</span>
                                <span className="ml-2 text-[#6f5b40]">{customer.email || '-'}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {previewResults.companies.length > 0 && (
                        <div>
                          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9a835f]">Companies</p>
                          <div className="mt-1 space-y-1">
                            {previewResults.companies.slice(0, 4).map((company) => (
                              <Link
                                key={company.id}
                                href={`/programs/${company.id}`}
                                onClick={handlePreviewNavigate}
                                className="block rounded-xl px-3 py-2 text-sm text-[#3d2f1d] transition hover:bg-[#f8efdf]"
                              >
                                <span className="font-semibold">{company.company_name}</span>
                                <span className="ml-2 text-[#6f5b40]">{company.company_code || '-'}</span>
                                <span className="ml-2 text-[#9a835f]">{company.contact_name || '-'}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="px-2 py-3 text-sm text-[#6f5b40]">No matches yet.</p>
                  )}
                </div>
              )}
            </div>

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
