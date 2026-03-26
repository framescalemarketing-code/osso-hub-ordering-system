'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeEuPackageLabel, normalizeServiceTierLabel } from '@/lib/ordering-domain';
import type { EUPackageAddOnKey, PaymentTerms, PriceAdjustment, ServiceTier } from '@/lib/pricing';
import {
  calculateEuPackagePerEmployee,
  calculateServiceTierPerEmployee,
  EU_PACKAGE_ADD_ON_LABELS,
  PRICING,
  safeParsePriceAdjustments,
} from '@/lib/pricing';
import {
  EU_PACKAGE_FORM_OPTIONS,
  LIGHT_REACTIVE_OPTIONS,
  NET_TERM_OPTIONS,
  normalizeInvoiceTerms,
  normalizeProgramType,
  parseCompanyGuidelines,
  PROGRAM_TYPE_OPTIONS,
  SERVICE_TIER_FORM_OPTIONS,
  serializeCompanyGuidelines,
  SUNGLASSES_OPTIONS,
  type LightReactivePolicy,
  type SunglassesPolicy,
} from '@/lib/program-options';

type Props = {
  id: string;
  company_name: string;
  company_code?: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  invoice_terms: string | null;
  approval_required: boolean;
  approver_emails: string[];
  program_type: string | null;
  employee_count: number | null;
  restricted_guidelines: string | null;
  loyalty_credit_count: number | null;
  referral_credit_count: number | null;
  eu_package: string | null;
  eu_package_add_ons: EUPackageAddOnKey[] | null;
  eu_package_custom_adjustments: PriceAdjustment[] | null;
  service_tier: ServiceTier | null;
  service_tier_custom_adjustments: PriceAdjustment[] | null;
  eligibility_fields: Array<{
    key: string;
    label: string;
    required: boolean;
    active: boolean;
    fieldType: string;
    description?: string;
    example?: string;
    displayOrder: number;
  }>;
};

const ADD_ON_KEYS = Object.keys(EU_PACKAGE_ADD_ON_LABELS) as EUPackageAddOnKey[];
const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';
const labelClass = 'mb-1 block text-xs font-medium text-gray-600';

