import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Address, Customer, Order, Program } from '@/lib/types';

type ProgramDetail = Program & {
  orders?: Array<
    Pick<Order, 'id' | 'order_number' | 'order_type' | 'status' | 'total' | 'created_at'> & {
      customer?: Pick<Customer, 'first_name' | 'last_name' | 'email'> | null;
    }
  >;
  members?: Array<{
    id: string;
    status: string;
    employee_first_name: string;
    employee_last_name: string;
    employee_email: string | null;
    employee_external_id: string | null;
    effective_from: string;
    effective_to: string | null;
    customer?: Pick<Customer, 'id' | 'first_name' | 'last_name' | 'email' | 'phone'> | null;
  }>;
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-';
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
}

function formatAddress(address?: Address | null) {
  if (!address) return 'Not provided';
  return [address.street, `${address.city}, ${address.state} ${address.zip}`].filter(Boolean).join('\n');
}

function getProgramTypeLabel(program?: { approval_required: boolean; program_type?: string | null } | null) {
  if (!program) return 'Unassigned';
  return program.program_type?.trim() || (program.approval_required ? 'Approval Required' : 'Direct');
}

type ProgramDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProgramDetailPage({ params }: ProgramDetailPageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: program } = await supabase
    .from('programs')
    .select(
      '*, orders:orders(id, order_number, order_type, status, total, created_at, customer:customers(first_name, last_name, email)), members:program_enrollments(id, status, employee_first_name, employee_last_name, employee_email, employee_external_id, effective_from, effective_to, customer:customers(id, first_name, last_name, email, phone))'
    )
    .eq('id', id)
    .single();

  const typedProgram = program as ProgramDetail | null;

  if (!typedProgram) notFound();

  const recentOrders = [...(typedProgram.orders || [])].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );
  const activeMembers = (typedProgram.members || []).filter((member) => member.status === 'active');
  const primaryAddress = typedProgram.billing_address || typedProgram.shipping_address;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Link href="/programs" className="text-sm text-gray-500 hover:text-gray-800">
          {'<- Programs'}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{typedProgram.company_name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {typedProgram.contact_name || 'No contact name'} - {typedProgram.contact_email || 'No contact email'}
            </p>
          </div>
          <div className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
            {getProgramTypeLabel(typedProgram)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-gray-500">POC Name</p>
                <p className="font-medium text-gray-900">{typedProgram.contact_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">POC Email</p>
                <p className="break-all font-medium text-gray-900">{typedProgram.contact_email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Employee Count</p>
                <p className="font-medium text-gray-900">{activeMembers.length} active member{activeMembers.length === 1 ? '' : 's'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Invoice Terms</p>
                <p className="font-medium text-gray-900">{typedProgram.invoice_terms || '-'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Recent Orders</h2>
              <p className="text-sm text-gray-500">{recentOrders.length} total</p>
            </div>

            <div className="space-y-3">
              {recentOrders.length > 0 ? (
                recentOrders.slice(0, 6).map((order) => (
                  <div key={order.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Link href={`/orders/${order.id}`} className="font-medium text-blue-600 hover:underline">
                          {order.order_number}
                        </Link>
                        <p className="text-sm text-gray-500 capitalize">
                          {order.order_type} order, {order.status.replace(/_/g, ' ')}
                        </p>
                        <p className="text-sm text-gray-500">{formatDateTime(order.created_at)}</p>
                        <p className="text-sm text-gray-500">
                          {order.customer?.first_name} {order.customer?.last_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatMoney(order.total)}</p>
                        <p className="text-xs text-gray-500">Total</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
                  No orders yet
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Active Members</h2>
              <p className="text-sm text-gray-500">{activeMembers.length} enrolled</p>
            </div>

            <div className="space-y-3">
              {activeMembers.length > 0 ? (
                activeMembers.slice(0, 10).map((member) => (
                  <div key={member.id} className="rounded-lg bg-gray-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {member.employee_first_name} {member.employee_last_name}
                        </p>
                        <p className="text-sm text-gray-500">{member.employee_email || member.employee_external_id || 'No email on file'}</p>
                        <p className="text-xs text-gray-500">Effective from {formatDate(member.effective_from)}</p>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <p>{member.customer ? 'Linked customer' : 'No customer link'}</p>
                        <p>{member.effective_to ? `Ends ${formatDate(member.effective_to)}` : 'Active'}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
                  No active members
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-500">Location</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-gray-500">Primary Address</p>
                <p className="whitespace-pre-line font-medium text-gray-900">{formatAddress(primaryAddress)}</p>
              </div>
              <div>
                <p className="text-gray-500">Billing Address</p>
                <p className="whitespace-pre-line font-medium text-gray-900">{formatAddress(typedProgram.billing_address)}</p>
              </div>
              <div>
                <p className="text-gray-500">Shipping Address</p>
                <p className="whitespace-pre-line font-medium text-gray-900">{formatAddress(typedProgram.shipping_address)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-500">Restricted Guidelines</h3>
            <p className="whitespace-pre-line text-sm text-gray-700">
              {typedProgram.notes || 'No restricted guidelines recorded yet.'}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-500">Loyalty / Referral Credits</h3>
            <p className="text-2xl font-bold text-gray-900">
              {typeof typedProgram.credit_count === 'number' ? typedProgram.credit_count : 'Not tracked'}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              No credit ledger column exists yet, so this safely falls back until the schema is extended.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-500">Program Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500">Program Type</p>
                <p className="font-medium text-gray-900">{getProgramTypeLabel(typedProgram)}</p>
              </div>
              <div>
                <p className="text-gray-500">Approval Required</p>
                <p className="font-medium text-gray-900">{typedProgram.approval_required ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-gray-500">Invoice Terms</p>
                <p className="font-medium text-gray-900">{typedProgram.invoice_terms || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

