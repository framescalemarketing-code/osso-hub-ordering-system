'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import CustomerIntakeForm from '@/components/CustomerIntakeForm';
import type { CustomerIntakeContext } from '@/components/CustomerIntakeForm';
import PrescriptionForm from '@/components/PrescriptionForm';
import GlassesOrderItems from '@/components/GlassesOrderItems';
import type { Customer, Prescription, OrderItem, Program } from '@/lib/types';

type Step = 'customer' | 'prescription' | 'items' | 'review';

export default function NewOrderPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [step, setStep] = useState<Step>('customer');
  const [orderType, setOrderType] = useState<'regular' | 'program'>('regular');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [items, setItems] = useState<Partial<OrderItem>[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [intakeContext, setIntakeContext] = useState<CustomerIntakeContext>({
    eligibility_status: 'unknown',
    eligibility_reason: null,
    enrollment_id: null,
  });

  useEffect(() => {
    supabase.from('programs').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setPrograms(data as Program[]);
    });
  }, [supabase]);

  async function handleSubmitOrder() {
    if (!customer || items.length === 0) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_type: orderType,
          customer_id: customer.id,
          program_id: selectedProgramId,
          prescription_id: prescription?.id,
          items,
          discount,
          shipping_address: customer.address,
          requires_eligibility_review: shouldForceApproval,
          eligibility_reason: intakeContext.eligibility_reason,
          intake_enrollment_id: intakeContext.enrollment_id,
          program_guidelines_snapshot:
            orderType === 'program' ? (selectedProgram?.restricted_guidelines || null) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create order');
      }

      const { order } = await res.json();
      router.push(`/orders/${order.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
      setSubmitting(false);
    }
  }

  const subtotal = items.reduce((sum, i) => sum + (Number(i.line_total) || 0), 0);
  const effectiveDiscount = Math.min(Math.max(discount, 0), subtotal);
  const taxableSubtotal = Math.max(subtotal - effectiveDiscount, 0);
  const tax = taxableSubtotal * 0.0875;
  const total = taxableSubtotal + tax;
  const selectedProgram = programs.find((p) => p.id === selectedProgramId) || null;
  const shouldForceApproval = orderType === 'program' && intakeContext.eligibility_status !== 'eligible';

  return (
    <div>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-[#2a1f12]">New Order</h1>

      {/* Order Type Toggle */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => setOrderType('regular')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            orderType === 'regular'
              ? 'bg-linear-to-r from-[#8f6d3f] to-[#725326] text-white shadow-[0_10px_20px_rgba(77,54,24,0.2)]'
              : 'border border-[#ccb089] bg-white/85 text-[#5a4428] hover:bg-white'
          }`}
        >
          Regular Customer
        </button>
        <button
          onClick={() => setOrderType('program')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            orderType === 'program'
              ? 'bg-linear-to-r from-[#8f6d3f] to-[#725326] text-white shadow-[0_10px_20px_rgba(77,54,24,0.2)]'
              : 'border border-[#ccb089] bg-white/85 text-[#5a4428] hover:bg-white'
          }`}
        >
          Company Employee
        </button>
      </div>

      {/* Company Selector */}
      {orderType === 'program' && (
        <div className="mb-6 space-y-4">
          <div>
            <label className="pos-label">Company</label>
            <select
              value={selectedProgramId || ''}
              onChange={e => setSelectedProgramId(e.target.value || null)}
              className="pos-input max-w-md"
            >
              <option value="">Select a company...</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.company_name}</option>
              ))}
            </select>
          </div>

          {selectedProgram && (
            <div className="rounded-xl border border-[#d9c7a7] bg-[#fffdf8] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7d6541]">Company Presets Attached</p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm text-[#5f492a]">
                <p>
                  <span className="font-semibold text-[#2f2416]">EU Package:</span> {selectedProgram.eu_package || '-'}
                </p>
                <p>
                  <span className="font-semibold text-[#2f2416]">Service Tier:</span> {selectedProgram.service_tier || '-'}
                </p>
                <p>
                  <span className="font-semibold text-[#2f2416]">Approval Flow:</span>{' '}
                  {selectedProgram.approval_required ? 'Required' : 'Conditional'}
                </p>
              </div>
              <p className="mt-2 text-sm text-[#5f492a]">
                <span className="font-semibold text-[#2f2416]">Guidelines:</span>{' '}
                {selectedProgram.restricted_guidelines || 'No company-specific guidelines entered.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step Indicators */}
      <div className="mb-8 overflow-x-auto">
        <div className="flex min-w-max gap-2 pb-1">
          {(['customer', 'prescription', 'items', 'review'] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                step === s ? 'border border-[#c9b08a] bg-[#f7efe3] text-[#5c4220]' :
                (['customer', 'prescription', 'items', 'review'].indexOf(step) > i)
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border border-[#e5d5bb] bg-white/80 text-[#7d6541]'
              }`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#efe1cc] text-xs font-bold text-[#5a4322]">
                {i + 1}
              </span>
              <span className="capitalize">{s}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
      )}

      {/* Step Content */}
      {step === 'customer' && (
        <CustomerIntakeForm
          onComplete={(c, context) => {
            setCustomer(c);
            if (context) setIntakeContext(context);
            setStep('prescription');
          }}
          existingCustomer={customer}
          orderType={orderType}
          selectedProgram={selectedProgram}
        />
      )}

      {step === 'prescription' && customer && (
        <PrescriptionForm
          customerId={customer.id}
          orderType={orderType}
          programId={selectedProgramId}
          onComplete={(rx) => { setPrescription(rx); setStep('items'); }}
          onSkip={() => setStep('items')}
        />
      )}

      {step === 'items' && (
        <GlassesOrderItems
          items={items}
          onChange={setItems}
          onComplete={() => setStep('review')}
        />
      )}

      {step === 'review' && (
        <div className="space-y-6">
          <div className="pos-panel-strong p-6">
            <h2 className="mb-4 text-lg font-bold text-[#2a1f12]">Order Summary</h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-[#7d6541]">Customer</p>
                <p className="font-semibold text-[#322616]">{customer?.first_name} {customer?.last_name}</p>
              </div>
              <div>
                <p className="text-sm text-[#7d6541]">Order Type</p>
                <p className="font-semibold capitalize text-[#322616]">{orderType}</p>
              </div>
              {prescription && (
                <div>
                  <p className="text-sm text-[#7d6541]">Prescription</p>
                  <p className="font-semibold text-[#322616]">Rx on file</p>
                </div>
              )}
              {selectedProgramId && (
                <div>
                  <p className="text-sm text-[#7d6541]">Company</p>
                  <p className="font-semibold text-[#322616]">{programs.find(p => p.id === selectedProgramId)?.company_name}</p>
                </div>
              )}
              {orderType === 'program' && (
                <div>
                  <p className="text-sm text-[#7d6541]">Eligibility Status</p>
                  <p className="font-semibold text-[#322616]">
                    {intakeContext.eligibility_status === 'eligible' ? 'Eligible' : intakeContext.eligibility_status === 'not_eligible' ? 'Not eligible (supervisor approval required)' : 'Unknown (approval required)'}
                  </p>
                </div>
              )}
            </div>

            {orderType === 'regular' && (
              <div className="mb-4 max-w-xs">
                <label className="pos-label">Discount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(Number(e.target.value) || 0, 0))}
                  className="pos-input"
                />
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="mb-4 w-full min-w-140 text-sm">
                <thead>
                  <tr className="border-b border-[#e4d4ba] text-xs uppercase tracking-wide text-[#7d6541]">
                    <th className="text-left py-2">Item</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-right py-2">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-[#f1e5d3]">
                      <td className="py-2">{item.frame_brand} {item.frame_model}</td>
                      <td className="py-2 capitalize">{item.glasses_type?.replace(/_/g, ' ')}</td>
                      <td className="py-2 text-right font-semibold text-[#3b2c1b]">${Number(item.line_total || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-right text-sm text-[#5f492a]">
              <p>Subtotal: <span className="font-medium">${subtotal.toFixed(2)}</span></p>
              {effectiveDiscount > 0 && (
                <p>Discount: <span className="font-medium">-${effectiveDiscount.toFixed(2)}</span></p>
              )}
              <p>Tax (8.75%): <span className="font-medium">${tax.toFixed(2)}</span></p>
              <p className="mt-2 text-lg font-extrabold text-[#2a1f12]">Total: ${total.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setStep('items')}
              className="pos-btn-secondary px-6 py-3"
            >
              Back
            </button>
            <button
              onClick={handleSubmitOrder}
              disabled={submitting}
              className="rounded-xl bg-linear-to-r from-[#0f766e] to-[#115e59] px-6 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Creating Order...' : orderType === 'program' ? 'Submit Company Order' : 'Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
