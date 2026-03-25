'use client';

import { useMemo, useState } from 'react';
import {
  EU_PACKAGE_ADD_ON_LABELS,
  PRICING,
  type EUPackage,
  type EUPackageAddOnKey,
  type ServiceTier,
} from '@/lib/pricing';

const STORAGE_KEY = 'osso_pricing_editor_overrides_v1';

type EditablePricing = {
  euAllowancePerEmployee: Record<EUPackage, number>;
  euPackageAddOnsPerEmployee: Record<EUPackageAddOnKey, number>;
  serviceFeePerEmployee: Record<ServiceTier, number>;
  standardVisitsByTier: Record<ServiceTier, number>;
  travel: {
    includedOneWayMiles: number;
    dollarsPerMileOver: number;
    roundTripMultiplier: number;
  };
  onboardingFeeSingleSiteStandard: number;
  onboardingFeeAdditionalSite: number;
  supplementalProgramTotal: number;
  extraSiteVisitFee: number;
};

function defaultPricing(): EditablePricing {
  return {
    euAllowancePerEmployee: { ...PRICING.euAllowancePerEmployee },
    euPackageAddOnsPerEmployee: { ...PRICING.euPackageAddOnsPerEmployee },
    serviceFeePerEmployee: { ...PRICING.serviceFeePerEmployee },
    standardVisitsByTier: { ...PRICING.standardVisitsByTier },
    travel: { ...PRICING.travel },
    onboardingFeeSingleSiteStandard: PRICING.onboardingFeeSingleSiteStandard,
    onboardingFeeAdditionalSite: PRICING.onboardingFeeAdditionalSite,
    supplementalProgramTotal: PRICING.supplementalProgramTotal,
    extraSiteVisitFee: PRICING.extraSiteVisitFee,
  };
}

export default function PricingSettingsEditor() {
  const [pricing, setPricing] = useState<EditablePricing>(() => {
    const defaults = defaultPricing();
    if (typeof window === 'undefined') return defaults;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;

    try {
      const parsed = JSON.parse(raw) as EditablePricing;
      return parsed;
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      return defaults;
    }
  });
  const [message, setMessage] = useState('');

  const euPackages = useMemo(() => Object.keys(pricing.euAllowancePerEmployee) as EUPackage[], [pricing]);
  const serviceTiers = useMemo(() => Object.keys(pricing.serviceFeePerEmployee) as ServiceTier[], [pricing]);
  const addOns = useMemo(() => Object.keys(pricing.euPackageAddOnsPerEmployee) as EUPackageAddOnKey[], [pricing]);

  function save() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pricing));
    setMessage('Saved locally for pricing scenario editing.');
  }

  function reset() {
    const defaults = defaultPricing();
    setPricing(defaults);
    window.localStorage.removeItem(STORAGE_KEY);
    setMessage('Reset to canonical defaults.');
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#6f5b40]">Edit pricing values for admin review and scenario planning. Saved values are local to your browser.</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {euPackages.map((euPackage) => (
          <label key={euPackage} className="rounded-lg border border-[#e5d5bb] bg-[#fffdf8] px-4 py-3 text-sm">
            <span className="block font-semibold text-[#2f2416]">{euPackage}</span>
            <input
              type="number"
              step="0.01"
              value={pricing.euAllowancePerEmployee[euPackage]}
              onChange={(e) => setPricing((prev) => ({
                ...prev,
                euAllowancePerEmployee: { ...prev.euAllowancePerEmployee, [euPackage]: Number(e.target.value) || 0 },
              }))}
              className="pos-input mt-2"
            />
          </label>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {addOns.map((addOn) => (
          <label key={addOn} className="rounded-lg border border-[#e5d5bb] bg-[#fffdf8] px-4 py-3 text-sm">
            <span className="block font-semibold text-[#2f2416]">{EU_PACKAGE_ADD_ON_LABELS[addOn]}</span>
            <input
              type="number"
              step="0.01"
              value={pricing.euPackageAddOnsPerEmployee[addOn]}
              onChange={(e) => setPricing((prev) => ({
                ...prev,
                euPackageAddOnsPerEmployee: {
                  ...prev.euPackageAddOnsPerEmployee,
                  [addOn]: Number(e.target.value) || 0,
                },
              }))}
              className="pos-input mt-2"
            />
          </label>
        ))}
      </div>

      <div className="space-y-3">
        {serviceTiers.map((tier) => (
          <div key={tier} className="rounded-lg border border-[#e5d5bb] bg-[#fffdf8] px-4 py-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <p className="font-semibold text-[#2f2416]">{tier}</p>
            <input
              type="number"
              step="0.01"
              value={pricing.serviceFeePerEmployee[tier]}
              onChange={(e) => setPricing((prev) => ({
                ...prev,
                serviceFeePerEmployee: { ...prev.serviceFeePerEmployee, [tier]: Number(e.target.value) || 0 },
              }))}
              className="pos-input"
            />
            <input
              type="number"
              step="1"
              value={pricing.standardVisitsByTier[tier]}
              onChange={(e) => setPricing((prev) => ({
                ...prev,
                standardVisitsByTier: { ...prev.standardVisitsByTier, [tier]: Number(e.target.value) || 0 },
              }))}
              className="pos-input"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block font-semibold text-[#2f2416]">Onboarding Fee (Single Site)</span>
          <input
            type="number"
            step="0.01"
            value={pricing.onboardingFeeSingleSiteStandard}
            onChange={(e) => setPricing((prev) => ({ ...prev, onboardingFeeSingleSiteStandard: Number(e.target.value) || 0 }))}
            className="pos-input mt-2"
          />
        </label>
        <label className="text-sm">
          <span className="block font-semibold text-[#2f2416]">Onboarding Fee (Additional Site)</span>
          <input
            type="number"
            step="0.01"
            value={pricing.onboardingFeeAdditionalSite}
            onChange={(e) => setPricing((prev) => ({ ...prev, onboardingFeeAdditionalSite: Number(e.target.value) || 0 }))}
            className="pos-input mt-2"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} className="pos-btn-primary">Save Edits</button>
        <button type="button" onClick={reset} className="pos-btn-secondary">Reset Defaults</button>
      </div>
      {message && <p className="text-sm text-[#6f5b40]">{message}</p>}
    </div>
  );
}
