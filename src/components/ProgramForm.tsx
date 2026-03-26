'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  PROGRAM_TYPE_OPTIONS,
  SERVICE_TIER_FORM_OPTIONS,
  serializeCompanyGuidelines,
  SUNGLASSES_OPTIONS,
  type LightReactivePolicy,
  type SunglassesPolicy,
} from '@/lib/program-options';

type ProgramFormState = {
  company_name: string;
  company_code: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  approval_required: boolean;
  supervisor_emails: string[];
  invoice_terms: PaymentTerms;
  program_type: (typeof PROGRAM_TYPE_OPTIONS)[number];
  employee_count: number;
  light_reactive_policy: LightReactivePolicy;
  sunglasses_policy: SunglassesPolicy;
  loyalty_credit_count: number;
  referral_credit_count: number;
  eu_package: (typeof EU_PACKAGE_FORM_OPTIONS)[number];
  eu_package_add_ons: EUPackageAddOnKey[];
  eu_package_custom_adjustments: PriceAdjustment[];
  service_tier: ServiceTier;
  service_tier_custom_adjustments: PriceAdjustment[];
};

const ADD_ON_KEYS = Object.keys(EU_PACKAGE_ADD_ON_LABELS) as EUPackageAddOnKey[];

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';
const labelClass = 'mb-1 block text-xs font-medium text-gray-600';

function emptyAdjustment(): PriceAdjustment {
  return { label: '', amount: 0 };
}

type ProgramFormProps = {
  initiallyOpen?: boolean;
  showTrigger?: boolean;
  redirectOnSave?: string;
};