function firstDayOfCurrentMonth(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export default function CompanyProfileManager(props: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMonth, setImportMonth] = useState(firstDayOfCurrentMonth());
  const [eligibilityMessage, setEligibilityMessage] = useState('');
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [eligibilityFields, setEligibilityFields] = useState(
    [...props.eligibility_fields].sort((left, right) => left.displayOrder - right.displayOrder)
  );
  const [eligibilityInput, setEligibilityInput] = useState({
    first_name: '',
    last_name: '',
    employee_email: '',
    employee_external_id: '',
  });

  const parsedGuidelines = parseCompanyGuidelines(props.restricted_guidelines);

  const [form, setForm] = useState({
    company_name: props.company_name,
    company_code: props.company_code || '',
    contact_name: props.contact_name || '',
    contact_email: props.contact_email || '',
    contact_phone: props.contact_phone || '',
    invoice_terms: normalizeInvoiceTerms(props.invoice_terms),
    approval_required: props.approval_required,
    supervisor_emails: props.approver_emails?.length ? props.approver_emails : [''],
    program_type: normalizeProgramType(props.program_type),
    employee_count: props.employee_count || 0,
    light_reactive_policy: parsedGuidelines.lightReactive as LightReactivePolicy,
    sunglasses_policy: parsedGuidelines.sunglasses as SunglassesPolicy,
    loyalty_credit_count: props.loyalty_credit_count || 0,
    referral_credit_count: props.referral_credit_count || 0,
    eu_package: normalizeEuPackageLabel(props.eu_package) || 'Compliance',
    eu_package_add_ons: props.eu_package_add_ons || [],
    eu_package_custom_adjustments: props.eu_package_custom_adjustments || [],
    service_tier: normalizeServiceTierLabel(props.service_tier) || ('Essential' as ServiceTier),
    service_tier_custom_adjustments: props.service_tier_custom_adjustments || [],
  });

  const euPerEmployee = useMemo(
    () => calculateEuPackagePerEmployee(form.eu_package, form.eu_package_add_ons, form.eu_package_custom_adjustments),
    [form.eu_package, form.eu_package_add_ons, form.eu_package_custom_adjustments]
  );
  const servicePerEmployee = useMemo(
    () => calculateServiceTierPerEmployee(form.service_tier, form.service_tier_custom_adjustments),
    [form.service_tier, form.service_tier_custom_adjustments]
  );
  const totalPerEmployee = euPerEmployee + servicePerEmployee;
  const acceptsEmployeeId = eligibilityFields.some((field) => field.active && field.key === 'employeeId');
  const acceptsEmail = eligibilityFields.some((field) => field.active && field.key === 'email');

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateSupervisorEmail(index: number, value: string) {
    const next = [...form.supervisor_emails];
    next[index] = value;
    update('supervisor_emails', next);
  }

  function addSupervisorEmail() {
    update('supervisor_emails', [...form.supervisor_emails, '']);
  }

  function removeSupervisorEmail(index: number) {
    const next = form.supervisor_emails.filter((_, currentIndex) => currentIndex !== index);
    update('supervisor_emails', next.length > 0 ? next : ['']);
  }

  function toggleAddOn(addOnKey: EUPackageAddOnKey) {
    const current = new Set(form.eu_package_add_ons);
    if (current.has(addOnKey)) current.delete(addOnKey);
    else current.add(addOnKey);
    update('eu_package_add_ons', Array.from(current));
  }

  function updateAdjustment(
    key: 'eu_package_custom_adjustments' | 'service_tier_custom_adjustments',
    index: number,
    patch: Partial<PriceAdjustment>
  ) {
    const next = [...form[key]];
    next[index] = { ...next[index], ...patch };
    update(key, next);
  }

  function addAdjustment(key: 'eu_package_custom_adjustments' | 'service_tier_custom_adjustments') {
    update(key, [...form[key], { label: '', amount: 0 }]);
  }

  function updateEligibilityField(
    key: string,
    patch: Partial<(typeof eligibilityFields)[number]>
  ) {
    setEligibilityFields((current) =>
      current.map((field) => {
        if (field.key !== key) return field;
        const next = { ...field, ...patch };
        if (field.key === 'firstName' || field.key === 'lastName') {
          return { ...next, active: true, required: true };
        }
        return next;
      })
    );
  }

  function removeAdjustment(key: 'eu_package_custom_adjustments' | 'service_tier_custom_adjustments', index: number) {
    update(
      key,
      form[key].filter((_, adjustmentIndex) => adjustmentIndex !== index)
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    const res = await fetch(`/api/programs/${props.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: form.company_name,
        company_code: form.company_code || null,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        invoice_terms: form.invoice_terms,
        approval_required: form.approval_required,
        approver_emails: form.supervisor_emails.map((email) => email.trim()).filter(Boolean),
        program_type: form.program_type,
        employee_count: form.employee_count,
        restricted_guidelines:
          serializeCompanyGuidelines({
            lightReactive: form.light_reactive_policy,
            sunglasses: form.sunglasses_policy,
          }) || null,
        loyalty_credit_count: form.loyalty_credit_count,
        referral_credit_count: form.referral_credit_count,
        eu_package: form.eu_package,
        eu_package_add_ons: form.eu_package_add_ons,
        eu_package_custom_adjustments: safeParsePriceAdjustments(form.eu_package_custom_adjustments),
        service_tier: form.service_tier,
        service_tier_custom_adjustments: safeParsePriceAdjustments(form.service_tier_custom_adjustments),
        eligibility_fields: eligibilityFields.map((field) => ({
          key: field.key,
          required: field.required,
          active: field.active,
        })),
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Failed to update company profile' }));
      setMessage(body.error || 'Failed to update company profile');
      return;
    }

    setMessage('Company profile updated.');
    router.refresh();
  }

  async function handleArchive() {
    const confirmed = window.confirm('Archive this company? Existing orders stay intact.');
    if (!confirmed) return;
    setArchiving(true);
    setMessage('');
    const res = await fetch(`/api/programs/${props.id}`, { method: 'DELETE' });
    setArchiving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Failed to archive company' }));
      setMessage(body.error || 'Failed to archive company');
      return;
    }

    router.push('/programs');
    router.refresh();
  }

  async function handleImportCsv(file: File) {
    setImporting(true);
    setImportMessage('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('program_id', props.id);
    formData.append('import_month', importMonth);

    const res = await fetch('/api/enrollments/import', { method: 'POST', body: formData });
    setImporting(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setImportMessage(body.error || 'Failed to import enrollment CSV.');
      return;
    }
    setImportMessage(
      `Import applied. Valid rows: ${body.valid_row_count ?? 0}. Invalid rows: ${body.invalid_row_count ?? 0}.`
    );
    router.refresh();
  }

  async function handleEligibilityCheck() {
    if (!eligibilityInput.first_name || !eligibilityInput.last_name) {
      setEligibilityMessage('First name and last name are required.');
      return;
    }
    if ((!acceptsEmployeeId || !eligibilityInput.employee_external_id) && (!acceptsEmail || !eligibilityInput.employee_email)) {
      setEligibilityMessage('Provide at least one active identity field.');
      return;
    }

    setCheckingEligibility(true);
    setEligibilityMessage('');
    const params = new URLSearchParams({
      program_id: props.id,
      first_name: eligibilityInput.first_name,
      last_name: eligibilityInput.last_name,
      employee_external_id: eligibilityInput.employee_external_id,
      employee_email: eligibilityInput.employee_email,
    });
    const res = await fetch(`/api/enrollments/check?${params.toString()}`);
    setCheckingEligibility(false);

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setEligibilityMessage(body.error || 'Eligibility check failed.');
      return;
    }

    const label = body.eligible ? 'Eligible' : 'Not eligible';
    const reason = body.reason ? ` (${body.reason})` : '';
    setEligibilityMessage(`${label}${reason}`);
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-700">Edit Company Profile</h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Company Name</label>
          <input className={inputClass} value={form.company_name} onChange={(e) => update('company_name', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Company Code</label>
          <input className={inputClass} value={form.company_code} onChange={(e) => update('company_code', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Program Type</label>
          <select className={inputClass} value={form.program_type} onChange={(e) => update('program_type', e.target.value as typeof form.program_type)}>
            {PROGRAM_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Point of Contact Name</label>
          <input className={inputClass} value={form.contact_name} onChange={(e) => update('contact_name', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Point of Contact Email</label>
          <input className={inputClass} value={form.contact_email} onChange={(e) => update('contact_email', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Point of Contact Phone</label>
          <input className={inputClass} value={form.contact_phone} onChange={(e) => update('contact_phone', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Net Terms</label>
          <select className={inputClass} value={form.invoice_terms} onChange={(e) => update('invoice_terms', e.target.value as PaymentTerms)}>
            {NET_TERM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Employee Count</label>
          <input type="number" min="0" className={inputClass} value={form.employee_count} onChange={(e) => update('employee_count', Number(e.target.value) || 0)} />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass}>EU Package</label>
            <select value={form.eu_package} onChange={(e) => update('eu_package', e.target.value as typeof form.eu_package)} className={inputClass}>
              {EU_PACKAGE_FORM_OPTIONS.map((euPackage) => (
                <option key={euPackage} value={euPackage}>
                  {euPackage} (${PRICING.euAllowancePerEmployee[euPackage]} / employee)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Service Tier</label>
            <select value={form.service_tier} onChange={(e) => update('service_tier', e.target.value as ServiceTier)} className={inputClass}>
              {SERVICE_TIER_FORM_OPTIONS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier} (${PRICING.serviceFeePerEmployee[tier]} / employee)
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-3 space-y-1 rounded-lg border border-gray-200 bg-white p-2">
          {ADD_ON_KEYS.map((key) => (
            <label key={key} className="flex items-center justify-between gap-2 text-sm text-gray-700">
              <span>
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={form.eu_package_add_ons.includes(key)}
                  onChange={() => toggleAddOn(key)}
                />
                {EU_PACKAGE_ADD_ON_LABELS[key]}
              </span>
              <span className="text-xs text-gray-500">+${PRICING.euPackageAddOnsPerEmployee[key]}</span>
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">EU Custom Adjustments</p>
          {form.eu_package_custom_adjustments.map((adjustment, index) => (
            <div key={`eu-${index}`} className="grid grid-cols-[1fr_120px_auto] gap-2">
              <input className={inputClass} value={adjustment.label} onChange={(e) => updateAdjustment('eu_package_custom_adjustments', index, { label: e.target.value })} />
              <input type="number" step="0.01" className={inputClass} value={adjustment.amount} onChange={(e) => updateAdjustment('eu_package_custom_adjustments', index, { amount: Number(e.target.value) || 0 })} />
              <button type="button" className="rounded-lg border border-red-200 px-3 text-sm text-red-600 hover:bg-red-50" onClick={() => removeAdjustment('eu_package_custom_adjustments', index)}>Remove</button>
            </div>
          ))}
          <button type="button" onClick={() => addAdjustment('eu_package_custom_adjustments')} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white">+ Add EU Adjustment</button>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Service Tier Custom Adjustments</p>
          {form.service_tier_custom_adjustments.map((adjustment, index) => (
            <div key={`service-${index}`} className="grid grid-cols-[1fr_120px_auto] gap-2">
              <input className={inputClass} value={adjustment.label} onChange={(e) => updateAdjustment('service_tier_custom_adjustments', index, { label: e.target.value })} />
              <input type="number" step="0.01" className={inputClass} value={adjustment.amount} onChange={(e) => updateAdjustment('service_tier_custom_adjustments', index, { amount: Number(e.target.value) || 0 })} />
              <button type="button" className="rounded-lg border border-red-200 px-3 text-sm text-red-600 hover:bg-red-50" onClick={() => removeAdjustment('service_tier_custom_adjustments', index)}>Remove</button>
            </div>
          ))}
          <button type="button" onClick={() => addAdjustment('service_tier_custom_adjustments')} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white">+ Add Tier Adjustment</button>
        </div>

        <p className="mt-4 text-sm text-gray-700">Calculated per-employee price: ${totalPerEmployee.toFixed(2)}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>Supervisor Email</label>
          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            {form.supervisor_emails.map((email, index) => (
              <div key={`supervisor-${index}`} className="flex gap-2">
                <input
                  type="email"
                  className={inputClass}
                  value={email}
                  placeholder={`Supervisor email ${index + 1}`}
                  onChange={(e) => updateSupervisorEmail(index, e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-lg border border-red-200 px-3 text-sm text-red-600 hover:bg-red-50"
                  onClick={() => removeSupervisorEmail(index)}
                >
                  Remove
                </button>
              </div>
            ))}
            <button type="button" onClick={addSupervisorEmail} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white">+ Add Supervisor</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Company Guidelines: Light Reactive</label>
          <select value={form.light_reactive_policy} onChange={(e) => update('light_reactive_policy', e.target.value as LightReactivePolicy)} className={inputClass}>
            {LIGHT_REACTIVE_OPTIONS.map((option) => (
              <option key={option.value || 'blank'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Company Guidelines: Sun Glasses</label>
          <select value={form.sunglasses_policy} onChange={(e) => update('sunglasses_policy', e.target.value as SunglassesPolicy)} className={inputClass}>
            {SUNGLASSES_OPTIONS.map((option) => (
              <option key={option.value || 'blank'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Loyalty Credits</label>
          <input type="number" className={inputClass} value={form.loyalty_credit_count} onChange={(e) => update('loyalty_credit_count', Number(e.target.value) || 0)} />
        </div>
        <div>
          <label className={labelClass}>Referral Credits</label>
          <input type="number" className={inputClass} value={form.referral_credit_count} onChange={(e) => update('referral_credit_count', Number(e.target.value) || 0)} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={form.approval_required} onChange={(e) => update('approval_required', e.target.checked)} />
        Require supervisor approval for company orders
      </label>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h4 className="text-sm font-semibold text-gray-700">Employer Eligibility Fields</h4>
        <p className="mt-1 text-sm text-gray-600">
          Keep the required roster fields narrow. First name and last name stay required; employee ID or email should remain active for matching.
        </p>
        <div className="mt-3 space-y-2">
          {eligibilityFields.map((field) => (
            <div key={field.key} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{field.label}</p>
                  {field.description && <p className="mt-1 text-xs text-gray-500">{field.description}</p>}
                  {field.example && <p className="mt-1 text-xs text-gray-400">Example: {field.example}</p>}
                </div>
                <div className="flex gap-4 text-sm text-gray-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={field.active}
                      disabled={field.key === 'firstName' || field.key === 'lastName'}
                      onChange={(e) => updateEligibilityField(field.key, { active: e.target.checked })}
                    />
                    Collect
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={field.required}
                      disabled={field.key === 'firstName' || field.key === 'lastName' || !field.active}
                      onChange={(e) => updateEligibilityField(field.key, { required: e.target.checked })}
                    />
                    Required
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {message && <p className="text-sm text-gray-600">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <button onClick={handleSave} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
          {saving ? 'Saving...' : 'Save Company'}
        </button>
        <button onClick={handleArchive} disabled={archiving} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70">
          {archiving ? 'Archiving...' : 'Archive Company'}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h4 className="text-sm font-semibold text-gray-700">Enrollment CSV Upload</h4>
        <p className="mt-1 text-sm text-gray-600">
          Upload a roster file to continuously maintain eligible employees for this company.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
          <input type="date" className={inputClass} value={importMonth} onChange={(e) => setImportMonth(e.target.value)} />
          <input
            type="file"
            accept=".csv,text/csv"
            className={inputClass}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportCsv(file);
            }}
            disabled={importing}
          />
        </div>
        {importMessage && <p className="mt-2 text-sm text-gray-700">{importMessage}</p>}
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h4 className="text-sm font-semibold text-gray-700">Eligibility Check</h4>
        <p className="mt-1 text-sm text-gray-600">
          Validate an employee by first name, last name, and at least one active identity field before intake.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className={inputClass} placeholder="First name" value={eligibilityInput.first_name} onChange={(e) => setEligibilityInput((prev) => ({ ...prev, first_name: e.target.value }))} />
          <input className={inputClass} placeholder="Last name" value={eligibilityInput.last_name} onChange={(e) => setEligibilityInput((prev) => ({ ...prev, last_name: e.target.value }))} />
          <input className={inputClass} placeholder={acceptsEmployeeId ? 'Employee ID / token' : 'Employee ID not active for this company'} value={eligibilityInput.employee_external_id} onChange={(e) => setEligibilityInput((prev) => ({ ...prev, employee_external_id: e.target.value }))} disabled={!acceptsEmployeeId} />
          <input className={inputClass} placeholder={acceptsEmail ? 'Employee email' : 'Employee email not active for this company'} value={eligibilityInput.employee_email} onChange={(e) => setEligibilityInput((prev) => ({ ...prev, employee_email: e.target.value }))} disabled={!acceptsEmail} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={handleEligibilityCheck} disabled={checkingEligibility} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60">
            {checkingEligibility ? 'Checking...' : 'Check Eligibility'}
          </button>
          {eligibilityMessage && <p className="text-sm text-gray-700">{eligibilityMessage}</p>}
        </div>
      </div>
    </div>
  );
}
