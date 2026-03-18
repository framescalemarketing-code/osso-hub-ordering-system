'use client';

import { useState } from 'react';
import type { Order, EmployeeRole } from '@/lib/types';

export default function OrderActions({ order, employeeRole }: { order: any; employeeRole: EmployeeRole }) {
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
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition disabled:opacity-50">
          {loading === 'processing' ? '...' : 'Start Processing'}
        </button>
      )}
      {canManage && order.status === 'processing' && (
        <button onClick={orderLenses} disabled={!!loading}
          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition disabled:opacity-50">
          {loading === 'lenses' ? '...' : 'Order Lenses'}
        </button>
      )}
      {canManage && ['processing', 'lens_ordered'].includes(order.status) && (
        <button onClick={() => updateStatus('completed')} disabled={!!loading}
          className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition disabled:opacity-50">
          {loading === 'completed' ? '...' : 'Mark Complete'}
        </button>
      )}
      {canManage && !order.invoice_sent_at && order.status !== 'draft' && order.status !== 'cancelled' && (
        <button onClick={sendInvoice} disabled={!!loading}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition disabled:opacity-50">
          {loading === 'invoice' ? '...' : 'Send Invoice'}
        </button>
      )}
      {canManage && !['completed', 'cancelled'].includes(order.status) && (
        <button onClick={() => updateStatus('cancelled')} disabled={!!loading}
          className="px-3 py-2 bg-red-900/50 hover:bg-red-800 rounded-lg text-sm font-medium text-red-400 transition disabled:opacity-50">
          Cancel
        </button>
      )}
    </div>
  );
}
