import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEmployee } from '@/lib/auth';
import {
  normalizeProgramMutationInput,
  syncCanonicalProgramFoundation,
  type ProgramMutationInput,
} from '@/lib/programs/service';
import { createServiceClient } from '@/lib/supabase/server';

function canManageCompanies(role?: string | null): boolean {
  return ['admin', 'manager', 'sales', 'optician'].includes(role || '');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageCompanies(employee.role)) {
    return NextResponse.json({ error: 'Only staff managers can create companies' }, { status: 403 });
  }

  let body: ProgramMutationInput;
  try {
    body = (await request.json()) as ProgramMutationInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const normalized = normalizeProgramMutationInput(body);
  const companyName = normalized.companyName;
  if (!companyName) {
    return NextResponse.json({ error: 'company_name is required' }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from('programs')
    .insert(normalized.programPatch)
    .select('id, is_active')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  try {
    await syncCanonicalProgramFoundation({
      supabase: serviceClient,
      programId: data.id,
      companyName,
      companyCode: normalized.companyCode,
      euPackage: normalized.euPackage,
      euPackageAddOns: normalized.euPackageAddOns,
      serviceTier: normalized.serviceTier,
      isActive: Boolean(data.is_active),
      eligibilityFields: normalized.eligibilityFields,
    });
  } catch (syncError: unknown) {
    const message =
      syncError instanceof Error ? syncError.message : 'Failed to sync canonical company program';
    return NextResponse.json({ error: message, company: { id: data.id } }, { status: 500 });
  }

  return NextResponse.json({ company: data }, { status: 201 });
}
