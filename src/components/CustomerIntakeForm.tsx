'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Address, Customer } from '@/lib/types';

interface Props {
  onComplete: (customer: Customer) => void;
  existingCustomer?: Customer | null;
}

type CustomerFormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  employer: string;
  street: string;
  city: string;
  state: string;
  zip: string;
};

export default function CustomerIntakeForm({ onComplete, existingCustomer }: Props) {
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [mode, setMode] = useState<'search' | 'new'>(existingCustomer ? 'search' : 'search');
  const [saving, setSaving] = useState(false);

  const address = existingCustomer?.address as Address | null | undefined;
  const [form, setForm] = useState<CustomerFormState>({
    first_name: existingCustomer?.first_name || '',
    last_name: existingCustomer?.last_name || '',
    email: existingCustomer?.email || '',
    phone: existingCustomer?.phone || '',
    date_of_birth: existingCustomer?.date_of_birth || '',
    employer: existingCustomer?.employer || '',
    street: address?.street || '',
    city: address?.city || '',
    state: address?.state || '',
    zip: address?.zip || '',
  });

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .or(`last_name.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
      .limit(10);
    setSearchResults((data as Customer[]) || []);
  }

  function update<K extends keyof CustomerFormState>(key: K, value: CustomerFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      date_of_birth: form.date_of_birth || null,
      employer: form.employer.trim() || null,
      address: form.street ? { street: form.street, city: form.city, state: form.state, zip: form.zip } : null,
    };

    const { data, error } = await supabase.from('customers').insert(payload).select().single();
    const savedCustomer = data as Customer;

    if (error) {
      alert('Error saving customer: ' + error.message);
      setSaving(false);
      return;
    }

    onComplete(savedCustomer);
  }

  const inputClass = "w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6" suppressHydrationWarning>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Customer Information</h2>
        <div className="flex flex-wrap gap-2">
          <button suppressHydrationWarning onClick={() => setMode('search')} className={`px-3 py-1.5 rounded text-sm ${mode === 'search' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Search Existing
          </button>
          <button suppressHydrationWarning onClick={() => setMode('new')} className={`px-3 py-1.5 rounded text-sm ${mode === 'new' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            New Customer
          </button>
        </div>
      </div>

      {mode === 'search' && (
        <div className="mb-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search by name, email, or phone..."
              suppressHydrationWarning
              className={inputClass + ' flex-1'}
            />
            <button suppressHydrationWarning onClick={handleSearch} className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium">Search</button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map(c => (
                <button
                  key={c.id}
                  onClick={() => onComplete(c)}
                  className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition"
                >
                  <span className="font-medium text-gray-800">{c.first_name} {c.last_name}</span>
                  {c.email && <span className="text-gray-500 ml-3 text-sm">{c.email}</span>}
                  {c.phone && <span className="text-gray-500 ml-3 text-sm">{c.phone}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'new' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>First Name *</label>
              <input type="text" value={form.first_name} onChange={e => update('first_name', e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Last Name *</label>
              <input type="text" value={form.last_name} onChange={e => update('last_name', e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Date of Birth</label>
              <input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Employer</label>
              <input type="text" value={form.employer} onChange={e => update('employer', e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <input type="text" placeholder="Street" value={form.street} onChange={e => update('street', e.target.value)} className={inputClass} />
              </div>
              <div>
                <input type="text" placeholder="City" value={form.city} onChange={e => update('city', e.target.value)} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="State" value={form.state} onChange={e => update('state', e.target.value)} className={inputClass} />
                <input type="text" placeholder="ZIP" value={form.zip} onChange={e => update('zip', e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !form.first_name || !form.last_name}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      )}
    </div>
  );
}
