import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_ELIGIBILITY_FIELD_DEFINITIONS } from '@/lib/ordering-data';
import {
  normalizeEuPackageLabel,
  normalizeServiceTierLabel,
  type EligibilityFieldDefinition,
  type EligibilityFieldKey,
} from '@/lib/ordering-domain';
import { safeParsePriceAdjustments, type EUPackageAddOnKey } from '@/lib/pricing';

export type CompanyEligibilityFieldSelection = {
  key: EligibilityFieldKey;
  required: boolean;
  active: boolean;
};

export type ProgramMutationInput = {
  company_name?: string;
  company_code?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  invoice_terms?: string | null;
  approval_required?: boolean;
  approver_emails?: string[];
  program_type?: string | null;
  employee_count?: number | null;
  restricted_guidelines?: string | null;
  loyalty_credit_count?: number | null;
  referral_credit_count?: number | null;
  eu_package?: string | null;
  eu_package_add_ons?: EUPackageAddOnKey[];
  eu_package_custom_adjustments?: unknown;
  service_tier?: string | null;
  service_tier_custom_adjustments?: unknown;
  eligibility_fields?: CompanyEligibilityFieldSelection[];
};

export type NormalizedProgramMutation = {
  programPatch: Record<string, unknown>;
  eligibilityFields: CompanyEligibilityFieldSelection[] | null;
  companyName: string | null;
  companyCode: string | null;
  euPackage: ReturnType<typeof normalizeEuPackageLabel>;
  euPackageAddOns: EUPackageAddOnKey[];
  serviceTier: ReturnType<typeof normalizeServiceTierLabel>;
  isActive: boolean | null;
};

type ProgramBucketRow = {
  id: string;
  code: string;
};

type CatalogItemRow = {
  id: string;
  code: string;
  display_order: number;
};

type EligibilityFieldDefinitionRow = {
  id: string;
  key: EligibilityFieldKey;
  label: string;
  required_default: boolean;
  field_type: EligibilityFieldDefinition['fieldType'];
  description: string | null;
  example: string | null;
  display_order: number;
};

type EligibilityFieldConfigRow = {
  key: EligibilityFieldKey;
  label: string;
  required: boolean;
  active: boolean;
  fieldType: EligibilityFieldDefinition['fieldType'];
  description?: string;
  example?: string;
  displayOrder: number;
};

const ELIGIBILITY_FIELD_MAP = new Map(
  DEFAULT_ELIGIBILITY_FIELD_DEFINITIONS.map((field) => [field.key, field])
);

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeEligibilityFieldSelections(
  input: CompanyEligibilityFieldSelection[] | null | undefined
): CompanyEligibilityFieldSelection[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;

  const byKey = new Map<EligibilityFieldKey, CompanyEligibilityFieldSelection>();
  for (const field of input) {
    if (!field || !ELIGIBILITY_FIELD_MAP.has(field.key)) continue;
    byKey.set(field.key, {
      key: field.key,
      active: Boolean(field.active),
      required: field.key === 'firstName' || field.key === 'lastName' ? true : Boolean(field.required),
    });
  }

  const normalized = DEFAULT_ELIGIBILITY_FIELD_DEFINITIONS.map((field) => {
    const selected = byKey.get(field.key);
    if (!selected) {
      return {
        key: field.key,
        active: field.key === 'firstName' || field.key === 'lastName',
        required: field.required,
      };
    }

    return {
      key: field.key,
      active: field.key === 'firstName' || field.key === 'lastName' ? true : selected.active,
      required: field.key === 'firstName' || field.key === 'lastName' ? true : selected.required,
    };
  }).filter((field) => field.active);

  const hasEmployeeId = normalized.some((field) => field.key === 'employeeId');
  const hasEmail = normalized.some((field) => field.key === 'email');
  if (!hasEmployeeId && !hasEmail) {
    normalized.push({ key: 'employeeId', active: true, required: false });
  }

  return normalized;
}

