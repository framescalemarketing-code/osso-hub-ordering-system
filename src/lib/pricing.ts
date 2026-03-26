import type { EuPackageLabel, ServiceTierLabel } from '@/lib/ordering-domain';

export type EUPackage = EuPackageLabel;
export type ServiceTier = ServiceTierLabel;
export type EUPackageAddOnKey =
  | 'antiFog'
  | 'antiReflectiveStd'
  | 'antiReflectiveAntiFogCombo'
  | 'blueLightAntiReflective'
  | 'blueLightFilter'
  | 'transitions'
  | 'extraScratchCoating';
export type PaymentTerms = 'NET15' | 'NET30' | 'NET45' | 'NET60' | 'NET75';
export type PaymentDiscount = 'none' | '2_15_NET15';

export type PriceAdjustment = {
  label: string;
  amount: number;
};

export const PRICING = {
  onboardingFeeSingleSiteStandard: 1200,
  onboardingFeeAdditionalSite: 500,
  supplementalProgramTotal: 340,
  supplementalProgramServiceChargeCount: 1,
  extraSiteVisitFee: 60,
  euAllowancePerEmployee: {
    Compliance: 235,
    Comfort: 290,
    Complete: 435,
  } satisfies Record<EUPackage, number>,
  serviceFeePerEmployee: {
    Essential: 65,
    Access: 85,
    Premier: 105,
  } satisfies Record<ServiceTier, number>,
  standardVisitsByTier: {
    Essential: 2,
    Access: 6,
    Premier: 12,
  } satisfies Record<ServiceTier, number>,
  euPackageAddOnsPerEmployee: {
    antiFog: 65,
    antiReflectiveStd: 50,
    antiReflectiveAntiFogCombo: 95,
    blueLightAntiReflective: 90,
    blueLightFilter: 50,
    transitions: 135,
    extraScratchCoating: 65,
  } satisfies Record<EUPackageAddOnKey, number>,
  travel: {
    includedOneWayMiles: 50,
    dollarsPerMileOver: 1,
    roundTripMultiplier: 2,
  },
  financeFeesPerInvoice: {
    NET15: 0,
    NET30: 15,
    NET45: 30,
    NET60: 45,
    NET75: 60,
  } satisfies Record<PaymentTerms, number>,
  paymentDiscounts: {
    none: 0,
    '2_15_NET15': 0.02,
  } satisfies Record<PaymentDiscount, number>,
};

export const EU_PACKAGE_ADD_ON_LABELS: Record<EUPackageAddOnKey, string> = {
  antiFog: 'Anti-Fog',
  antiReflectiveStd: 'Anti-Reflective Standard',
  antiReflectiveAntiFogCombo: 'Anti-Reflective + Anti-Fog Combo',
  blueLightAntiReflective: 'Blue Light + Anti-Reflective',
  blueLightFilter: 'Blue Light Filter',
  transitions: 'Transitions',
  extraScratchCoating: 'Extra Scratch Coating',
};

export function calculateEuPackagePerEmployee(
  euPackage: EUPackage,
  addOns: EUPackageAddOnKey[],
  adjustments: PriceAdjustment[] = []
): number {
  const base = PRICING.euAllowancePerEmployee[euPackage];
  const addOnsTotal = addOns.reduce((sum, key) => sum + PRICING.euPackageAddOnsPerEmployee[key], 0);
  const adjustmentsTotal = adjustments.reduce((sum, adjustment) => sum + (Number(adjustment.amount) || 0), 0);
  return base + addOnsTotal + adjustmentsTotal;
}

export function calculateServiceTierPerEmployee(
  tier: ServiceTier,
  adjustments: PriceAdjustment[] = []
): number {
  const base = PRICING.serviceFeePerEmployee[tier];
  const adjustmentsTotal = adjustments.reduce((sum, adjustment) => sum + (Number(adjustment.amount) || 0), 0);
  return base + adjustmentsTotal;
}

export function safeParsePriceAdjustments(input: unknown): PriceAdjustment[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const candidate = entry as { label?: unknown; amount?: unknown };
      const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
      const amount = Number(candidate.amount);
      if (!label || Number.isNaN(amount)) return null;
      return { label, amount };
    })
    .filter((entry): entry is PriceAdjustment => !!entry);
}
