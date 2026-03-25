'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Address, Customer, Program } from '@/lib/types';

interface Props {
  onComplete: (customer: Customer, context?: CustomerIntakeContext) => void;
  existingCustomer?: Customer | null;
  orderType?: 'regular' | 'program';
  selectedProgram?: Pick<Program, 'id' | 'company_name' | 'restricted_guidelines' | 'approval_required' | 'approver_emails'> | null;
}

export interface CustomerIntakeContext {
  eligibility_status: 'eligible' | 'not_eligible' | 'unknown';
  eligibility_reason: string | null;
  enrollment_id: string | null;
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

export default function CustomerIntakeForm({
  onComplete,
  existingCustomer,
  orderType = 'regular',
  selectedProgram = null,
}: Props) {
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [mode, setMode] = useState<'search' | 'new'>(existingCustomer ? 'search' : 'search');
  const [saving, setSaving] = useState(false);
  const [lookupInput, setLookupInput] = useState({
    first_name: '',
    last_name: '',
    employee_external_id: '',
    employee_email: '',
  });
  const [lookupState, setLookupState] = useState<{
    status: 'idle' | 'checking' | 'eligible' | 'not_eligible' | 'error';
    message: string;
    enrollment: { id: string } | null;
  }>({ status: 'idle', message: '', enrollment: null });
  const [creatingFromLookup, setCreatingFromLookup] = useState(false);

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
      .or(`last_name.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,employer.ilike.%${searchQuery}%`)
      .eq('is_active', true)
      .limit(10);
    setSearchResults((data as Customer[]) || []);
  }

  function update<K extends keyof CustomerFormState>(key: K, value: CustomerFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const isProgramOrder = orderType === 'program' && selectedProgram;
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      date_of_birth: form.date_of_birth || null,
      employer: isProgramOrder ? selectedProgram.company_name : form.employer.trim() || null,
      program_id: isProgramOrder ? selectedProgram.id : null,
      address: form.street ? { street: form.street, city: form.city, state: form.state, zip: form.zip } : null,
      notes:
        isProgramOrder && selectedProgram.restricted_guidelines
          ? `Program guidelines snapshot: ${selectedProgram.restricted_guidelines}`
          : null,
    };

    const { data, error } = await supabase.from('customers').insert(payload).select().single();
    const savedCustomer = data as Customer;

    if (error) {
      alert('Error saving customer: ' + error.message);
      setSaving(false);
      return;
    }