export default function ProgramForm({ initiallyOpen = false, showTrigger = true, redirectOnSave }: ProgramFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen || !showTrigger);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<ProgramFormState>({
    company_name: '',
    company_code: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    approval_required: true,
    supervisor_emails: [''],
    invoice_terms: normalizeInvoiceTerms('NET30'),
    program_type: normalizeProgramType('prescription safety eyewear'),
    employee_count: 0,
    light_reactive_policy: '',
    sunglasses_policy: '',
    loyalty_credit_count: 0,
    referral_credit_count: 0,
    eu_package: 'Compliance',
    eu_package_add_ons: [],
    eu_package_custom_adjustments: [],
    service_tier: 'Essential',
    service_tier_custom_adjustments: [],
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
  const projectedMonthly = totalPerEmployee * (Number(form.employee_count) || 0);

  function update<K extends keyof ProgramFormState>(key: K, value: ProgramFormState[K]) {
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
    update(key, [...form[key], emptyAdjustment()]);
  }

  function removeAdjustment(key: 'eu_package_custom_adjustments' | 'service_tier_custom_adjustments', index: number) {
    update(
      key,
      form[key].filter((_, adjustmentIndex) => adjustmentIndex !== index)
    );
  }

  async function handleSave() {
    if (!form.company_name.trim()) {
      setMessage('Company name is required.');
      return;
    }

    setSaving(true);
    setMessage('');
    const res = await fetch('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: form.company_name.trim(),
        company_code: form.company_code.trim() || null,
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        approval_required: form.approval_required,
        approver_emails: form.supervisor_emails.map((email) => email.trim()).filter(Boolean),
        invoice_terms: form.invoice_terms,
        program_type: form.program_type,
        employee_count: Number(form.employee_count) || 0,
        restricted_guidelines:
          serializeCompanyGuidelines({
            lightReactive: form.light_reactive_policy,
            sunglasses: form.sunglasses_policy,
          }) || null,
        loyalty_credit_count: Number(form.loyalty_credit_count) || 0,
        referral_credit_count: Number(form.referral_credit_count) || 0,
        eu_package: form.eu_package,
        eu_package_add_ons: form.eu_package_add_ons,
        eu_package_custom_adjustments: safeParsePriceAdjustments(form.eu_package_custom_adjustments),
        service_tier: form.service_tier,
        service_tier_custom_adjustments: safeParsePriceAdjustments(form.service_tier_custom_adjustments),
      }),
    });
    setSaving(false);

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error || 'Failed to save company');
      return;
    }

    if (redirectOnSave) {
      router.push(redirectOnSave);
      router.refresh();
      return;
    }

    if (!showTrigger && body.company?.id) {
      router.push(`/programs/${body.company.id}`);
      router.refresh();
      return;
    }

    setOpen(false);
    setMessage('Company saved.');
    router.refresh();
  }

  if (showTrigger && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        + New Company
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="mb-4 font-semibold text-gray-800">New Company</h3>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass}>Company Name</label>
          <input
            placeholder="Company Name *"
            value={form.company_name}
            onChange={(e) => update('company_name', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Company Code</label>
          <input
            placeholder="Internal company code"
            value={form.company_code}
            onChange={(e) => update('company_code', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Program Type</label>
          <select value={form.program_type} onChange={(e) => update('program_type', e.target.value as ProgramFormState['program_type'])} className={inputClass}>
            {PROGRAM_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Point of Contact Name</label>
          <input value={form.contact_name} onChange={(e) => update('contact_name', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Point of Contact Email</label>
          <input type="email" value={form.contact_email} onChange={(e) => update('contact_email', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Point of Contact Phone</label>
          <input value={form.contact_phone} onChange={(e) => update('contact_phone', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Net Terms</label>
          <select value={form.invoice_terms} onChange={(e) => update('invoice_terms', e.target.value as PaymentTerms)} className={inputClass}>
            {NET_TERM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Employee Count</label>
          <input
            type="number"
            min="0"
            value={form.employee_count}
            onChange={(e) => update('employee_count', Number(e.target.value) || 0)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="mb-3 text-sm font-semibold text-gray-700">EU Package</h4>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass}>Package</label>
            <select
              value={form.eu_package}
              onChange={(e) => update('eu_package', e.target.value as ProgramFormState['eu_package'])}
              className={inputClass}
            >
              {EU_PACKAGE_FORM_OPTIONS.map((euPackage) => (
                <option key={euPackage} value={euPackage}>
                  {euPackage} (${PRICING.euAllowancePerEmployee[euPackage]} / employee)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Package Add-Ons</label>
            <div className="space-y-1 rounded-lg border border-gray-200 bg-white p-2">
              {ADD_ON_KEYS.map((key) => (
                <label key={key} className="flex items-center justify-between gap-2 text-sm text-gray-700">
                  <span>
                    <input
                      type="checkbox"
                      checked={form.eu_package_add_ons.includes(key)}
                      onChange={() => toggleAddOn(key)}
                      className="mr-2"
                    />
                    {EU_PACKAGE_ADD_ON_LABELS[key]}
                  </span>
                  <span className="text-xs text-gray-500">+${PRICING.euPackageAddOnsPerEmployee[key]}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">EU Custom Adjustments</p>
          {form.eu_package_custom_adjustments.map((adjustment, index) => (
            <div key={`eu-adjustment-${index}`} className="grid grid-cols-[1fr_120px_auto] gap-2">
              <input
                placeholder="Adjustment label"
                value={adjustment.label}
                onChange={(e) => updateAdjustment('eu_package_custom_adjustments', index, { label: e.target.value })}
                className={inputClass}
              />
              <input
                type="number"
                step="0.01"
                value={adjustment.amount}
                onChange={(e) =>
                  updateAdjustment('eu_package_custom_adjustments', index, { amount: Number(e.target.value) || 0 })
                }
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => removeAdjustment('eu_package_custom_adjustments', index)}
                className="rounded-lg border border-red-200 px-3 text-sm text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => addAdjustment('eu_package_custom_adjustments')}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white"
          >
            + Add EU Adjustment
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="mb-3 text-sm font-semibold text-gray-700">Service Tier</h4>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass}>Tier</label>
            <select
              value={form.service_tier}
              onChange={(e) => update('service_tier', e.target.value as ServiceTier)}
              className={inputClass}
            >
              {SERVICE_TIER_FORM_OPTIONS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier} (${PRICING.serviceFeePerEmployee[tier]} / employee, {PRICING.standardVisitsByTier[tier]} visits)
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-600">
            <p>Included visits by tier: {PRICING.standardVisitsByTier[form.service_tier]}</p>
            <p>Extra site visit fee: ${PRICING.extraSiteVisitFee}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Service Tier Custom Adjustments</p>
          {form.service_tier_custom_adjustments.map((adjustment, index) => (
            <div key={`tier-adjustment-${index}`} className="grid grid-cols-[1fr_120px_auto] gap-2">
              <input
                placeholder="Adjustment label"
                value={adjustment.label}
                onChange={(e) => updateAdjustment('service_tier_custom_adjustments', index, { label: e.target.value })}
                className={inputClass}
              />
              <input
                type="number"
                step="0.01"
                value={adjustment.amount}
                onChange={(e) =>
                  updateAdjustment('service_tier_custom_adjustments', index, { amount: Number(e.target.value) || 0 })
                }
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => removeAdjustment('service_tier_custom_adjustments', index)}
                className="rounded-lg border border-red-200 px-3 text-sm text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => addAdjustment('service_tier_custom_adjustments')}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white"
          >
            + Add Tier Adjustment
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className={labelClass}>Supervisor Email</label>
          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            {form.supervisor_emails.map((email, index) => (
              <div key={`supervisor-email-${index}`} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => updateSupervisorEmail(index, e.target.value)}
                  placeholder={`Supervisor email ${index + 1}`}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => removeSupervisorEmail(index)}
                  className="rounded-lg border border-red-200 px-3 text-sm text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addSupervisorEmail}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white"
            >
              + Add Supervisor
            </button>
          </div>
        </div>

        <div>
          <label className={labelClass}>Loyalty Credits</label>
          <input
            type="number"
            min="0"
            value={form.loyalty_credit_count}
            onChange={(e) => update('loyalty_credit_count', Number(e.target.value) || 0)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Referral Credits</label>
          <input
            type="number"
            min="0"
            value={form.referral_credit_count}
            onChange={(e) => update('referral_credit_count', Number(e.target.value) || 0)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass}>Company Guidelines: Light Reactive</label>
          <select
            value={form.light_reactive_policy}
            onChange={(e) => update('light_reactive_policy', e.target.value as LightReactivePolicy)}
            className={inputClass}
          >
            {LIGHT_REACTIVE_OPTIONS.map((option) => (
              <option key={option.value || 'blank'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Company Guidelines: Sun Glasses</label>
          <select
            value={form.sunglasses_policy}
            onChange={(e) => update('sunglasses_policy', e.target.value as SunglassesPolicy)}
            className={inputClass}
          >
            {SUNGLASSES_OPTIONS.map((option) => (
              <option key={option.value || 'blank'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
        <p className="font-semibold text-blue-800">Pricing Summary</p>
        <p className="mt-1 text-blue-700">EU allowance per employee: ${euPerEmployee.toFixed(2)}</p>
        <p className="text-blue-700">Service fee per employee: ${servicePerEmployee.toFixed(2)}</p>
        <p className="text-blue-700">Total per employee: ${totalPerEmployee.toFixed(2)}</p>
        <p className="text-blue-700">Projected monthly (based on employee count): ${projectedMonthly.toFixed(2)}</p>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.approval_required}
          onChange={(e) => update('approval_required', e.target.checked)}
        />
        Require supervisor approval before processing
      </label>

      {message && <p className="mb-4 text-sm text-gray-700">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {saving ? 'Saving...' : 'Save Company'}
        </button>
        {showTrigger && (
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
