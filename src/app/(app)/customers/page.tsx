import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Customer, Order, Program } from '@/lib/types';

type CustomerListItem = Pick<
  Customer,
  'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'date_of_birth' | 'created_at' | 'notes'
> & {
  program?: Pick<Program, 'id' | 'company_name' | 'approval_required' | 'invoice_terms'> | null;
};

type RecentOrderRow = Pick<Order, 'customer_id' | 'created_at'>;

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function getProgramTypeLabel(program?: { approval_required: boolean; program_type?: string | null } | null) {
  if (!program) return 'Unassigned';
  return program.program_type?.trim() || (program.approval_required ? 'Approval Required' : 'Direct');
}

export default async function CustomersPage() {
  const supabase = await createServerSupabaseClient();

  const [customersRes, ordersRes] = await Promise.all([
    supabase
      .from('customers')
      .select('id, first_name, last_name, email, phone, date_of_birth, created_at, notes, program:programs(id, company_name, approval_required, invoice_terms)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('orders')
      .select('customer_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);

  const customers = customersRes.data as CustomerListItem[] | null;
  const orders = ordersRes.data as RecentOrderRow[] | null;

  const recentOrderByCustomer = new Map<string, string>();
  for (const order of orders || []) {
    if (!recentOrderByCustomer.has(order.customer_id)) {
      recentOrderByCustomer.set(order.customer_id, order.created_at);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Click any customer to open their profile, recent orders, and notes.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="hidden xl:grid xl:grid-cols-[1.3fr_1.2fr_1fr_1.2fr_0.9fr_1fr_1.1fr_1fr] gap-4 border-b border-gray-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Name</span>
          <span>Email</span>
          <span>Phone</span>
          <span>Program</span>
          <span>DOB</span>
          <span>Recent Order</span>
          <span>Company</span>
          <span>Program Type</span>
        </div>

        <div>
          {customers?.map((customer) => {
            const program = customer.program;
            const recentOrderDate = recentOrderByCustomer.get(customer.id) || null;

            return (
              <Link
                key={customer.id}
                href={`/customers/${customer.id}`}
                className="block border-b border-gray-100 px-4 py-4 transition hover:bg-gray-50"
              >
                <div className="grid gap-4 xl:grid-cols-[1.3fr_1.2fr_1fr_1.2fr_0.9fr_1fr_1.1fr_1fr]">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">Name</p>
                    <p className="font-medium text-gray-900">
                      {customer.first_name} {customer.last_name}
                    </p>
                    {customer.notes && <p className="text-xs text-gray-500">{customer.notes}</p>}
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">Email</p>
                    <p className="break-all text-gray-600">{customer.email || '-'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">Phone</p>
                    <p className="text-gray-600">{customer.phone || '-'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">Program</p>
                    <p className="font-medium text-gray-900">{program?.company_name || 'Unassigned'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">DOB</p>
                    <p className="text-gray-600">{formatDate(customer.date_of_birth)}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">Recent Order</p>
                    <p className="text-gray-600">{formatDate(recentOrderDate)}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">Company</p>
                    <p className="text-gray-600">{program?.company_name || '-'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 xl:hidden">Program Type</p>
                    <p className="text-gray-600">{getProgramTypeLabel(program)}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {(!customers || customers.length === 0) && (
          <div className="px-4 py-12 text-center text-gray-400">No customers yet</div>
        )}
      </div>
    </div>
  );
}
