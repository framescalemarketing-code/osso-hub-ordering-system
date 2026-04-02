import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import OrderActions from '@/components/OrderActions';
import type {
  Approval,
  Customer,
  Employee,
  Order,
  OrderIntake,
  OrderItem,
  OrderPricingSummary,
  Prescription,
  Program,
} from '@/lib/types';

type OrderDetail = Order & {
  customer?: Customer | null;
  employee?: Pick<Employee, 'first_name' | 'last_name'> | null;
  program?: Pick<Program, 'company_name' | 'invoice_terms'> | null;
  prescription?: Prescription | null;
  items?: OrderItem[];
  approvals?: Approval[];
};

function prettyLabel(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase());
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const employee = await getCurrentEmployee();

  const { data: order } = await supabase
    .from('orders')
    .select('*, customer:customers(*), employee:employees(first_name, last_name), program:programs(company_name, invoice_terms), prescription:prescriptions(*), items:order_items(*), approvals:approvals(*)')
    .eq('id', id)
    .single();
  const typedOrder = order as OrderDetail | null;

  if (!typedOrder) notFound();

  const intake = typedOrder.intake_payload as OrderIntake | null;
  const pricing = typedOrder.pricing_summary as OrderPricingSummary | null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/orders" className="text-sm text-gray-500 hover:text-gray-800">
            Back to orders
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{typedOrder.order_number}</h1>
        </div>
        <OrderActions order={typedOrder} employeeRole={employee?.role || 'readonly'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-4">
              <span
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  typedOrder.status === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : typedOrder.status === 'pending_approval'
                      ? 'bg-amber-100 text-amber-700'
                      : typedOrder.status === 'cancelled'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-blue-100 text-blue-700'
                }`}
              >
                {typedOrder.status.replace(/_/g, ' ')}
              </span>
              <span className="text-sm capitalize text-gray-500">{typedOrder.order_type} order</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <p className="text-gray-500">Total Fees</p>
                <p className="font-medium">${Number(pricing?.totalFees ?? typedOrder.subtotal).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500">Bill To</p>
                <p className="font-medium">${Number(pricing?.billTo ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500">OOP</p>
                <p className="font-medium">${Number(pricing?.oop ?? typedOrder.total).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500">OOP With Discount</p>
                <p className="text-xl font-bold">${Number(pricing?.oopWithDiscount ?? typedOrder.total).toFixed(2)}</p>
              </div>
            </div>
          </div>

          {pricing && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold">Backend Billing Summary</h2>
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span>Frame Category</span>
                  <span className="font-medium">{pricing.frameCategory}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span>Allowance Leftover</span>
                  <span className="font-medium">${Number(pricing.allowanceLeftover).toFixed(2)}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span>Lens Material</span>
                  <span className="font-medium">{pricing.lensMaterial}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span>Lens Color</span>
                  <span className="font-medium">{pricing.lensColor}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span>Program Year</span>
                  <span className="font-medium">{pricing.programYear}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span>Ready To File</span>
                  <span className="font-medium">{pricing.readyToFile ? 'Yes' : 'No'}</span>
                </div>
              </div>
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Fee Breakdown</h3>
                <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                  {Object.entries(pricing.feeBreakdown).map(([label, value]) => (
                    <div key={label} className="flex justify-between rounded-lg border border-gray-100 px-3 py-2">
                      <span>{prettyLabel(label)}</span>
                      <span className="font-medium">${Number(value).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Items</h2>
            <div className="space-y-3">
              {typedOrder.items?.map(item => (
                <div key={item.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <div>
                    <p className="font-medium">
                      {item.frame_brand} {item.frame_model}
                    </p>
                    <p className="text-sm capitalize text-gray-500">
                      {item.glasses_type?.replace(/_/g, ' ')} · {item.lens_type} · {item.lens_material}
                    </p>
                    {item.lens_vendor && (
                      <p className="mt-1 text-xs text-blue-600">
                        Lens vendor: {item.lens_vendor} {item.lens_order_id ? `#${item.lens_order_id}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${Number(item.line_total).toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {typedOrder.approvals && typedOrder.approvals.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold">Approvals</h2>
              <div className="space-y-2">
                {typedOrder.approvals.map(approval => (
                  <div key={approval.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm">
                    <span>{approval.approver_email}</span>
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        approval.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : approval.status === 'rejected'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {approval.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-500">Customer</h3>
            <p className="font-medium">
              {typedOrder.customer?.first_name} {typedOrder.customer?.last_name}
            </p>
            <p className="text-sm text-gray-500">{typedOrder.customer?.email}</p>
            <p className="text-sm text-gray-500">{typedOrder.customer?.phone}</p>
          </div>

          {typedOrder.program && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-500">Program</h3>
              <p className="font-medium">{typedOrder.program.company_name}</p>
              {typedOrder.program.invoice_terms && (
                <p className="text-sm text-gray-500">Terms: {typedOrder.program.invoice_terms}</p>
              )}
            </div>
          )}

          {intake && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-500">Submit To Bill Intake</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">EU ID</span>
                  <span>{intake.profile.euId || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Optician</span>
                  <span>{intake.profile.opticianName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dispense Type</span>
                  <span>{intake.authorization.dispenseType.replace(/-/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice Type</span>
                  <span>{intake.authorization.invoiceType.replace(/-/g, ' ')}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Frame Selected</span>
                  <span className="max-w-[12rem] text-right">{intake.product.frameSelected || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Submitted To Bill</span>
                  <span>{typedOrder.submitted_to_bill_at ? new Date(typedOrder.submitted_to_bill_at).toLocaleString() : '—'}</span>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-500">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Created by</span>
                <span>
                  {typedOrder.employee?.first_name} {typedOrder.employee?.last_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span>{new Date(typedOrder.created_at).toLocaleString()}</span>
              </div>
              {typedOrder.invoice_number && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice</span>
                  <span>{typedOrder.invoice_number}</span>
                </div>
              )}
              {typedOrder.clickup_task_id && (
                <div className="flex justify-between">
                  <span className="text-gray-500">ClickUp</span>
                  <span className="text-blue-600">{typedOrder.clickup_task_id}</span>
                </div>
              )}
              {typedOrder.tracking_number && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Tracking</span>
                  <span>{typedOrder.tracking_number}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
