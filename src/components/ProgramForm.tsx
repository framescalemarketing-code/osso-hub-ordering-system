'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type ProgramFormState = {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  approval_required: boolean;
  approver_emails: string;
  invoice_terms: string;
};

export default function ProgramForm() {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProgramFormState>({
    company_name: '', contact_name: '', contact_email: '', contact_phone: '',
    approval_required: true, approver_emails: '', invoice_terms: 'Net 30',
  });

  function update<K extends keyof ProgramFormState>(key: K, value: ProgramFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.company_name.trim()) return;
    setSaving(true);
    await supabase.from('programs').insert({
      company_name: form.company_name.trim(),
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      approval_required: form.approval_required,
      approver_emails: form.approver_emails.split(',').map(e => e.trim()).filter(Boolean),
      invoice_terms: form.invoice_terms,
    });
    setSaving(false);
    setOpen(false);
    setForm({ company_name: '', contact_name: '', contact_email: '', contact_phone: '', approval_required: true, approver_emails: '', invoice_terms: 'Net 30' });
    router.refresh();
  }

  const inputClass = "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm";

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition">
        + New Program
      </button>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="font-semibold mb-4 text-gray-800">New Program</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <input placeholder="Company Name *" value={form.company_name} onChange={e => update('company_name', e.target.value)} className={inputClass} />
        <input placeholder="Contact Name" value={form.contact_name} onChange={e => update('contact_name', e.target.value)} className={inputClass} />
        <input placeholder="Contact Email" type="email" value={form.contact_email} onChange={e => update('contact_email', e.target.value)} className={inputClass} />
        <input placeholder="Contact Phone" value={form.contact_phone} onChange={e => update('contact_phone', e.target.value)} className={inputClass} />
        <input placeholder="Approver Emails (comma-separated)" value={form.approver_emails} onChange={e => update('approver_emails', e.target.value)} className={inputClass} />
        <input placeholder="Invoice Terms" value={form.invoice_terms} onChange={e => update('invoice_terms', e.target.value)} className={inputClass} />
      </div>
        <label className="flex items-center gap-2 text-sm mb-4 text-gray-700">
        <input type="checkbox" checked={form.approval_required} onChange={e => update('approval_required', e.target.checked)} />
        Require approval before processing
      </label>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium">{saving ? 'Saving...' : 'Save'}</button>
        <button onClick={() => setOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm">Cancel</button>
      </div>
    </div>
  );
}
