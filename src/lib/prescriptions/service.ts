import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveEnrollmentForOrderIntake } from '@/lib/enrollments/service';
import type {
  CreatePrescriptionInput,
  EnrollmentResolution,
  Prescription,
} from '@/lib/types';

function toNumber(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const parsed = Number.parseInt(String(v), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function toDateOrNull(v: unknown): string | null {
  const s = toStringOrNull(v);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`Invalid date format: ${s}`);
  return s;
}

export async function createPrescriptionForOrderIntake(params: {
  supabase: SupabaseClient;
  actorEmployeeId: string;
  input: CreatePrescriptionInput;
}): Promise<{ prescription: Prescription; enrollment_resolution: EnrollmentResolution }> {
  const { supabase, actorEmployeeId, input } = params;

  const customerId = toStringOrNull(input.customer_id);
  if (!customerId) throw new Error('customer_id is required');

  const orderType = input.order_type;
  const programId = toStringOrNull(input.program_id);
  if (orderType === 'program' && !programId) {
    throw new Error('program_id is required for program prescription linkage');
  }

  let customerEmail: string | null = null;
  if (!input.employee_email) {
    const { data: customer } = await supabase
      .from('customers')
      .select('email')
      .eq('id', customerId)
      .maybeSingle();
    customerEmail = customer?.email ?? null;
  }

  const resolutionContext =
    orderType === 'program'
      ? await resolveEnrollmentForOrderIntake({
          supabase,
          customerId,
          programId,
          employeeEmail: input.employee_email ?? customerEmail,
          employeeExternalId: input.employee_external_id ?? null,
        })
      : {
          enrollment_resolution: {
            status: 'not_found',
            reason: 'no_match',
            enrollment: null,
            program: null,
            as_of: new Date().toISOString().slice(0, 10),
          } as EnrollmentResolution,
          program_id: null,
        };

  const enrollmentResolution: EnrollmentResolution =
    orderType === 'program'
      ? resolutionContext.enrollment_resolution
      : {
          status: 'not_found',
          reason: 'no_match',
          enrollment: null,
          program: null,
          as_of: new Date().toISOString().slice(0, 10),
        };

  const normalizedStatus =
    orderType === 'program'
      ? enrollmentResolution.status
      : ('not_applicable' as const);

  const normalizedReason =
    orderType === 'program'
      ? enrollmentResolution.reason
      : 'regular_order_no_program_linkage';

  const { data, error } = await supabase
    .from('prescriptions')
    .insert({
      customer_id: customerId,
      od_sphere: toNumber(input.od_sphere),
      od_cylinder: toNumber(input.od_cylinder),
      od_axis: toInteger(input.od_axis),
      od_add: toNumber(input.od_add),
      od_prism: toNumber(input.od_prism),
      od_prism_base: toStringOrNull(input.od_prism_base),
      os_sphere: toNumber(input.os_sphere),
      os_cylinder: toNumber(input.os_cylinder),
      os_axis: toInteger(input.os_axis),
      os_add: toNumber(input.os_add),
      os_prism: toNumber(input.os_prism),
      os_prism_base: toStringOrNull(input.os_prism_base),
      pd_distance: toNumber(input.pd_distance),
      pd_near: toNumber(input.pd_near),
      pd_right: toNumber(input.pd_right),
      pd_left: toNumber(input.pd_left),
      prescriber_name: toStringOrNull(input.prescriber_name),
      prescriber_npi: toStringOrNull(input.prescriber_npi),
      rx_date: toDateOrNull(input.rx_date),
      expiration_date: toDateOrNull(input.expiration_date),
      pdf_storage_path: toStringOrNull(input.pdf_storage_path),
      notes: toStringOrNull(input.notes),
      is_current: true,
      uploaded_by: actorEmployeeId,
      program_id: programId,
      program_enrollment_id: enrollmentResolution.enrollment?.id ?? null,
      enrollment_resolution_status: normalizedStatus,
      enrollment_resolution_reason: normalizedReason,
      upload_source: 'order_intake',
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to persist prescription');
  }

  await supabase
    .from('prescriptions')
    .update({ is_current: false })
    .eq('customer_id', customerId)
    .neq('id', data.id);

  return {
    prescription: data as Prescription,
    enrollment_resolution: {
      ...enrollmentResolution,
      status: normalizedStatus as EnrollmentResolution['status'],
      reason: normalizedReason as EnrollmentResolution['reason'],
    },
  };
}
