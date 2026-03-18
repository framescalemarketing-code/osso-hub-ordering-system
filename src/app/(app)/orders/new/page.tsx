'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import CustomerIntakeForm from '@/components/CustomerIntakeForm';
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  const subtotal = items.reduce((sum, i) => sum + (Number(i.line_total) || 0), 0);
  const tax = subtotal * 0.0875; // CA sales tax
  const total = subtotal + tax;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">New Order</h1>

      {/* Order Type Toggle */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setOrderType('regular')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            orderType === 'regular' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          Regular Customer
        </button>
        <button
          onClick={() => setOrderType('program')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            orderType === 'program' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          Program Employee
        </button>
      </div>

      {/* Program Selector */}
      {orderType === 'program' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-1">Program</label>
          <select
            value={selectedProgramId || ''}
            onChange={e => setSelectedProgramId(e.target.value || null)}
            className="w-full max-w-md px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white"
          >
            <option value="">Select a program...</option>
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.company_name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Step Indicators */}
      <div className="flex gap-2 mb-8">
        {(['customer', 'prescription', 'items', 'review'] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              step === s ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' :
              (['customer', 'prescription', 'items', 'review'].indexOf(step) > i)
                ? 'bg-green-900/20 text-green-400' : 'bg-gray-800 text-gray-500'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs">
              {i + 1}
            </span>
            <span className="capitalize">{s}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm mb-6">{error}</div>
      )}

      {/* Step Content */}
      {step === 'customer' && (
        <CustomerIntakeForm
          onComplete={(c) => { setCustomer(c); setStep('prescription'); }}
          existingCustomer={customer}
        />
      )}

      {step === 'prescription' && customer && (
        <PrescriptionForm
          customerId={customer.id}
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
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-400">Customer</p>
                <p className="font-medium">{customer?.first_name} {customer?.last_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Order Type</p>
                <p className="font-medium capitalize">{orderType}</p>
              </div>
              {prescription && (
                <div>
                  <p className="text-sm text-gray-400">Prescription</p>
                  <p className="font-medium">Rx on file</p>
                </div>
              )}
              {selectedProgramId && (
                <div>
                  <p className="text-sm text-gray-400">Program</p>
                  <p className="font-medium">{programs.find(p => p.id === selectedProgramId)?.company_name}</p>
                </div>
              )}
            </div>

            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="text-left py-2">Item</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-right py-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-800/50">
                    <td className="py-2">{item.frame_brand} {item.frame_model}</td>
                    <td className="py-2 capitalize">{item.glasses_type?.replace(/_/g, ' ')}</td>
                    <td className="py-2 text-right">${Number(item.line_total || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-right space-y-1 text-sm">
              <p>Subtotal: <span className="font-medium">${subtotal.toFixed(2)}</span></p>
              <p>Tax (8.75%): <span className="font-medium">${tax.toFixed(2)}</span></p>
              <p className="text-lg font-bold mt-2">Total: ${total.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('items')}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition"
            >
              Back
            </button>
            <button
              onClick={handleSubmitOrder}
              disabled={submitting}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-800 rounded-lg font-semibold transition"
            >
              {submitting ? 'Creating Order...' : orderType === 'program' ? 'Submit for Approval' : 'Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
