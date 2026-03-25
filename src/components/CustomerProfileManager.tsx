'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Address } from '@/lib/types';

type Props = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  employer: string | null;
  notes: string | null;
  address: Address | null;
};

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';
const labelClass = 'mb-1 block text-xs font-medium text-gray-600';

export default function CustomerProfileManager(props: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    first_name: props.first_name,
    last_name: props.last_name,
    email: props.email || '',
    phone: props.phone || '',
    date_of_birth: props.date_of_birth || '',
    employer: props.employer || '',
    notes: props.notes || '',
    street: props.address?.street || '',
    city: props.address?.city || '',
    state: props.address?.state || '',
    zip: props.address?.zip || '',
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    const address =
      form.street || form.city || form.state || form.zip
        ? { street: form.street, city: form.city, state: form.state, zip: form.zip }
        : null;

    const res = await fetch(`/api/customers/${props.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        employer: form.employer || null,
        notes: form.notes || null,
        address,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Failed to update customer' }));
      setMessage(body.error || 'Failed to update customer');
      return;
    }

    setMessage('Customer updated.');
    router.refresh();
  }

  async function handleArchive() {
    const confirmed = window.confirm('Archive this customer profile? Existing orders and prescriptions are kept.');
    if (!confirmed) return;
    setDeleting(true);
    setMessage('');
    const res = await fetch(`/api/customers/${props.id}`, { method: 'DELETE' });
    setDeleting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Failed to archive customer' }));
      setMessage(body.error || 'Failed to archive customer');
      return;
    }

    router.push('/customers');
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-700">Edit Customer Profile</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>First Name</label>
          <input className={inputClass} value={form.first_name} onChange={(e) => update('first_name', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Last Name</label>
          <input className={inputClass} value={form.last_name} onChange={(e) => update('last_name', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input className={inputClass} value={form.email} onChange={(e) => update('email', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input className={inputClass} value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Date of Birth</label>
          <input type="date" className={inputClass} value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Employer</label>
          <input className={inputClass} value={form.employer} onChange={(e) => update('employer', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Notes</label>
          <textarea rows={2} className={inputClass} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Street</label>
          <input className={inputClass} value={form.street} onChange={(e) => update('street', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>City</label>
          <input className={inputClass} value={form.city} onChange={(e) => update('city', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>State</label>
          <input className={inputClass} value={form.state} onChange={(e) => update('state', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>ZIP</label>
          <input className={inputClass} value={form.zip} onChange={(e) => update('zip', e.target.value)} />
        </div>
      </div>

      {message && <p className="text-sm text-gray-600">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={handleArchive}
          disabled={deleting}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {deleting ? 'Archiving...' : 'Archive Customer'}
        </button>
      </div>
    </div>
  );
}
