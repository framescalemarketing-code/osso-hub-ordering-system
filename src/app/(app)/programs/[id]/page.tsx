import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth';
import { normalizeEuPackageLabel, normalizeServiceTierLabel } from '@/lib/ordering-domain';
import type { Address, Customer, Order, Program } from '@/lib/types';
import CompanyProfileManager from '@/components/CompanyProfileManager';
import { getProgramCanonicalContext } from '@/lib/programs/service';
import {
  calculateEuPackagePerEmployee,
  calculateServiceTierPerEmployee,
  safeParsePriceAdjustments,
  type EUPackageAddOnKey,
} from '@/lib/pricing';
import { formatInvoiceTerms } from '@/lib/program-options';

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

type CompanyDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProgramDetailPage({ params }: CompanyDetailPageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const employee = await getCurrentEmployee();
  const canManage = ['admin', 'manager', 'sales', 'optician'].includes(employee?.role || '');

  const { data: program } = await supabase
    .from('programs')
    .select(
      '*, orders:orders(id, order_number, order_type, status, total, created_at, customer:customers(first_name, last_name, email)), members:program_enrollments(id, status, employee_first_name, employee_last_name, employee_email, employee_external_id, effective_from, effective_to, customer:customers(id, first_name, last_name, email, phone))'
    )
    .eq('id', id)
    .single();

  const typedProgram = program as ProgramDetail | null;

  if (!typedProgram) notFound();
  const canonicalContext = await getProgramCanonicalContext(supabase, id);

  const recentOrders = [...(typedProgram.orders || [])].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );
  const activeMembers = (typedProgram.members || []).filter((member) => member.status === 'active');
  const primaryAddress = typedProgram.billing_address || typedProgram.shipping_address;
  const parsedEuAdjustments = safeParsePriceAdjustments(typedProgram.eu_package_custom_adjustments);
  const parsedServiceAdjustments = safeParsePriceAdjustments(typedProgram.service_tier_custom_adjustments);
  const normalizedEuPackage = normalizeEuPackageLabel(typedProgram.eu_package);
  const normalizedServiceTier = normalizeServiceTierLabel(typedProgram.service_tier);
  const euPerEmployee = normalizedEuPackage
    ? calculateEuPackagePerEmployee(normalizedEuPackage, (typedProgram.eu_package_add_ons || []) as EUPackageAddOnKey[], parsedEuAdjustments)
    : null;
  const servicePerEmployee = normalizedServiceTier
    ? calculateServiceTierPerEmployee(normalizedServiceTier, parsedServiceAdjustments)
    : null;
  const totalPerEmployee =
    euPerEmployee !== null && servicePerEmployee !== null ? euPerEmployee + servicePerEmployee : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Link href="/programs" className="text-sm font-semibold text-[#7d6541] hover:text-[#48341f]">
          {'<- Companies'}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#2a1f12]">{typedProgram.company_name}</h1>
            <p className="mt-1 text-sm text-[#6f5b40]">
              {typedProgram.company_code || 'No company code'} - {typedProgram.contact_email || 'No contact email'}
            </p>
          </div>
          <div className="rounded-full border border-[#ccb089] bg-[#fff8ec] px-3 py-1.5 text-sm font-semibold text-[#6f522d]">
            {getProgramTypeLabel(typedProgram)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="pos-panel p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-gray-500">Company Code</p>
                <p className="font-medium text-gray-900">{typedProgram.company_code || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Point of Contact</p>
                <p className="font-medium text-gray-900">{typedProgram.contact_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Point of Contact Email</p>
                <p className="break-all font-medium text-gray-900">{typedProgram.contact_email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Employee Count</p>
                <p className="font-medium text-gray-900">{activeMembers.length} active member{activeMembers.length === 1 ? '' : 's'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Net Terms</p>
                <p className="font-medium text-gray-900">{formatInvoiceTerms(typedProgram.invoice_terms)}</p>
              </div>
            </div>
          </div>

          <div className="pos-panel p-6">
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

          <div className="pos-panel p-6">
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
          <div className="pos-panel p-6">
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

          <div className="pos-panel p-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-500">Company Guidelines</h3>
            <p className="whitespace-pre-line text-sm text-gray-700">
              {typedProgram.restricted_guidelines || typedProgram.notes || 'No company guidelines recorded yet.'}
            </p>
          </div>

          <div className="pos-panel p-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-500">EU Package + Service Pricing</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>EU Package: <span className="font-medium">{normalizedEuPackage || typedProgram.eu_package || '-'}</span></p>
              <p>Service Tier: <span className="font-medium">{normalizedServiceTier || typedProgram.service_tier || '-'}</span></p>
              <p>EU allowance per employee: <span className="font-medium">{euPerEmployee !== null ? `$${euPerEmployee.toFixed(2)}` : '-'}</span></p>
              <p>Service fee per employee: <span className="font-medium">{servicePerEmployee !== null ? `$${servicePerEmployee.toFixed(2)}` : '-'}</span></p>
              <p>Total per employee: <span className="font-medium">{totalPerEmployee !== null ? `$${totalPerEmployee.toFixed(2)}` : '-'}</span></p>
            </div>
          </div>

          <div className="pos-panel p-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-500">Loyalty / Referral Credits</h3>
            <p className="text-2xl font-bold text-gray-900">
              {(Number(typedProgram.loyalty_credit_count || 0) + Number(typedProgram.referral_credit_count || 0)).toString()}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Loyalty: {typedProgram.loyalty_credit_count || 0} / Referral: {typedProgram.referral_credit_count || 0}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-500">Company Details</h3>
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
                <p className="text-gray-500">Net Terms</p>
                <p className="font-medium text-gray-900">{formatInvoiceTerms(typedProgram.invoice_terms)}</p>
              </div>
            </div>
          </div>

          {canManage && (
            <CompanyProfileManager
              id={typedProgram.id}
              company_name={typedProgram.company_name}
              company_code={typedProgram.company_code || null}
              contact_name={typedProgram.contact_name}
              contact_email={typedProgram.contact_email}
              contact_phone={typedProgram.contact_phone}
              invoice_terms={typedProgram.invoice_terms}
              approval_required={typedProgram.approval_required}
              approver_emails={typedProgram.approver_emails || []}
              program_type={typedProgram.program_type || null}
              employee_count={typedProgram.employee_count || activeMembers.length}
              restricted_guidelines={typedProgram.restricted_guidelines || typedProgram.notes}
              loyalty_credit_count={typedProgram.loyalty_credit_count || 0}
              referral_credit_count={typedProgram.referral_credit_count || 0}
              eu_package={typedProgram.eu_package || null}
              eu_package_add_ons={(typedProgram.eu_package_add_ons || []) as EUPackageAddOnKey[]}
              eu_package_custom_adjustments={parsedEuAdjustments}
              service_tier={typedProgram.service_tier || null}
              service_tier_custom_adjustments={parsedServiceAdjustments}
              eligibility_fields={canonicalContext.eligibilityFields}
            />
          )}
        </div>
      </div>
    </div>
  );
}

