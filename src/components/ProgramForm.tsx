'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { EUPackage, EUPackageAddOnKey, PriceAdjustment, ServiceTier } from '@/lib/pricing';
import {
  calculateEuPackagePerEmployee,
  calculateServiceTierPerEmployee,
  EU_PACKAGE_ADD_ON_LABELS,
  PRICING,
  safeParsePriceAdjustments,
} from '@/lib/pricing';

type ProgramFormState = {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  approval_required: boolean;
  approver_emails: string;
  invoice_terms: string;
  program_type: string;
  employee_count: number;
  restricted_guidelines: string;
  loyalty_credit_count: number;
  referral_credit_count: number;
  eu_package: EUPackage;
  eu_package_add_ons: EUPackageAddOnKey[];
  eu_package_custom_adjustments: PriceAdjustment[];
  service_tier: ServiceTier;
  service_tier_custom_adjustments: PriceAdjustment[];
};

const EU_PACKAGES: EUPackage[] = ['Compliance', 'Comfort', 'Complete', 'Covered'];
const SERVICE_TIERS: ServiceTier[] = ['Essential', 'Access', 'Premier', 'Enterprise'];
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
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen || !showTrigger);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProgramFormState>({
    company_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    approval_required: true,
    approver_emails: '',
    invoice_terms: 'Net 30',
    program_type: 'Safety Eyewear',
    employee_count: 0,
    restricted_guidelines: '',
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
      form[key].filter((_, i) => i !== index)
    );
  }

  async function handleSave() {
    if (!form.company_name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('programs')
      .insert({
      company_name: form.company_name.trim(),
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      approval_required: form.approval_required,
      approver_emails: form.approver_emails
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean),
      invoice_terms: form.invoice_terms.trim() || null,
      program_type: form.program_type.trim() || null,
      employee_count: Number(form.employee_count) || 0,
      restricted_guidelines: form.restricted_guidelines.trim() || null,
      loyalty_credit_count: Number(form.loyalty_credit_count) || 0,
      referral_credit_count: Number(form.referral_credit_count) || 0,
      eu_package: form.eu_package,
      eu_package_add_ons: form.eu_package_add_ons,
      eu_package_custom_adjustments: safeParsePriceAdjustments(form.eu_package_custom_adjustments),
      service_tier: form.service_tier,
      service_tier_custom_adjustments: safeParsePriceAdjustments(form.service_tier_custom_adjustments),
      })
      .select('id')
      .single();
    setSaving(false);
    if (error) {
      alert(`Failed to save company: ${error.message}`);
      return;
    }
    if (redirectOnSave) {
      router.push(redirectOnSave);
      router.refresh();
      return;
    }

    if (!showTrigger && data?.id) {
      router.push(`/programs/${data.id}`);
      router.refresh();
      return;
    }

    setOpen(false);
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
          <label className={labelClass}>Program Type</label>
          <input value={form.program_type} onChange={(e) => update('program_type', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>POC Name</label>
          <input value={form.contact_name} onChange={(e) => update('contact_name', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>POC Email</label>
          <input type="email" value={form.contact_email} onChange={(e) => update('contact_email', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>POC Phone</label>
          <input value={form.contact_phone} onChange={(e) => update('contact_phone', e.target.value)} className={inputClass} />
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
              onChange={(e) => update('eu_package', e.target.value as EUPackage)}
              className={inputClass}
            >
              {EU_PACKAGES.map((euPackage) => (
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
              {SERVICE_TIERS.map((tier) => (
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
        <div>
          <label className={labelClass}>Approver Emails (comma-separated)</label>
          <input value={form.approver_emails} onChange={(e) => update('approver_emails', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Invoice Terms</label>
          <input value={form.invoice_terms} onChange={(e) => update('invoice_terms', e.target.value)} className={inputClass} />
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

      <div className="mb-6">
          <label className={labelClass}>Company Guidelines</label>
        <textarea
          rows={4}
          value={form.restricted_guidelines}
          onChange={(e) => update('restricted_guidelines', e.target.value)}
          className={inputClass}
          placeholder="Company restrictions, ordering rules, approval notes, and safety requirements."
        />
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
        Require approval before processing
      </label>

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
