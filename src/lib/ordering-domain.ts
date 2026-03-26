export const EU_PACKAGE_LABELS = {
  COMPLIANCE: 'Compliance',
  COMFORT: 'Comfort',
  COMPLETE: 'Complete',
} as const;

export type EuPackageCode = keyof typeof EU_PACKAGE_LABELS;
export type EuPackageLabel = (typeof EU_PACKAGE_LABELS)[EuPackageCode];

export const SERVICE_TIER_LABELS = {
  ESSENTIAL: 'Essential',
  ACCESS: 'Access',
  PREMIER: 'Premier',
} as const;

export type ServiceTierCode = keyof typeof SERVICE_TIER_LABELS;
export type ServiceTierLabel = (typeof SERVICE_TIER_LABELS)[ServiceTierCode];

export const ORDERING_EU_PACKAGES = (
  Object.keys(EU_PACKAGE_LABELS) as EuPackageCode[]
).map((code) => ({ code, label: EU_PACKAGE_LABELS[code] }));

export const ORDERING_SERVICE_TIERS = (
  Object.keys(SERVICE_TIER_LABELS) as ServiceTierCode[]
).map((code) => ({ code, label: SERVICE_TIER_LABELS[code] }));

export const ACTIVE_EU_PACKAGE_LABELS = ORDERING_EU_PACKAGES.map((entry) => entry.label);
export const ACTIVE_SERVICE_TIER_LABELS = ORDERING_SERVICE_TIERS.map((entry) => entry.label);

const EU_PACKAGE_LOOKUP = ORDERING_EU_PACKAGES.reduce<Record<string, EuPackageLabel>>((acc, entry) => {
  acc[entry.code] = entry.label;
  acc[entry.label.toUpperCase()] = entry.label;
  return acc;
}, {});

const SERVICE_TIER_LOOKUP = ORDERING_SERVICE_TIERS.reduce<Record<string, ServiceTierLabel>>((acc, entry) => {
  acc[entry.code] = entry.label;
  acc[entry.label.toUpperCase()] = entry.label;
  return acc;
}, {});

export function normalizeEuPackageLabel(value?: string | null): EuPackageLabel | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return EU_PACKAGE_LOOKUP[normalized.toUpperCase()] || null;
}

export function normalizeServiceTierLabel(value?: string | null): ServiceTierLabel | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return SERVICE_TIER_LOOKUP[normalized.toUpperCase()] || null;
}

export type CurrencyCode = 'USD';
export type CatalogItemType = 'package' | 'service_tier' | 'add_on' | 'support';
export type CatalogItemCategory = 'eu_package' | 'service_tier' | 'program_add_on' | 'support';
export type CatalogItemStatus = 'active' | 'inactive';
export type ProgramBucketType = 'eu_package' | 'service_tier';
export type ProgramBucketStatus = 'active' | 'inactive';

export type ProgramBucketCode =
  | 'EU_COMPLIANCE'
  | 'EU_COMFORT'
  | 'EU_COMPLETE'
  | 'SERVICE_ESSENTIAL'
  | 'SERVICE_ACCESS'
  | 'SERVICE_PREMIER';

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  description: string;
  itemType: CatalogItemType;
  category: CatalogItemCategory;
  status: CatalogItemStatus;
  defaultAmount: number;
  currency: CurrencyCode;
  isProgramAssignable: boolean;
  isOrderSelectable: boolean;
  isBillable: boolean;
  displayOrder: number;
}

export interface ProgramBucket {
  id: string;
  code: ProgramBucketCode;
  name: string;
  bucketType: ProgramBucketType;
  displayOrder: number;
  status: ProgramBucketStatus;
}

export interface ProgramBucketItem {
  bucketCode: ProgramBucketCode;
  catalogItemCode: string;
  displayOrder: number;
}

export interface CompanyProgram {
  id: string;
  companyId: string;
  code: string;
  name: string;
  euPackageBucketCode: Extract<ProgramBucketCode, `EU_${string}`> | null;
  serviceTierBucketCode: Extract<ProgramBucketCode, `SERVICE_${string}`> | null;
  additionalCatalogItemCodes: string[];
  eligibilityConfigurationId: string | null;
  status: 'draft' | 'active' | 'inactive';
}

export const ELIGIBILITY_FIELD_KEYS = [
  'employeeId',
  'firstName',
  'lastName',
  'email',
  'companyId',
  'department',
  'location',
  'eligibilityStatus',
  'hireDate',
  'allowanceGroup',
  'notes',
] as const;

export type EligibilityFieldKey = (typeof ELIGIBILITY_FIELD_KEYS)[number];
export type EligibilityFieldType = 'text' | 'email' | 'date' | 'select' | 'textarea';
export type EligibilityStatus = 'eligible' | 'inactive' | 'pending' | 'unknown';

export interface EligibilityFieldDefinition {
  key: EligibilityFieldKey;
  label: string;
  required: boolean;
  fieldType: EligibilityFieldType;
  description?: string;
  example?: string;
}

export interface EligibilityImportTemplate {
  id: string;
  code: string;
  name: string;
  description: string;
  companyId: string | null;
  fieldDefinitions: EligibilityFieldDefinition[];
}

export interface EligibilityEmployeeRecord {
  employeeId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  companyId: string | null;
  department: string | null;
  location: string | null;
  eligibilityStatus: EligibilityStatus;
  hireDate: string | null;
  allowanceGroup: string | null;
  notes: string | null;
}

export interface CompanyEligibilityConfiguration {
  companyId: string | null;
  templateId: string;
  requiredFieldKeys: EligibilityFieldKey[];
  optionalFieldKeys: EligibilityFieldKey[];
  allowAdditionalFields: boolean;
}

export const CORE_OPERATIONAL_INTEGRATIONS = ['clickup', 'bigquery'] as const;
export type CoreOperationalIntegration = (typeof CORE_OPERATIONAL_INTEGRATIONS)[number];