    const programContext: CustomerIntakeContext = {
      eligibility_status: isProgramOrder ? (lookupState.status === 'eligible' ? 'eligible' : 'unknown') : 'unknown',
      eligibility_reason: lookupState.message || null,
      enrollment_id: lookupState.enrollment?.id || null,
    };
    onComplete(savedCustomer, programContext);
  }

  async function handleProgramEligibilityCheck() {
    if (!selectedProgram?.id) return;
    if (!lookupInput.first_name.trim() || !lookupInput.last_name.trim()) {
      setLookupState({
        status: 'error',
        message: 'First and last name are required for eligibility checks.',
        enrollment: null,
      });
      return;
    }
    if (!lookupInput.employee_external_id.trim() && !lookupInput.employee_email.trim()) {
      setLookupState({
        status: 'error',
        message: 'Provide employee ID or employee email.',
        enrollment: null,
      });
      return;
    }

    setLookupState({ status: 'checking', message: 'Checking eligibility...', enrollment: null });
    const params = new URLSearchParams({
      program_id: selectedProgram.id,
      first_name: lookupInput.first_name.trim(),
      last_name: lookupInput.last_name.trim(),
      employee_external_id: lookupInput.employee_external_id.trim(),
      employee_email: lookupInput.employee_email.trim(),
    });

    const res = await fetch(`/api/enrollments/check?${params.toString()}`);
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLookupState({
        status: 'error',
        message: body.error || 'Eligibility check failed.',
        enrollment: null,
      });
      return;
    }

    if (body.eligible) {
      setLookupState({
        status: 'eligible',
        message: body.reason || 'Employee is eligible.',
        enrollment: body.enrollment || null,
      });
      return;
    }

    setLookupState({
      status: 'not_eligible',
      message: body.reason || 'No active enrollment match found.',
      enrollment: null,
    });
  }

  async function handleCreateCustomerFromEligibility() {
    if (!selectedProgram?.id) return;
    setCreatingFromLookup(true);
    const res = await fetch('/api/enrollments/add-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        program_id: selectedProgram.id,
        enrollment_id: lookupState.enrollment?.id || null,
        first_name: lookupInput.first_name.trim(),
        last_name: lookupInput.last_name.trim(),
        employee_email: lookupInput.employee_email.trim() || null,
        employee_external_id: lookupInput.employee_external_id.trim() || null,
      }),
    });
    setCreatingFromLookup(false);

    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.customer) {
      setLookupState((prev) => ({
        ...prev,
        status: 'error',
        message: body.error || 'Unable to create customer from eligibility record.',
      }));
      return;
    }

    onComplete(body.customer as Customer, {
      eligibility_status: lookupState.status === 'eligible' ? 'eligible' : 'not_eligible',
      eligibility_reason: lookupState.message || null,
      enrollment_id: lookupState.enrollment?.id || null,
    });
  }

  const inputClass = 'pos-input';
  const labelClass = 'pos-label';

  return (
    <div className="pos-panel p-6" suppressHydrationWarning>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-[#2a1f12]">Customer Information</h2>
        <div className="flex flex-wrap gap-2">
          <button suppressHydrationWarning onClick={() => setMode('search')} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${mode === 'search' ? 'bg-linear-to-r from-[#8f6d3f] to-[#725326] text-white' : 'border border-[#ccb089] bg-white/85 text-[#5a4428]'}`}>
            Search Existing
          </button>
          <button suppressHydrationWarning onClick={() => setMode('new')} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${mode === 'new' ? 'bg-linear-to-r from-[#8f6d3f] to-[#725326] text-white' : 'border border-[#ccb089] bg-white/85 text-[#5a4428]'}`}>
            New Customer
          </button>
        </div>
      </div>

      {mode === 'search' && (
        <div className="mb-6">
          {orderType === 'program' && selectedProgram && (
            <div className="mb-4 rounded-xl border border-[#e5d5bb] bg-[#fffdf8] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7d6541]">Company Employee Eligibility</p>
              <p className="mt-1 text-sm text-[#6f5b40]">
                Verify eligibility from uploaded enrollment data before selecting or creating a company employee.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input className={inputClass} placeholder="First name" value={lookupInput.first_name} onChange={(e) => setLookupInput((prev) => ({ ...prev, first_name: e.target.value }))} />
                <input className={inputClass} placeholder="Last name" value={lookupInput.last_name} onChange={(e) => setLookupInput((prev) => ({ ...prev, last_name: e.target.value }))} />
                <input className={inputClass} placeholder="Employee ID" value={lookupInput.employee_external_id} onChange={(e) => setLookupInput((prev) => ({ ...prev, employee_external_id: e.target.value }))} />
                <input className={inputClass} placeholder="Employee email" value={lookupInput.employee_email} onChange={(e) => setLookupInput((prev) => ({ ...prev, employee_email: e.target.value }))} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={handleProgramEligibilityCheck} disabled={lookupState.status === 'checking'} className="pos-btn-secondary">
                  {lookupState.status === 'checking' ? 'Checking...' : 'Check Eligibility'}
                </button>
                <button
                  type="button"
                  onClick={handleCreateCustomerFromEligibility}
                  disabled={creatingFromLookup || (!lookupInput.first_name.trim() || !lookupInput.last_name.trim())}
                  className="pos-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingFromLookup ? 'Adding...' : 'Add Employee To Customers'}
                </button>
              </div>
              {lookupState.message && <p className="mt-2 text-sm text-[#6f5b40]">{lookupState.message}</p>}
            </div>
          )}

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
            <button suppressHydrationWarning onClick={handleSearch} className="pos-btn-primary">Search</button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map(c => (
                <button
                  key={c.id}
                  onClick={() =>
                    onComplete(c, {
                      eligibility_status:
                        orderType === 'program' && selectedProgram ? (lookupState.status === 'eligible' ? 'eligible' : 'unknown') : 'unknown',
                      eligibility_reason: lookupState.message || null,
                      enrollment_id: lookupState.enrollment?.id || null,
                    })
                  }
                  className="w-full rounded-xl border border-[#dcc7a5] bg-[#fffdf8] px-4 py-3 text-left transition hover:bg-white"
                >
                  <span className="font-semibold text-[#332515]">{c.first_name} {c.last_name}</span>
                  {c.email && <span className="ml-3 text-sm text-[#6f5b40]">{c.email}</span>}
                  {c.phone && <span className="ml-3 text-sm text-[#6f5b40]">{c.phone}</span>}
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
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#7d6541]">Address</h3>
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
            className="pos-btn-primary px-6 py-3 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      )}
    </div>
  );
}
