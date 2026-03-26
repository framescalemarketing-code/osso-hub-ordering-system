import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth';
import type { Customer, Order, Program } from '@/lib/types';

type CustomerListItem = Pick<
  Customer,
  'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'date_of_birth' | 'created_at' | 'notes'
> & {
  program?: Pick<Program, 'id' | 'company_name' | 'approval_required' | 'invoice_terms' | 'program_type'> | null;
};

type RecentOrderRow = Pick<Order, 'customer_id' | 'created_at'>;

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function getProgramTypeLabel(program?: { approval_required: boolean; program_type?: string | null } | null) {
  if (!program) return 'Unassigned';
  return program.program_type?.trim() || (program.approval_required ? 'Approval Required' : 'Direct');
}

function getProgramLabel(program?: { id: string } | null) {
  return program?.id ? 'Company Program' : 'Retail';
}

export default async function CustomersPage() {
  const supabase = await createServerSupabaseClient();
  const employee = await getCurrentEmployee();
  const canViewSensitive = ['admin', 'manager', 'optician'].includes(employee?.role || '');

  const [customersRes, ordersRes] = await Promise.all([
    supabase
      .from('customers')
      .select('id, first_name, last_name, email, phone, date_of_birth, created_at, notes, program:programs(id, company_name, approval_required, invoice_terms, program_type)')
      .eq('is_active', true)
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
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2a1f12]">Customers</h1>
          <p className="mt-1 text-sm text-[#6f5b40]">
            Click any customer to open their profile, recent orders, and notes.
          </p>
        </div>
      </div>

      <div className="pos-panel-strong overflow-hidden">
        <div className="hidden gap-4 border-b border-[#e4d4ba] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#7d6541] xl:grid xl:grid-cols-[1.3fr_1.2fr_1fr_1.2fr_1fr_1fr_0.9fr]">
          <span>Name</span>
          <span>Email</span>
          <span>Phone</span>
          <span>Company</span>
          <span>Program Type</span>
          <span>Recent Order</span>
          <span>Created</span>
        </div>

        <div>
          {customers?.map((customer) => {
            const program = customer.program;
            const recentOrderDate = recentOrderByCustomer.get(customer.id) || null;

            return (
              <Link
                key={customer.id}
                href={`/customers/${customer.id}`}
                className="block border-b border-[#f1e5d3] px-4 py-4 transition hover:bg-[#fffcf7]"
              >
                <div className="grid gap-4 xl:grid-cols-[1.3fr_1.2fr_1fr_1.2fr_1fr_1fr_0.9fr]">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9f8968] xl:hidden">Name</p>
                    <p className="font-semibold text-[#2f2416]">
                      {customer.first_name} {customer.last_name}
                    </p>
                    {customer.notes && <p className="text-xs text-[#6f5b40]">{customer.notes}</p>}
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9f8968] xl:hidden">Email</p>
                    <p className="break-all text-[#6f5b40]">{canViewSensitive ? customer.email || '-' : 'Restricted'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9f8968] xl:hidden">Phone</p>
                    <p className="text-[#6f5b40]">{canViewSensitive ? customer.phone || '-' : 'Restricted'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9f8968] xl:hidden">Company</p>
                    <p className="font-semibold text-[#2f2416]">{program?.company_name || getProgramLabel(program)}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9f8968] xl:hidden">Program Type</p>
                    <p className="text-[#6f5b40]">{getProgramTypeLabel(program)}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9f8968] xl:hidden">Recent Order</p>
                    <p className="text-[#6f5b40]">{formatDate(recentOrderDate)}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9f8968] xl:hidden">Created</p>
                    <p className="text-[#6f5b40]">{formatDate(customer.created_at)}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {(!customers || customers.length === 0) && (
          <div className="px-4 py-12 text-center text-[#7b6340]">No customers yet</div>
        )}
      </div>
    </div>
  );
}
