import Link from 'next/link';
import {
  EU_PACKAGE_ADD_ON_LABELS,
  PRICING,
  type EUPackage,
  type EUPackageAddOnKey,
  type ServiceTier,
} from '@/lib/pricing';

const EU_PACKAGES = Object.keys(PRICING.euAllowancePerEmployee) as EUPackage[];
const SERVICE_TIERS = Object.keys(PRICING.serviceFeePerEmployee) as ServiceTier[];
const EU_ADD_ONS = Object.keys(PRICING.euPackageAddOnsPerEmployee) as EUPackageAddOnKey[];

export default function PricingSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-800">
          {'<- Settings'}
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Pricing</h1>
          <p className="mt-1 text-sm text-gray-500">
            Canonical pricing matrix used by company package planning and order quoting logic.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">EU Package Allowance (Per Employee)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {EU_PACKAGES.map((euPackage) => (
            <div key={euPackage} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-sm font-semibold text-gray-800">{euPackage}</p>
              <p className="text-sm text-gray-600">${PRICING.euAllowancePerEmployee[euPackage].toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">EU Add-Ons (Per Employee)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {EU_ADD_ONS.map((addOn) => (
            <div key={addOn} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-sm font-semibold text-gray-800">{EU_PACKAGE_ADD_ON_LABELS[addOn]}</p>
              <p className="text-sm text-gray-600">${PRICING.euPackageAddOnsPerEmployee[addOn].toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Service Tier Pricing</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2">Tier</th>
                <th className="py-2">Per-Employee Fee</th>
                <th className="py-2">Included Standard Visits</th>
              </tr>
            </thead>
            <tbody>
              {SERVICE_TIERS.map((tier) => (
                <tr key={tier} className="border-b border-gray-100">
                  <td className="py-2 font-medium text-gray-800">{tier}</td>
                  <td className="py-2 text-gray-700">${PRICING.serviceFeePerEmployee[tier].toFixed(2)}</td>
                  <td className="py-2 text-gray-700">{PRICING.standardVisitsByTier[tier]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold">Travel Rules</h2>
          <p className="text-sm text-gray-700">Included one-way miles: {PRICING.travel.includedOneWayMiles}</p>
          <p className="text-sm text-gray-700">Dollars per mile over allowance: ${PRICING.travel.dollarsPerMileOver}</p>
          <p className="text-sm text-gray-700">Round-trip multiplier: {PRICING.travel.roundTripMultiplier}x</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold">Global Fees</h2>
          <p className="text-sm text-gray-700">
            Onboarding fee (single site): ${PRICING.onboardingFeeSingleSiteStandard.toFixed(2)}
          </p>
          <p className="text-sm text-gray-700">
            Onboarding fee (additional site): ${PRICING.onboardingFeeAdditionalSite.toFixed(2)}
          </p>
          <p className="text-sm text-gray-700">
            Supplemental program total: ${PRICING.supplementalProgramTotal.toFixed(2)}
          </p>
          <p className="text-sm text-gray-700">Extra site visit fee: ${PRICING.extraSiteVisitFee.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
