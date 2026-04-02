'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import CustomerIntakeForm from '@/components/CustomerIntakeForm';
import PrescriptionForm from '@/components/PrescriptionForm';
import OrderIntakeForm from '@/components/OrderIntakeForm';
import { applyPrescriptionToIntake, createEmptyOrderIntake } from '@/lib/orders/intake';
import type { Customer, OrderIntake, OrderPricingSummary, Prescription, Program } from '@/lib/types';

type Step = 'customer' | 'prescription' | 'intake' | 'review';

export default function NewOrderPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [step, setStep] = useState<Step>('customer');
  const [orderType, setOrderType] = useState<'regular' | 'program'>('regular');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [intake, setIntake] = useState<OrderIntake>(() => createEmptyOrderIntake('regular'));
  const [quote, setQuote] = useState<OrderPricingSummary | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('programs').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setPrograms(data as Program[]);
    });
  }, [supabase]);

  useEffect(() => {
    setIntake(prev => ({
      ...createEmptyOrderIntake(orderType, customer?.id || '', prescription?.id || null),
      ...prev,
      orderType,
      customerId: customer?.id || '',
      prescriptionId: prescription?.id || null,
      authorization: {
        ...prev.authorization,
        invoiceType:
          prev.authorization.invoiceType === 'out-of-pocket' && orderType === 'program'
            ? 'program-allowance'
            : prev.authorization.invoiceType,
      },
      prescription: {
        ...prev.prescription,
        ...applyPrescriptionToIntake(prev, prescription).prescription,
      },
    }));
  }, [customer?.id, orderType, prescription]);

  async function fetchQuote(currentIntake: OrderIntake) {
    setQuoteLoading(true);
    setError('');

    try {
      const res = await fetch('/api/orders/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intake: currentIntake }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to calculate backend summary');
      }

      const data = await res.json();
      setQuote(data.summary as OrderPricingSummary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to calculate backend summary');
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }

  async function handleSubmitOrder() {
    if (!customer) return;
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
          intake: {
            ...intake,
            orderType,
            customerId: customer.id,
            prescriptionId: prescription?.id || null,
          },
          shipping_address: customer.address,
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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">New Order</h1>

      {/* Order Type Toggle */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={() => setOrderType('regular')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            orderType === 'regular' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Regular Customer
        </button>
        <button
          onClick={() => setOrderType('program')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            orderType === 'program' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Program Employee
        </button>
      </div>

      {/* Program Selector */}
      {orderType === 'program' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
          <select
            value={selectedProgramId || ''}
            onChange={e => setSelectedProgramId(e.target.value || null)}
            className="w-full max-w-md px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900"
          >
            <option value="">Select a program...</option>
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.company_name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Step Indicators */}
      <div className="mb-8 flex gap-2">
        {(['customer', 'prescription', 'intake', 'review'] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              step === s ? 'bg-blue-50 text-blue-600 border border-blue-200' :
              (['customer', 'prescription', 'intake', 'review'].indexOf(step) > i)
                ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs">
              {i + 1}
            </span>
            <span className="capitalize">{s}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-6">{error}</div>
      )}

      {/* Step Content */}
      {step === 'customer' && (
        <CustomerIntakeForm
          onComplete={(c) => {
            setCustomer(c);
            setIntake(prev => ({ ...prev, customerId: c.id }));
            setStep('prescription');
          }}
          existingCustomer={customer}
        />
      )}

      {step === 'prescription' && customer && (
        <PrescriptionForm
          customerId={customer.id}
          onComplete={(rx) => {
            setPrescription(rx);
            setIntake(applyPrescriptionToIntake({ ...intake, customerId: customer.id }, rx));
            setStep('intake');
          }}
          onSkip={() => setStep('intake')}
        />
      )}

      {step === 'intake' && customer && (
        <OrderIntakeForm
          intake={intake}
          onChange={setIntake}
          onComplete={async () => {
            const currentIntake = {
              ...intake,
              orderType,
              customerId: customer.id,
              prescriptionId: prescription?.id || null,
            };
            setIntake(currentIntake);
            await fetchQuote(currentIntake);
            setStep('review');
          }}
        />
      )}

      {step === 'review' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-500">Customer</p>
                <p className="font-medium">{customer?.first_name} {customer?.last_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Order Type</p>
                <p className="font-medium capitalize">{orderType}</p>
              </div>
              {prescription && (
                <div>
                  <p className="text-sm text-gray-500">Prescription</p>
                  <p className="font-medium">Rx on file</p>
                </div>
              )}
              {selectedProgramId && (
                <div>
                  <p className="text-sm text-gray-500">Program</p>
                  <p className="font-medium">{programs.find(p => p.id === selectedProgramId)?.company_name}</p>
                </div>
              )}
            </div>

            {quoteLoading && <p className="text-sm text-gray-500">Calculating backend summary...</p>}

            {quote && (
              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Intake Snapshot</h3>
                  <div className="grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-700 md:grid-cols-2">
                    <div>
                      <p className="text-gray-500">Frame Selected</p>
                      <p className="font-medium">{intake.product.frameSelected || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Invoice Type</p>
                      <p className="font-medium">{intake.authorization.invoiceType.replace(/-/g, ' ')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Lens Type</p>
                      <p className="font-medium">{intake.product.lensType || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Lens Material</p>
                      <p className="font-medium">{intake.product.lensMaterial || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Auth Status</p>
                      <p className="font-medium">{intake.authorization.authApprovalStatus.replace(/_/g, ' ')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Allowance</p>
                      <p className="font-medium">${Number(intake.authorization.allowance || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">Calculated On Backend</h3>
                  <div className="space-y-2 text-sm text-blue-900">
                    <div className="flex justify-between"><span>Total Fees</span><span className="font-semibold">${quote.totalFees.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Bill To</span><span className="font-semibold">${quote.billTo.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>OOP</span><span className="font-semibold">${quote.oop.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>OOP With Discount</span><span className="font-semibold">${quote.oopWithDiscount.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Allowance Leftover</span><span className="font-semibold">${quote.allowanceLeftover.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Frame Category</span><span className="font-semibold">{quote.frameCategory}</span></div>
                    <div className="flex justify-between"><span>Program Year</span><span className="font-semibold">{quote.programYear}</span></div>
                  </div>
                </div>
              </div>
            )}

            {quote && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Fee Breakdown</h3>
                <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
                  {Object.entries(quote.feeBreakdown).map(([label, value]) => (
                    <div key={label} className="flex justify-between rounded-lg bg-white px-3 py-2">
                      <span>{label.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</span>
                      <span className="font-medium">${Number(value).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('intake')}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition"
            >
              Back
            </button>
            <button
              onClick={handleSubmitOrder}
              disabled={submitting || quoteLoading || !quote}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-800 rounded-lg font-semibold transition"
            >
              {submitting ? 'Submitting To Bill...' : orderType === 'program' ? 'Submit To Bill' : 'Create Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
