import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEmployee } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { safeParsePriceAdjustments, type EUPackage, type EUPackageAddOnKey, type ServiceTier } from '@/lib/pricing';

type ProgramPatchPayload = {
  company_name?: string;
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
  eu_package?: EUPackage | null;
  eu_package_add_ons?: EUPackageAddOnKey[];
  eu_package_custom_adjustments?: unknown;
  service_tier?: ServiceTier | null;
  service_tier_custom_adjustments?: unknown;
};

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function isCompanyManager(role?: string | null): boolean {
  return ['admin', 'manager'].includes(role || '');
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isCompanyManager(employee.role)) {
    return NextResponse.json({ error: 'Only admin and manager roles can update companies' }, { status: 403 });
  }

  const { id } = await context.params;
  let body: ProgramPatchPayload;
  try {
    body = (await request.json()) as ProgramPatchPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.company_name === 'string') patch.company_name = body.company_name.trim();
  if ('contact_name' in body) patch.contact_name = normalizeText(body.contact_name);
  if ('contact_email' in body) patch.contact_email = normalizeText(body.contact_email);
  if ('contact_phone' in body) patch.contact_phone = normalizeText(body.contact_phone);
  if ('invoice_terms' in body) patch.invoice_terms = normalizeText(body.invoice_terms);
  if (typeof body.approval_required === 'boolean') patch.approval_required = body.approval_required;
  if (Array.isArray(body.approver_emails)) {
    patch.approver_emails = body.approver_emails.map((email) => email.trim()).filter(Boolean);
  }
  if ('program_type' in body) patch.program_type = normalizeText(body.program_type);
  if ('employee_count' in body) patch.employee_count = Number(body.employee_count) || 0;
  if ('restricted_guidelines' in body) patch.restricted_guidelines = normalizeText(body.restricted_guidelines);
  if ('loyalty_credit_count' in body) patch.loyalty_credit_count = Number(body.loyalty_credit_count) || 0;
  if ('referral_credit_count' in body) patch.referral_credit_count = Number(body.referral_credit_count) || 0;
  if ('eu_package' in body) patch.eu_package = body.eu_package || null;
  if (Array.isArray(body.eu_package_add_ons)) patch.eu_package_add_ons = body.eu_package_add_ons;
  if ('eu_package_custom_adjustments' in body) {
    patch.eu_package_custom_adjustments = safeParsePriceAdjustments(body.eu_package_custom_adjustments);
  }
  if ('service_tier' in body) patch.service_tier = body.service_tier || null;
  if ('service_tier_custom_adjustments' in body) {
    patch.service_tier_custom_adjustments = safeParsePriceAdjustments(body.service_tier_custom_adjustments);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from('programs')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ company: data });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isCompanyManager(employee.role)) {
    return NextResponse.json({ error: 'Only admin and manager roles can archive companies' }, { status: 403 });
  }

  const { id } = await context.params;
  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from('programs')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
