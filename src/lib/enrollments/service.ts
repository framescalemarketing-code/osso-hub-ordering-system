import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getEnrollmentEligibilityStatus,
  getProgramEligibilityIdentityRequirements,
} from '@/lib/programs/service';
import type {
  CreateManualProgramEnrollmentInput,
  OrderIntakePreloadContext,
  ProgramEnrollment,
  ProgramSummary,
} from '@/lib/types';

function toISODateOnly(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  return d.toISOString().slice(0, 10);
}

function isEnrollmentActive(
  enrollment: Pick<ProgramEnrollment, 'status' | 'effective_from' | 'effective_to'>,
  asOf: string
): boolean {
  if (enrollment.status !== 'active') return false;
  if (enrollment.effective_from > asOf) return false;
  if (enrollment.effective_to && enrollment.effective_to < asOf) return false;
  return true;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeOptionalEmail(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.toLowerCase() : null;
}

async function getProgramSummaryById(
  supabase: SupabaseClient,
  programId: string
): Promise<ProgramSummary | null> {
  const { data } = await supabase
    .from('programs')
    .select('id, company_name, approval_required, invoice_terms, is_active')
    .eq('id', programId)
    .maybeSingle();

  return (data as ProgramSummary | null) ?? null;
}

async function findMostRecentEnrollment(
  supabase: SupabaseClient,
  params: {
    programId: string | null;
    customerId?: string | null;
    employeeEmail?: string | null;
    employeeExternalId?: string | null;
    acceptsEmail?: boolean;
    acceptsEmployeeId?: boolean;
  }
): Promise<ProgramEnrollment | null> {
  const {
    programId,
    customerId,
    employeeEmail,
    employeeExternalId,
    acceptsEmail = true,
    acceptsEmployeeId = true,
  } = params;

  // Lookup priority is deterministic: customer_id, then email, then external ID.
  // customer_id is considered the strongest identity anchor.
  if (customerId) {
    let query = supabase
      .from('program_enrollments')
      .select('*')
      .eq('customer_id', customerId)
      .order('effective_from', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);
    if (programId) query = query.eq('program_id', programId);

    const { data } = await query.maybeSingle();
    if (data) return data as ProgramEnrollment;
  }

  if (employeeEmail && acceptsEmail) {
    let query = supabase
      .from('program_enrollments')
      .select('*')
      .eq('employee_email', employeeEmail)
      .order('effective_from', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);
    if (programId) query = query.eq('program_id', programId);

    const { data } = await query.maybeSingle();
    if (data) return data as ProgramEnrollment;
  }

  if (employeeExternalId && acceptsEmployeeId) {
    let query = supabase
      .from('program_enrollments')
      .select('*')
      .eq('employee_external_id', employeeExternalId)
      .order('effective_from', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);
    if (programId) query = query.eq('program_id', programId);

    const { data } = await query.maybeSingle();
    if (data) return data as ProgramEnrollment;
  }

  return null;
}

export async function createManualProgramEnrollment(params: {
  supabase: SupabaseClient;
  actorEmployeeId: string;
  input: CreateManualProgramEnrollmentInput;
}): Promise<ProgramEnrollment> {
  const { supabase, actorEmployeeId, input } = params;

  const normalizedEmail = normalizeOptionalEmail(input.employee_email);
  const normalizedExternalId = normalizeOptionalString(input.employee_external_id);

  if (!normalizedEmail && !normalizedExternalId) {
    throw new Error('employee_email or employee_external_id is required');
  }

  const effectiveFrom = input.effective_from
    ? toISODateOnly(input.effective_from)
    : toISODateOnly(new Date());

  const { data, error } = await supabase
    .from('program_enrollments')
    .insert({
      program_id: input.program_id,
      enrollment_source: 'manual',
      enrollment_import_id: null,
      customer_id: input.customer_id || null,
      employee_first_name: input.employee_first_name.trim(),
      employee_last_name: input.employee_last_name.trim(),
      employee_email: normalizedEmail,
      employee_external_id: normalizedExternalId,
      cost_center_code: normalizeOptionalString(input.cost_center_code),
      coverage_tier: normalizeOptionalString(input.coverage_tier),
      status: 'active',
      effective_from: effectiveFrom,
      notes: normalizeOptionalString(input.notes),
      metadata: input.metadata || {},
      enrolled_by: actorEmployeeId,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create manual enrollment');
  }

  if (input.customer_id && input.link_customer_program !== false) {
    const { error: customerUpdateError } = await supabase
      .from('customers')
      .update({ program_id: input.program_id })
      .eq('id', input.customer_id);

    if (customerUpdateError) {
      throw new Error(`Enrollment created but customer link failed: ${customerUpdateError.message}`);
    }
  }

  return data as ProgramEnrollment;
}

export async function resolveEnrollmentForOrderIntake(params: {
  supabase: SupabaseClient;
  customerId?: string | null;
  programId?: string | null;
  employeeEmail?: string | null;
  employeeExternalId?: string | null;
  asOfDate?: string;
}): Promise<OrderIntakePreloadContext> {
  const {
    supabase,
    customerId = null,
    programId = null,
    employeeEmail = null,
    employeeExternalId = null,
    asOfDate,
  } = params;

  const normalizedEmail = normalizeOptionalEmail(employeeEmail);
  const normalizedExternalId = normalizeOptionalString(employeeExternalId);
  const asOf = asOfDate ? toISODateOnly(asOfDate) : toISODateOnly(new Date());

  let resolvedProgramId: string | null = programId;

  if (customerId && !resolvedProgramId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('program_id')
      .eq('id', customerId)
      .maybeSingle();
    resolvedProgramId = customer?.program_id ?? null;
  }

  const identityRequirements = resolvedProgramId
    ? await getProgramEligibilityIdentityRequirements(supabase, resolvedProgramId)
    : null;

  const enrollment = await findMostRecentEnrollment(supabase, {
    programId: resolvedProgramId,
    customerId,
    employeeEmail: normalizedEmail,
    employeeExternalId: normalizedExternalId,
    acceptsEmail: identityRequirements?.acceptsEmail ?? true,
    acceptsEmployeeId: identityRequirements?.acceptsEmployeeId ?? true,
  });

  if (enrollment) {
    const program = await getProgramSummaryById(supabase, enrollment.program_id);
    const activeByDate = isEnrollmentActive(enrollment, asOf);
    const eligibilityStatus = getEnrollmentEligibilityStatus(
      enrollment,
      activeByDate ? 'active' : 'inactive'
    );
    const active = eligibilityStatus === 'eligible';

    return {
      customer_id: customerId,
      program_id: enrollment.program_id,
      program,
      enrollment_resolution: {
        status: active ? 'active' : 'inactive',
        reason: active ? 'matched_active' : 'matched_inactive',
        enrollment,
        program,
        as_of: asOf,
      },
      order_mode_hint: active ? 'program' : 'regular',
    };
  }

  const fallbackProgram = resolvedProgramId
    ? await getProgramSummaryById(supabase, resolvedProgramId)
    : null;

  return {
    customer_id: customerId,
    program_id: fallbackProgram?.id || resolvedProgramId || null,
    program: fallbackProgram,
    enrollment_resolution: {
      status: 'not_found',
      reason: 'no_match',
      enrollment: null,
      program: fallbackProgram,
      as_of: asOf,
    },
    order_mode_hint: fallbackProgram ? 'program' : 'regular',
  };
}
