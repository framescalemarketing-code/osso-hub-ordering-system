'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Customer } from '@/lib/types';

interface Props {
  onComplete: (customer: Customer) => void;
  existingCustomer?: Customer | null;
}

export default function CustomerIntakeForm({ onComplete, existingCustomer }: Props) {
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [mode, setMode] = useState<'search' | 'new'>(existingCustomer ? 'search' : 'search');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    first_name: existingCustomer?.first_name || '',
    last_name: existingCustomer?.last_name || '',
    email: existingCustomer?.email || '',
    phone: existingCustomer?.phone || '',
    date_of_birth: existingCustomer?.date_of_birth || '',
    employer: existingCustomer?.employer || '',
    street: (existingCustomer?.address as any)?.street || '',
    city: (existingCustomer?.address as any)?.city || '',
    state: (existingCustomer?.address as any)?.state || '',
    zip: (existingCustomer?.address as any)?.zip || '',
    hipaa_consent: existingCustomer?.hipaa_consent_signed || false,
    ccpa_consent: existingCustomer?.ccpa_consent_signed || false,
    marketing_consent: existingCustomer?.marketing_consent || false,
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

  function update(key: string, value: any) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const now = new Date().toISOString();

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      date_of_birth: form.date_of_birth || null,
      employer: form.employer.trim() || null,
      address: form.street ? { street: form.street, city: form.city, state: form.state, zip: form.zip } : null,
      hipaa_consent_signed: form.hipaa_consent,
      hipaa_consent_date: form.hipaa_consent ? now : null,
      ccpa_consent_signed: form.ccpa_consent,
      ccpa_consent_date: form.ccpa_consent ? now : null,
      marketing_consent: form.marketing_consent,
      marketing_consent_date: form.marketing_consent ? now : null,
    };

    const { data, error } = await supabase.from('customers').insert(payload).select().single();

    if (error) {
      alert('Error saving customer: ' + error.message);
      setSaving(false);
      return;
    }

    // Log consents
    const consents = [];
    if (form.hipaa_consent) consents.push({ customer_id: data.id, consent_type: 'hipaa', granted: true });
    if (form.ccpa_consent) consents.push({ customer_id: data.id, consent_type: 'ccpa', granted: true });
    if (form.marketing_consent) consents.push({ customer_id: data.id, consent_type: 'marketing', granted: true });
    if (consents.length) await supabase.from('consent_log').insert(consents);

    onComplete(data as Customer);
  }

  const inputClass = "w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Customer Information</h2>
        <div className="flex gap-2">
          <button onClick={() => setMode('search')} className={`px-3 py-1.5 rounded text-sm ${mode === 'search' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            Search Existing
          </button>
          <button onClick={() => setMode('new')} className={`px-3 py-1.5 rounded text-sm ${mode === 'new' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            New Customer
          </button>
        </div>
      </div>

      {mode === 'search' && (
        <div className="mb-6">
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search by name, email, or phone..."
              className={inputClass + ' flex-1'}
            />
            <button onClick={handleSearch} className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium">Search</button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map(c => (
                <button
                  key={c.id}
                  onClick={() => onComplete(c)}
                  className="w-full text-left px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                >
                  <span className="font-medium">{c.first_name} {c.last_name}</span>
                  {c.email && <span className="text-gray-400 ml-3 text-sm">{c.email}</span>}
                  {c.phone && <span className="text-gray-400 ml-3 text-sm">{c.phone}</span>}
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
            <h3 className="text-sm font-medium text-gray-300 mb-3">Address</h3>
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

          {/* HIPAA / CCPA / Marketing Consent */}
          <div className="bg-gray-800 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">Consent & Compliance</h3>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.hipaa_consent} onChange={e => update('hipaa_consent', e.target.checked)} className="mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-200">HIPAA Authorization *</p>
                <p className="text-xs text-gray-400">Customer authorizes use and disclosure of protected health information for treatment, payment, and operations.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.ccpa_consent} onChange={e => update('ccpa_consent', e.target.checked)} className="mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-200">CCPA Acknowledgment *</p>
                <p className="text-xs text-gray-400">Customer acknowledges their rights under the California Consumer Privacy Act. Personal information will not be sold.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.marketing_consent} onChange={e => update('marketing_consent', e.target.checked)} className="mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-200">Marketing Consent (Optional)</p>
                <p className="text-xs text-gray-400">Customer agrees to receive marketing communications. Can opt out at any time.</p>
              </div>
            </label>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !form.first_name || !form.last_name || !form.hipaa_consent || !form.ccpa_consent}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition"
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      )}
    </div>
  );
}