export function normalizeProgramMutationInput(
  input: ProgramMutationInput,
  options?: { includeIsActive?: boolean }
): NormalizedProgramMutation {
  const programPatch: Record<string, unknown> = {};

  if (typeof input.company_name === 'string') programPatch.company_name = input.company_name.trim();
  if ('company_code' in input) programPatch.company_code = normalizeText(input.company_code);
  if ('contact_name' in input) programPatch.contact_name = normalizeText(input.contact_name);
  if ('contact_email' in input) programPatch.contact_email = normalizeText(input.contact_email);
  if ('contact_phone' in input) programPatch.contact_phone = normalizeText(input.contact_phone);
  if ('invoice_terms' in input) programPatch.invoice_terms = normalizeText(input.invoice_terms);
  if (typeof input.approval_required === 'boolean') programPatch.approval_required = input.approval_required;
  if (Array.isArray(input.approver_emails)) {
    programPatch.approver_emails = input.approver_emails.map((email) => email.trim()).filter(Boolean);
  }
  if ('program_type' in input) programPatch.program_type = normalizeText(input.program_type);
  if ('employee_count' in input) programPatch.employee_count = Number(input.employee_count) || 0;
  if ('restricted_guidelines' in input) {
    programPatch.restricted_guidelines = normalizeText(input.restricted_guidelines);
  }
  if ('loyalty_credit_count' in input) {
    programPatch.loyalty_credit_count = Number(input.loyalty_credit_count) || 0;
  }
  if ('referral_credit_count' in input) {
    programPatch.referral_credit_count = Number(input.referral_credit_count) || 0;
  }

  const euPackage = 'eu_package' in input ? normalizeEuPackageLabel(input.eu_package) : null;
  if ('eu_package' in input) programPatch.eu_package = euPackage;

  const euPackageAddOns = Array.isArray(input.eu_package_add_ons) ? input.eu_package_add_ons : [];
  if (Array.isArray(input.eu_package_add_ons)) programPatch.eu_package_add_ons = euPackageAddOns;

  if ('eu_package_custom_adjustments' in input) {
    programPatch.eu_package_custom_adjustments = safeParsePriceAdjustments(
      input.eu_package_custom_adjustments
    );
  }

  const serviceTier = 'service_tier' in input ? normalizeServiceTierLabel(input.service_tier) : null;
  if ('service_tier' in input) programPatch.service_tier = serviceTier;

  if ('service_tier_custom_adjustments' in input) {
    programPatch.service_tier_custom_adjustments = safeParsePriceAdjustments(
      input.service_tier_custom_adjustments
    );
  }

  const isActive =
    options?.includeIsActive && 'is_active' in input
      ? Boolean((input as ProgramMutationInput & { is_active?: boolean }).is_active)
      : null;

  return {
    programPatch,
    eligibilityFields: normalizeEligibilityFieldSelections(input.eligibility_fields),
    companyName: normalizeText(input.company_name),
    companyCode: normalizeText(input.company_code),
    euPackage,
    euPackageAddOns,
    serviceTier,
    isActive,
  };
}

