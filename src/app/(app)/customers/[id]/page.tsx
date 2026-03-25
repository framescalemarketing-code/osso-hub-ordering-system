import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Address, Customer, Order, Prescription, Program } from '@/lib/types';
import CustomerProfileManager from '@/components/CustomerProfileManager';

type CustomerDetail = Customer & {
  program?: Pick<
    Program,
    'id' | 'company_name' | 'approval_required' | 'invoice_terms' | 'notes' | 'billing_address' | 'shipping_address' | 'program_type'
  > | null;
  orders?: Array<
    Pick<
      Order,
      'id' | 'order_number' | 'order_type' | 'status' | 'total' | 'created_at' | 'internal_notes' | 'customer_notes'
    > & {
      program?: Pick<Program, 'company_name'> | null;
    }
  >;
  prescriptions?: Prescription[];
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

type CustomerProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerProfilePage({ params }: CustomerProfilePageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: customer } = await supabase
    .from('customers')
    .select(
      '*, program:programs(id, company_name, approval_required, invoice_terms, notes, billing_address, shipping_address, program_type), orders:orders(id, order_number, order_type, status, total, created_at, internal_notes, customer_notes, program:programs(company_name)), prescriptions:prescriptions(*)'
    )
    .eq('id', id)
    .single();

  const typedCustomer = customer as CustomerDetail | null;

  if (!typedCustomer) notFound();

  const recentOrders = [...(typedCustomer.orders || [])].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );
  const recentPrescriptions = [...(typedCustomer.prescriptions || [])].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );
  const latestPrescription = recentPrescriptions[0] || null;
  const recentOrderDate = recentOrders[0]?.created_at || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Link href="/customers" className="text-sm text-gray-500 hover:text-gray-800">
          {'<- Customers'}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {typedCustomer.first_name} {typedCustomer.last_name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">{typedCustomer.email || 'No email on file'}</p>
          </div>
          <div className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
            Recent order: {formatDate(recentOrderDate)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium text-gray-900">{typedCustomer.phone || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Date of Birth</p>
                <p className="font-medium text-gray-900">{formatDate(typedCustomer.date_of_birth)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Company</p>
                <p className="font-medium text-gray-900">{typedCustomer.program?.company_name || typedCustomer.employer || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Company Type</p>
                <p className="font-medium text-gray-900">{getProgramTypeLabel(typedCustomer.program)}</p>
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
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatMoney(order.total)}</p>
                        <p className="text-xs text-gray-500">Total</p>
                      </div>
                    </div>
                    {(order.customer_notes || order.internal_notes) && (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Customer Notes</p>
                          <p className="text-sm text-gray-600">{order.customer_notes || 'None recorded'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Internal Notes</p>
                          <p className="text-sm text-gray-600">{order.internal_notes || 'None recorded'}</p>
                        </div>
                      </div>
                    )}
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
              <h2 className="text-lg font-semibold">Latest Prescription</h2>
              <p className="text-sm text-gray-500">{latestPrescription ? formatDate(latestPrescription.created_at) : 'No prescription on file'}</p>
            </div>

            {latestPrescription ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Right Eye</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <p className="text-gray-500">Sphere</p>
                      <p className="font-medium text-right">{latestPrescription.od_sphere ?? '-'}</p>
                      <p className="text-gray-500">Cylinder</p>
                      <p className="font-medium text-right">{latestPrescription.od_cylinder ?? '-'}</p>
                      <p className="text-gray-500">Axis</p>
                      <p className="font-medium text-right">{latestPrescription.od_axis ?? '-'}</p>
                      <p className="text-gray-500">Add</p>
                      <p className="font-medium text-right">{latestPrescription.od_add ?? '-'}</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Left Eye</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <p className="text-gray-500">Sphere</p>
                      <p className="font-medium text-right">{latestPrescription.os_sphere ?? '-'}</p>
                      <p className="text-gray-500">Cylinder</p>
                      <p className="font-medium text-right">{latestPrescription.os_cylinder ?? '-'}</p>
                      <p className="text-gray-500">Axis</p>
                      <p className="font-medium text-right">{latestPrescription.os_axis ?? '-'}</p>
                      <p className="text-gray-500">Add</p>
                      <p className="font-medium text-right">{latestPrescription.os_add ?? '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-gray-500">PD Distance</p>
                    <p className="font-medium text-gray-900">{latestPrescription.pd_distance ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Prescriber</p>
                    <p className="font-medium text-gray-900">{latestPrescription.prescriber_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Rx Expires</p>
                    <p className="font-medium text-gray-900">{formatDate(latestPrescription.expiration_date)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Prescription Notes</p>
                  <p className="mt-1 text-sm text-gray-700">{latestPrescription.notes || 'No notes recorded'}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
                No prescription on file
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-500">Profile</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500">Company</p>
                <p className="font-medium text-gray-900">{typedCustomer.program?.company_name || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-gray-500">Recent Order Date</p>
                <p className="font-medium text-gray-900">{formatDate(recentOrderDate)}</p>
              </div>
              <div>
                <p className="text-gray-500">Customer Notes</p>
                <p className="font-medium text-gray-900">{typedCustomer.notes || 'None recorded'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-500">Address</h3>
            <p className="whitespace-pre-line text-sm text-gray-700">{formatAddress(typedCustomer.address)}</p>
          </div>

          {typedCustomer.program && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-500">Company Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500">Company</p>
                  <p className="font-medium text-gray-900">{typedCustomer.program.company_name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Invoice Terms</p>
                  <p className="font-medium text-gray-900">{typedCustomer.program.invoice_terms || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Restricted Guidelines</p>
                  <p className="font-medium text-gray-900">{typedCustomer.program.notes || 'Not specified'}</p>
                </div>
              </div>
            </div>
          )}

          <CustomerProfileManager
            id={typedCustomer.id}
            first_name={typedCustomer.first_name}
            last_name={typedCustomer.last_name}
            email={typedCustomer.email}
            phone={typedCustomer.phone}
            date_of_birth={typedCustomer.date_of_birth}
            employer={typedCustomer.employer}
            notes={typedCustomer.notes}
            address={typedCustomer.address}
          />
        </div>
      </div>
    </div>
  );
}
