import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import OrderActions from '@/components/OrderActions';
import type { Approval, Customer, Employee, Order, OrderItem, Prescription, Program } from '@/lib/types';

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

  const { data: order } = await supabase
    .from('orders')
    .select(
      '*, customer:customers(*), employee:employees(first_name, last_name), program:programs(company_name, invoice_terms), prescription:prescriptions(*), items:order_items(*), approvals:approvals(*)'
    )
    .eq('id', id)
    .single();
  const typedOrder = order as OrderDetail | null;

  if (!typedOrder) notFound();

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/orders" className="text-sm text-gray-500 hover:text-gray-800">
            {'<- Orders'}
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{typedOrder.order_number}</h1>
        </div>
        <OrderActions order={typedOrder} employeeRole={employee?.role || 'readonly'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                typedOrder.status === 'completed' ? 'bg-green-100 text-green-700' :
                typedOrder.status === 'pending_approval' ? 'bg-amber-100 text-amber-700' :
                typedOrder.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                'bg-blue-100 text-blue-700'
              }`}>{typedOrder.status.replace(/_/g, ' ')}</span>
              <span className="text-sm text-gray-500 capitalize">{typedOrder.order_type} order</span>
            </div>

            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-gray-500">Subtotal</p>
                <p className="font-medium">${Number(typedOrder.subtotal).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500">Tax</p>
                <p className="font-medium">${Number(typedOrder.tax).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500">Discount</p>
                <p className="font-medium">${Number(typedOrder.discount).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500">Total</p>
                <p className="text-xl font-bold">${Number(typedOrder.total).toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Items</h2>
            <div className="space-y-3">
              {typedOrder.items?.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{item.frame_brand} {item.frame_model}</p>
                    <p className="text-sm text-gray-500 capitalize break-words">
                      {item.glasses_type?.replace(/_/g, ' ')} - {item.lens_type} - {item.lens_material}
                    </p>
                    {item.lens_vendor && (
                      <p className="mt-1 text-xs text-blue-600 break-all">
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
                {typedOrder.approvals.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 p-3 text-sm">
                    <span className="break-all">{a.approver_email}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      a.status === 'approved' ? 'bg-green-100 text-green-700' :
                      a.status === 'rejected' ? 'bg-red-100 text-red-600' :
                      'bg-amber-100 text-amber-700'
                    }`}>{a.status}</span>
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
            <p className="text-sm text-gray-500 break-all">{typedOrder.customer?.email}</p>
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

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-500">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Created by</span>
                <span className="text-right">
                  {typedOrder.employee?.first_name} {typedOrder.employee?.last_name}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-500">Created</span>
                <span className="text-right">{new Date(typedOrder.created_at).toLocaleString()}</span>
              </div>
              {typedOrder.invoice_number && (
                <div className="flex items-start justify-between gap-3">
                  <span className="text-gray-500">Invoice</span>
                  <span className="text-right break-all">{typedOrder.invoice_number}</span>
                </div>
              )}
              {typedOrder.clickup_task_id && (
                <div className="flex items-start justify-between gap-3">
                  <span className="text-gray-500">ClickUp</span>
                  <span className="text-right break-all text-blue-600">{typedOrder.clickup_task_id}</span>
                </div>
              )}
              {typedOrder.tracking_number && (
                <div className="flex items-start justify-between gap-3">
                  <span className="text-gray-500">Tracking</span>
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
