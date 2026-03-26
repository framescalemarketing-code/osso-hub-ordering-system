import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import OrderActions from '@/components/OrderActions';
import type { Approval, Customer, Employee, Order, OrderItem, Prescription, Program } from '@/lib/types';
import { formatInvoiceTerms } from '@/lib/program-options';

type OrderDetail = Order & {
  customer?: Customer | null;
  employee?: Pick<Employee, 'first_name' | 'last_name'> | null;
  program?: Pick<Program, 'company_name' | 'invoice_terms'> | null;
  prescription?: Prescription | null;
  items?: OrderItem[];
  approvals?: Approval[];
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const employee = await getCurrentEmployee();
  const canViewOperationalIds = ['admin', 'manager', 'optician'].includes(employee?.role || '');

  const { data: order } = await supabase
    .from('orders')
    .select(
      '*, customer:customers(*), employee:employees(first_name, last_name), program:programs(company_name, invoice_terms), prescription:prescriptions(*), items:order_items(*), approvals:approvals(*)'
    )
    .eq('id', id)
    .single();
  const typedOrder = order as OrderDetail | null;

  if (!typedOrder) notFound();

  function statusClass(status: string) {
    if (status === 'completed') return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    if (status === 'pending_approval') return 'bg-amber-50 text-amber-800 border border-amber-200';
    if (status === 'cancelled') return 'bg-rose-50 text-rose-700 border border-rose-200';
    return 'bg-[#f6efe3] text-[#5a4322] border border-[#d6c09b]';
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/orders" className="text-sm font-semibold text-[#7d6541] hover:text-[#48341f]">
            {'<- Orders'}
          </Link>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#2a1f12]">{typedOrder.order_number}</h1>
        </div>
        <OrderActions order={typedOrder} employeeRole={employee?.role || 'readonly'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="pos-panel-strong p-6">
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <span className={`pos-badge ${statusClass(typedOrder.status)}`}>{typedOrder.status.replace(/_/g, ' ')}</span>
              <span className="text-sm font-semibold capitalize text-[#6f5b40]">{typedOrder.order_type} order</span>
            </div>

            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[#7d6541]">Subtotal</p>
                <p className="font-semibold text-[#322616]">${Number(typedOrder.subtotal).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[#7d6541]">Tax</p>
                <p className="font-semibold text-[#322616]">${Number(typedOrder.tax).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[#7d6541]">Discount</p>
                <p className="font-semibold text-[#322616]">${Number(typedOrder.discount).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[#7d6541]">Total</p>
                <p className="text-xl font-extrabold text-[#2a1f12]">${Number(typedOrder.total).toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="pos-panel p-6">
            <h2 className="mb-4 text-lg font-bold text-[#2a1f12]">Items</h2>
            <div className="space-y-3">
              {typedOrder.items?.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-[#e5d5bb] bg-[#fffdf8] p-3.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="wrap-break-word font-semibold text-[#332515]">{item.frame_brand} {item.frame_model}</p>
                    <p className="wrap-break-word text-sm capitalize text-[#6f5b40]">
                      {item.glasses_type?.replace(/_/g, ' ')} - {item.lens_type} - {item.lens_material}
                    </p>
                    {item.lens_vendor && (
                      <p className="mt-1 break-all text-xs font-semibold text-[#0f766e]">
                        Lens vendor: {item.lens_vendor}{canViewOperationalIds && item.lens_order_id ? ` #${item.lens_order_id}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#322616]">${Number(item.line_total).toFixed(2)}</p>
                    <p className="text-xs text-[#7d6541]">Qty: {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {typedOrder.approvals && typedOrder.approvals.length > 0 && (
            <div className="pos-panel p-6">
              <h2 className="mb-4 text-lg font-bold text-[#2a1f12]">Approvals</h2>
              <div className="space-y-2">
                {typedOrder.approvals.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e5d5bb] bg-[#fffdf8] p-3 text-sm">
                    <span className="break-all">{a.approver_email}</span>
                    <span className={`pos-badge ${
                      a.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : a.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>{a.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="pos-panel p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#7d6541]">Customer</h3>
            <p className="font-semibold text-[#322616]">
              {typedOrder.customer?.first_name} {typedOrder.customer?.last_name}
            </p>
            <p className="break-all text-sm text-[#6f5b40]">{typedOrder.customer?.email}</p>
            <p className="text-sm text-[#6f5b40]">{typedOrder.customer?.phone}</p>
          </div>

          {typedOrder.program && (
            <div className="pos-panel p-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#7d6541]">Company</h3>
              <p className="font-semibold text-[#322616]">{typedOrder.program.company_name}</p>
              {typedOrder.program.invoice_terms && (
                <p className="text-sm text-[#6f5b40]">Net Terms: {formatInvoiceTerms(typedOrder.program.invoice_terms)}</p>
              )}
            </div>
          )}

          <div className="pos-panel p-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#7d6541]">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[#7d6541]">Created by</span>
                <span className="text-right">
                  {typedOrder.employee?.first_name} {typedOrder.employee?.last_name}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-[#7d6541]">Created</span>
                <span className="text-right">{new Date(typedOrder.created_at).toLocaleString()}</span>
              </div>
              {canViewOperationalIds && typedOrder.clickup_task_id && (
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[#7d6541]">ClickUp</span>
                  <span className="text-right break-all font-semibold text-[#0f766e]">{typedOrder.clickup_task_id}</span>
                </div>
              )}
              {canViewOperationalIds && typedOrder.tracking_number && (
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[#7d6541]">Tracking</span>
                  <span className="text-right break-all">{typedOrder.tracking_number}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
