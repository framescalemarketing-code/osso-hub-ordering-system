import { ACTIVE_EU_PACKAGE_LABELS, ACTIVE_SERVICE_TIER_LABELS } from '@/lib/ordering-domain';
import type { EUPackage, PaymentTerms, ServiceTier } from '@/lib/pricing';

export const PROGRAM_TYPE_OPTIONS = [
  'prescription safety eyewear',
  'non prescription safety eyewear',
  'prescription safety eyewear + non prescription safety eyewear',
] as const;

export const EU_PACKAGE_FORM_OPTIONS: EUPackage[] = [...ACTIVE_EU_PACKAGE_LABELS];
export const SERVICE_TIER_FORM_OPTIONS: ServiceTier[] = [...ACTIVE_SERVICE_TIER_LABELS];

export const NET_TERM_OPTIONS: Array<{ value: PaymentTerms; label: string }> = [
  { value: 'NET15', label: 'Net 15' },
  { value: 'NET30', label: 'Net 30' },
  { value: 'NET45', label: 'Net 45' },
  { value: 'NET60', label: 'Net 60' },
  { value: 'NET75', label: 'Net 75' },
];

export type LightReactivePolicy = '' | 'available_with_approval' | 'not_available';
export type SunglassesPolicy =
  | ''
  | 'available_with_approval'
  | 'not_available'
  | 'does_not_include_prescription_tint';

export const LIGHT_REACTIVE_OPTIONS: Array<{ value: LightReactivePolicy; label: string }> = [
  { value: '', label: 'Select an option' },
  { value: 'available_with_approval', label: 'Available with approval' },
  { value: 'not_available', label: 'Not available' },
];

export const SUNGLASSES_OPTIONS: Array<{ value: SunglassesPolicy; label: string }> = [
  { value: '', label: 'Select an option' },
  { value: 'available_with_approval', label: 'Available with approval' },
  { value: 'not_available', label: 'Not available' },
  { value: 'does_not_include_prescription_tint', label: 'Does not include prescription tint' },
];

export function normalizeProgramType(value?: string | null): (typeof PROGRAM_TYPE_OPTIONS)[number] {
  const normalized = (value || '').trim().toLowerCase();
  if (
    normalized === 'non prescription safety eyewear' ||
    normalized === 'non-prescription safety eyewear' ||
    normalized === 'non prescription only'
  ) {
    return 'non prescription safety eyewear';
  }
  if (
    normalized === 'prescription safety eyewear + non prescription safety eyewear' ||
    normalized === 'prescription + non-prescription safety eyewear' ||
    normalized === 'prescription + non prescription safety eyewear'
  ) {
    return 'prescription safety eyewear + non prescription safety eyewear';
  }
  return 'prescription safety eyewear';
}

export function normalizeInvoiceTerms(value?: string | null): PaymentTerms {
  const normalized = (value || '').trim().toUpperCase().replace(/\s+/g, '');
  switch (normalized) {
    case 'NET15':
      return 'NET15';
    case 'NET45':
      return 'NET45';
    case 'NET60':
      return 'NET60';
    case 'NET75':
      return 'NET75';
    case 'NET30':
    case '':
      return 'NET30';
    default:
      return 'NET30';
  }
}

export function formatInvoiceTerms(value?: string | null): string {
  const term = normalizeInvoiceTerms(value);
  return NET_TERM_OPTIONS.find((option) => option.value === term)?.label || 'Net 30';
}

type GuidelineSelection = {
  lightReactive: LightReactivePolicy;
  sunglasses: SunglassesPolicy;
};

const guidelineValueToLabel: Record<Exclude<LightReactivePolicy | SunglassesPolicy, ''>, string> = {
  available_with_approval: 'Available with approval',
  not_available: 'Not available',
  does_not_include_prescription_tint: 'Does not include prescription tint',
};

const guidelineLabelToValue = Object.entries(guidelineValueToLabel).reduce<Record<string, string>>((acc, [value, label]) => {
  acc[label.toLowerCase()] = value;
  return acc;
}, {});
guidelineLabelToValue['covered with approval'] = 'available_with_approval';

export function serializeCompanyGuidelines(selection: GuidelineSelection): string | null {
  const lines: string[] = [];
  if (selection.lightReactive) {
    lines.push(`Light Reactive: ${guidelineValueToLabel[selection.lightReactive]}`);
  }
  if (selection.sunglasses) {
    lines.push(`Sun Glasses: ${guidelineValueToLabel[selection.sunglasses]}`);
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

export function parseCompanyGuidelines(value?: string | null): GuidelineSelection {
  const parsed: GuidelineSelection = {
    lightReactive: '',
    sunglasses: '',
  };

  for (const line of (value || '').split('\n')) {
    const [rawKey, rawLabel] = line.split(':');
    if (!rawKey || !rawLabel) continue;

    const key = rawKey.trim().toLowerCase();
    const mappedValue = guidelineLabelToValue[rawLabel.trim().toLowerCase()];
    if (!mappedValue) continue;

    if (key === 'light reactive') {
      parsed.lightReactive = mappedValue as LightReactivePolicy;
    }
    if (key === 'sun glasses') {
      parsed.sunglasses = mappedValue as SunglassesPolicy;
    }
  }

  return parsed;
}
