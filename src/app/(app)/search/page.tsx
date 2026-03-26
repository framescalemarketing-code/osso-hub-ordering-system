import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = (params.q || '').trim();
  const supabase = await createServerSupabaseClient();

  let customers: Array<{ id: string; first_name: string; last_name: string; email: string | null; employer: string | null }> = [];
  let companies: Array<{ id: string; company_name: string; company_code: string | null; contact_name: string | null; contact_email: string | null }> = [];
  let orders: Array<{ id: string; order_number: string; status: string; order_type: string }> = [];

  if (query.length >= 2) {
    const [customersRes, companiesRes, ordersRes] = await Promise.all([
      supabase
        .from('customers')
        .select('id, first_name, last_name, email, employer')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,employer.ilike.%${query}%`)
        .eq('is_active', true)
        .limit(20),
      supabase
        .from('programs')
        .select('id, company_name, company_code, contact_name, contact_email')
        .or(`company_name.ilike.%${query}%,company_code.ilike.%${query}%,contact_name.ilike.%${query}%,contact_email.ilike.%${query}%`)
        .eq('is_active', true)
        .limit(20),
      supabase
        .from('orders')
        .select('id, order_number, status, order_type')
        .or(`order_number.ilike.%${query}%`)
        .limit(20),
    ]);

    customers = customersRes.data || [];
    companies = companiesRes.data || [];
    orders = ordersRes.data || [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2a1f12]">Search Results</h1>
        <p className="mt-1 text-sm text-[#6f5b40]">Results for: <span className="font-semibold text-[#2f2416]">{query || '-'}</span></p>
      </div>

      {query.length < 2 ? (
        <div className="pos-panel p-5 text-sm text-[#6f5b40]">Enter at least 2 characters in the top search bar.</div>
      ) : (
        <>
          <section className="pos-panel p-5">
            <h2 className="text-lg font-bold text-[#2a1f12]">Orders</h2>
            <div className="mt-3 space-y-2">
              {orders.length === 0 && <p className="text-sm text-[#6f5b40]">No order matches.</p>}
              {orders.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`} className="block rounded-lg border border-[#e5d5bb] bg-[#fffdf8] px-3 py-2 text-sm hover:bg-white">
                  <span className="font-semibold text-[#2f2416]">{order.order_number}</span>
                  <span className="ml-3 text-[#6f5b40]">{order.order_type}</span>
                  <span className="ml-3 text-[#6f5b40]">{order.status}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="pos-panel p-5">
            <h2 className="text-lg font-bold text-[#2a1f12]">Customers</h2>
            <div className="mt-3 space-y-2">
              {customers.length === 0 && <p className="text-sm text-[#6f5b40]">No customer matches.</p>}
              {customers.map((customer) => (
                <Link key={customer.id} href={`/customers/${customer.id}`} className="block rounded-lg border border-[#e5d5bb] bg-[#fffdf8] px-3 py-2 text-sm hover:bg-white">
                  <span className="font-semibold text-[#2f2416]">{customer.first_name} {customer.last_name}</span>
                  <span className="ml-3 text-[#6f5b40]">{customer.email || '-'}</span>
                  <span className="ml-3 text-[#6f5b40]">{customer.employer || '-'}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="pos-panel p-5">
            <h2 className="text-lg font-bold text-[#2a1f12]">Companies</h2>
            <div className="mt-3 space-y-2">
              {companies.length === 0 && <p className="text-sm text-[#6f5b40]">No company matches.</p>}
              {companies.map((company) => (
                <Link key={company.id} href={`/programs/${company.id}`} className="block rounded-lg border border-[#e5d5bb] bg-[#fffdf8] px-3 py-2 text-sm hover:bg-white">
                  <span className="font-semibold text-[#2f2416]">{company.company_name}</span>
                  <span className="ml-3 text-[#6f5b40]">{company.company_code || '-'}</span>
                  <span className="ml-3 text-[#6f5b40]">{company.contact_name || '-'}</span>
                  <span className="ml-3 text-[#6f5b40]">{company.contact_email || '-'}</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
