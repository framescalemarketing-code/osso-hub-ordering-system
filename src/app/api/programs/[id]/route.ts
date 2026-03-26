import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEmployee } from '@/lib/auth';
import {
  normalizeProgramMutationInput,
  syncCanonicalProgramFoundation,
  type ProgramMutationInput,
} from '@/lib/programs/service';
import type { EUPackageAddOnKey } from '@/lib/pricing';
import { createServiceClient } from '@/lib/supabase/server';

function canManageCompanies(role?: string | null): boolean {
  return ['admin', 'manager', 'sales', 'optician'].includes(role || '');
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageCompanies(employee.role)) {
    return NextResponse.json({ error: 'Only company staff roles can update companies' }, { status: 403 });
  }

  const { id } = await context.params;
  let body: ProgramMutationInput;
  try {
    body = (await request.json()) as ProgramMutationInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const normalized = normalizeProgramMutationInput(body);
  const patch = normalized.programPatch;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from('programs')
    .update(patch)
    .eq('id', id)
    .select('id, company_name, company_code, eu_package, eu_package_add_ons, service_tier, is_active')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  try {
    await syncCanonicalProgramFoundation({
      supabase: serviceClient,
      programId: data.id,
      companyName: data.company_name,
      companyCode: data.company_code || null,
      euPackage: data.eu_package || null,
      euPackageAddOns: (data.eu_package_add_ons || []) as EUPackageAddOnKey[],
      serviceTier: data.service_tier || null,
      isActive: Boolean(data.is_active),
      eligibilityFields: normalized.eligibilityFields,
    });
  } catch (syncError: unknown) {
    const message =
      syncError instanceof Error ? syncError.message : 'Failed to sync canonical company program';
    return NextResponse.json({ error: message, company: data }, { status: 500 });
  }

  return NextResponse.json({ company: data });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageCompanies(employee.role)) {
    return NextResponse.json({ error: 'Only company staff roles can archive companies' }, { status: 403 });
  }

  const { id } = await context.params;
  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from('programs')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: program, error: programError } = await serviceClient
    .from('programs')
    .select('id, company_name, company_code, eu_package, eu_package_add_ons, service_tier, is_active')
    .eq('id', id)
    .single();

  if (programError || !program) {
    return NextResponse.json({ error: programError?.message || 'Failed to reload archived company' }, { status: 400 });
  }

  try {
    await syncCanonicalProgramFoundation({
      supabase: serviceClient,
      programId: program.id,
      companyName: program.company_name,
      companyCode: program.company_code || null,
      euPackage: program.eu_package || null,
      euPackageAddOns: (program.eu_package_add_ons || []) as EUPackageAddOnKey[],
      serviceTier: program.service_tier || null,
      isActive: Boolean(program.is_active),
    });
  } catch (syncError: unknown) {
    const message =
      syncError instanceof Error ? syncError.message : 'Failed to sync archived company state';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
