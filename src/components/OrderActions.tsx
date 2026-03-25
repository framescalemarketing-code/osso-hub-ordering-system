'use client';

import { useState } from 'react';
import type { EmployeeRole, Order } from '@/lib/types';

type OrderActionsOrder = Pick<Order, 'id' | 'status' | 'invoice_sent_at'>;

export default function OrderActions({ order, employeeRole }: { order: OrderActionsOrder; employeeRole: EmployeeRole }) {
  const [loading, setLoading] = useState('');

  async function updateStatus(status: string) {
    setLoading(status);
    await fetch(`/api/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    window.location.reload();
  }

  async function sendInvoice() {
    setLoading('invoice');
    await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: order.id }),
    });
    window.location.reload();
  }

  async function orderLenses() {
    setLoading('lenses');
    await fetch(`/api/orders/${order.id}/lenses`, { method: 'POST' });
    window.location.reload();
  }

  const canManage = ['admin', 'manager', 'sales', 'optician'].includes(employeeRole);

  return (
    <div className="flex gap-2 flex-wrap">
      {canManage && order.status === 'approved' && (
        <button onClick={() => updateStatus('processing')} disabled={!!loading}
          className="pos-btn-primary px-3 py-2 disabled:opacity-50">
          {loading === 'processing' ? '...' : 'Start Processing'}
        </button>
      )}
      {canManage && order.status === 'processing' && (
        <button onClick={orderLenses} disabled={!!loading}
          className="rounded-xl bg-[#0f766e] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
          {loading === 'lenses' ? '...' : 'Order Lenses'}
        </button>
      )}
      {canManage && ['processing', 'lens_ordered'].includes(order.status) && (
        <button onClick={() => updateStatus('completed')} disabled={!!loading}
          className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
          {loading === 'completed' ? '...' : 'Mark Complete'}
        </button>
      )}
      {canManage && !order.invoice_sent_at && order.status !== 'draft' && order.status !== 'cancelled' && (
        <button onClick={sendInvoice} disabled={!!loading}
          className="pos-btn-secondary border-[#b99765] text-[#4f3a21] disabled:opacity-50">
          {loading === 'invoice' ? '...' : 'Send Invoice'}
        </button>
      )}
      {canManage && !['completed', 'cancelled'].includes(order.status) && (
        <button onClick={() => updateStatus('cancelled')} disabled={!!loading}
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50">
          Cancel
        </button>
      )}
    </div>
  );
}