function buildCompanyProgramCode(programId: string, companyCode: string | null): string {
  return companyCode?.trim() || `PROGRAM-${programId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function getEuBucketCode(euPackage: string | null): string | null {
  switch (euPackage) {
    case 'Compliance':
      return 'EU_COMPLIANCE';
    case 'Comfort':
      return 'EU_COMFORT';
    case 'Complete':
      return 'EU_COMPLETE';
    default:
      return null;
  }
}

function getServiceBucketCode(serviceTier: string | null): string | null {
  switch (serviceTier) {
    case 'Essential':
      return 'SERVICE_ESSENTIAL';
    case 'Access':
      return 'SERVICE_ACCESS';
    case 'Premier':
      return 'SERVICE_PREMIER';
    default:
      return null;
  }
}

function getAddOnCatalogCodes(addOns: EUPackageAddOnKey[]): string[] {
  const codes: string[] = [];
  for (const key of addOns) {
    switch (key) {
      case 'antiFog':
        codes.push('ADD_ON_ANTI_FOG');
        break;
      case 'antiReflectiveStd':
        codes.push('ADD_ON_ANTI_REFLECTIVE_STANDARD');
        break;
      case 'antiReflectiveAntiFogCombo':
        codes.push('ADD_ON_ANTI_REFLECTIVE_ANTI_FOG_COMBO');
        break;
      case 'blueLightAntiReflective':
        codes.push('ADD_ON_BLUE_LIGHT_ANTI_REFLECTIVE');
        break;
      case 'blueLightFilter':
        codes.push('ADD_ON_BLUE_LIGHT_FILTER');
        break;
      case 'transitions':
        codes.push('ADD_ON_TRANSITIONS');
        break;
      case 'extraScratchCoating':
        codes.push('ADD_ON_EXTRA_SCRATCH_COATING');
        break;
      default:
        break;
    }
  }

  return codes;
}

async function loadBucketLookup(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('program_buckets').select('id, code');
  if (error) throw new Error(error.message);
  return new Map(((data || []) as ProgramBucketRow[]).map((row) => [row.code, row.id]));
}

async function loadCatalogLookup(supabase: SupabaseClient): Promise<Map<string, CatalogItemRow>> {
  const { data, error } = await supabase.from('catalog_items').select('id, code, display_order');
  if (error) throw new Error(error.message);
  return new Map(((data || []) as CatalogItemRow[]).map((row) => [row.code, row]));
}

async function loadFieldDefinitions(
  supabase: SupabaseClient
): Promise<Map<EligibilityFieldKey, EligibilityFieldDefinitionRow>> {
  const { data, error } = await supabase
    .from('eligibility_field_definitions')
    .select('id, key, label, required_default, field_type, description, example, display_order')
    .order('display_order');

  if (error) throw new Error(error.message);

  return new Map(
    ((data || []) as EligibilityFieldDefinitionRow[]).map((row) => [row.key, row])
  );
}

export async function syncCanonicalProgramFoundation(params: {
  supabase: SupabaseClient;
  programId: string;
  companyName: string;
  companyCode: string | null;
  euPackage: string | null;
  euPackageAddOns: EUPackageAddOnKey[];
  serviceTier: string | null;
  isActive: boolean;
  eligibilityFields?: CompanyEligibilityFieldSelection[] | null;
}): Promise<void> {
  const {
    supabase,
    programId,
    companyName,
    companyCode,
    euPackage,
    euPackageAddOns,
    serviceTier,
    isActive,
    eligibilityFields,
  } = params;

  const [bucketLookup, catalogLookup, fieldDefinitions] = await Promise.all([
    loadBucketLookup(supabase),
    loadCatalogLookup(supabase),
    loadFieldDefinitions(supabase),
  ]);

  const companyProgramCode = buildCompanyProgramCode(programId, companyCode);
  const { data: companyProgram, error: companyProgramError } = await supabase
    .from('company_programs')
    .upsert(
      {
        program_id: programId,
        company_code: companyCode,
        code: companyProgramCode,
        name: companyName,
        eu_package_bucket_id: getEuBucketCode(euPackage)
          ? bucketLookup.get(getEuBucketCode(euPackage) as string) || null
          : null,
        service_tier_bucket_id: getServiceBucketCode(serviceTier)
          ? bucketLookup.get(getServiceBucketCode(serviceTier) as string) || null
          : null,
        status: isActive ? 'active' : 'inactive',
      },
      { onConflict: 'program_id' }
    )
    .select('id')
    .single();

  if (companyProgramError || !companyProgram) {
    throw new Error(companyProgramError?.message || 'Failed to sync company program');
  }

  const selectedCatalogItems = getAddOnCatalogCodes(euPackageAddOns)
    .map((code) => catalogLookup.get(code))
    .filter((item): item is CatalogItemRow => Boolean(item));

  const { error: assignmentDeleteError } = await supabase
    .from('company_program_item_assignments')
    .delete()
    .eq('company_program_id', companyProgram.id);

  if (assignmentDeleteError) throw new Error(assignmentDeleteError.message);

  if (selectedCatalogItems.length > 0) {
    const { error: assignmentInsertError } = await supabase
      .from('company_program_item_assignments')
      .insert(
        selectedCatalogItems.map((item) => ({
          company_program_id: companyProgram.id,
          catalog_item_id: item.id,
          display_order: item.display_order,
        }))
      );

    if (assignmentInsertError) throw new Error(assignmentInsertError.message);
  }

  const { data: defaultTemplate, error: templateError } = await supabase
    .from('eligibility_import_templates')
    .select('id')
    .eq('code', 'DEFAULT_EMPLOYER_ELIGIBILITY')
    .single();

  if (templateError || !defaultTemplate) {
    throw new Error(templateError?.message || 'Default eligibility template not found');
  }

  const { data: eligibilityConfiguration, error: eligibilityConfigurationError } = await supabase
    .from('company_eligibility_configurations')
    .upsert(
      {
        program_id: programId,
        template_id: defaultTemplate.id,
        allow_additional_fields: false,
      },
      { onConflict: 'program_id' }
    )
    .select('id')
    .single();

  if (eligibilityConfigurationError || !eligibilityConfiguration) {
    throw new Error(
      eligibilityConfigurationError?.message || 'Failed to sync eligibility configuration'
    );
  }

  const selectedFields =
    eligibilityFields && eligibilityFields.length > 0
      ? eligibilityFields
      : DEFAULT_ELIGIBILITY_FIELD_DEFINITIONS.map((field) => ({
          key: field.key,
          required: field.required,
          active: true,
        }));

  const { error: fieldDeleteError } = await supabase
    .from('company_eligibility_fields')
    .delete()
    .eq('configuration_id', eligibilityConfiguration.id);

  if (fieldDeleteError) throw new Error(fieldDeleteError.message);

  const rows = selectedFields
    .map((field) => {
      const definition = fieldDefinitions.get(field.key);
      if (!definition || !field.active) return null;
      return {
        configuration_id: eligibilityConfiguration.id,
        field_definition_id: definition.id,
        is_required: field.key === 'firstName' || field.key === 'lastName' ? true : field.required,
        is_active: true,
        display_order: definition.display_order,
      };
    })
    .filter((row) => row !== null);

  if (rows.length > 0) {
    const { error: fieldInsertError } = await supabase.from('company_eligibility_fields').insert(rows);
    if (fieldInsertError) throw new Error(fieldInsertError.message);
  }
}

export async function getProgramEligibilityFieldConfiguration(
  supabase: SupabaseClient,
  programId: string
): Promise<EligibilityFieldConfigRow[]> {
  const { data: configuration, error: configurationError } = await supabase
    .from('company_eligibility_configurations')
    .select('id')
    .eq('program_id', programId)
    .maybeSingle();

  if (configurationError) throw new Error(configurationError.message);

  if (!configuration?.id) {
    return DEFAULT_ELIGIBILITY_FIELD_DEFINITIONS.map((field) => ({
      key: field.key,
      label: field.label,
      required: field.required,
      active: true,
      fieldType: field.fieldType,
      description: field.description,
      example: field.example,
      displayOrder: DEFAULT_ELIGIBILITY_FIELD_DEFINITIONS.findIndex((entry) => entry.key === field.key) + 1,
    }));
  }

  const { data, error } = await supabase
    .from('company_eligibility_fields')
    .select(
      'is_required, is_active, display_order, field_definition:eligibility_field_definitions(key, label, field_type, description, example)'
    )
    .eq('configuration_id', configuration.id)
    .order('display_order');

  if (error) throw new Error(error.message);

  const rows = ((data || []) as unknown as Array<{
    is_required: boolean;
    is_active: boolean;
    display_order: number;
    field_definition:
      | {
          key: EligibilityFieldKey;
          label: string;
          field_type: EligibilityFieldDefinition['fieldType'];
          description: string | null;
          example: string | null;
        }
      | Array<{
          key: EligibilityFieldKey;
          label: string;
          field_type: EligibilityFieldDefinition['fieldType'];
          description: string | null;
          example: string | null;
        }>
      | null;
  }>).flatMap((row) => {
    const definition = Array.isArray(row.field_definition)
      ? row.field_definition[0] || null
      : row.field_definition;

    if (!definition) return [];
    return [
      {
        key: definition.key,
        label: definition.label,
        required: row.is_required,
        active: row.is_active,
        fieldType: definition.field_type,
        description: definition.description || undefined,
        example: definition.example || undefined,
        displayOrder: row.display_order,
      },
    ];
  });

  if (rows.length > 0) return rows;

  return DEFAULT_ELIGIBILITY_FIELD_DEFINITIONS.map((field) => ({
    key: field.key,
    label: field.label,
    required: field.required,
    active: true,
    fieldType: field.fieldType,
    description: field.description,
    example: field.example,
    displayOrder: DEFAULT_ELIGIBILITY_FIELD_DEFINITIONS.findIndex((entry) => entry.key === field.key) + 1,
  }));
}

export async function getProgramEligibilityIdentityRequirements(
  supabase: SupabaseClient,
  programId: string
): Promise<{
  requiresFirstName: boolean;
  requiresLastName: boolean;
  acceptsEmployeeId: boolean;
  acceptsEmail: boolean;
  activeFieldKeys: EligibilityFieldKey[];
}> {
  const fields = await getProgramEligibilityFieldConfiguration(supabase, programId);
  const activeFields = fields.filter((field) => field.active);
  const activeKeys = activeFields.map((field) => field.key);
  return {
    requiresFirstName: activeKeys.includes('firstName'),
    requiresLastName: activeKeys.includes('lastName'),
    acceptsEmployeeId: activeKeys.includes('employeeId'),
    acceptsEmail: activeKeys.includes('email'),
    activeFieldKeys: activeKeys,
  };
}

export async function getProgramCanonicalContext(
  supabase: SupabaseClient,
  programId: string
): Promise<{
  companyProgram: {
    id: string;
    code: string;
    name: string;
    euPackageBucketCode: string | null;
    serviceTierBucketCode: string | null;
    additionalCatalogItemCodes: string[];
  } | null;
  eligibilityFields: EligibilityFieldConfigRow[];
}> {
  const [companyProgramRes, eligibilityFields] = await Promise.all([
    supabase
      .from('company_programs')
      .select(
        'id, code, name, eu_bucket:program_buckets!company_programs_eu_package_bucket_id_fkey(code), service_bucket:program_buckets!company_programs_service_tier_bucket_id_fkey(code), item_assignments:company_program_item_assignments(catalog_item:catalog_items(code))'
      )
      .eq('program_id', programId)
      .maybeSingle(),
    getProgramEligibilityFieldConfiguration(supabase, programId),
  ]);

  if (companyProgramRes.error) throw new Error(companyProgramRes.error.message);

  const companyProgram = companyProgramRes.data
    ? {
        id: companyProgramRes.data.id as string,
        code: companyProgramRes.data.code as string,
        name: companyProgramRes.data.name as string,
        euPackageBucketCode:
          (companyProgramRes.data.eu_bucket as { code?: string } | null)?.code || null,
        serviceTierBucketCode:
          (companyProgramRes.data.service_bucket as { code?: string } | null)?.code || null,
        additionalCatalogItemCodes: (
          (companyProgramRes.data.item_assignments as Array<{
            catalog_item?: { code?: string } | null;
          }> | null) || []
        )
          .map((row) => row.catalog_item?.code || null)
          .filter((code): code is string => Boolean(code)),
      }
    : null;

  return { companyProgram, eligibilityFields };
}

export function getEnrollmentEligibilityStatus(
  enrollment: { status: string; metadata?: Record<string, unknown> | null },
  asOfStatus: 'active' | 'inactive'
): 'eligible' | 'inactive' | 'pending' | 'unknown' {
  if (asOfStatus !== 'active' || enrollment.status !== 'active') return 'inactive';

  const metadata = enrollment.metadata || {};
  const raw =
    typeof metadata.eligibility_status === 'string'
      ? metadata.eligibility_status
      : typeof metadata.eligibilityStatus === 'string'
        ? metadata.eligibilityStatus
        : null;

  switch (raw?.toLowerCase()) {
    case 'eligible':
      return 'eligible';
    case 'inactive':
    case 'ineligible':
    case 'not_eligible':
      return 'inactive';
    case 'pending':
      return 'pending';
    case 'unknown':
      return 'unknown';
    default:
      return 'eligible';
  }
}
