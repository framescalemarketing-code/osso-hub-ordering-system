import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEmployee } from '@/lib/auth';
import {
  getEnrollmentEligibilityStatus,
  getProgramEligibilityIdentityRequirements,
} from '@/lib/programs/service';
import { createServiceClient } from '@/lib/supabase/server';

type EnrollmentCheckRow = {
  id: string;
  employee_first_name: string;
  employee_last_name: string;
  employee_external_id: string | null;
  employee_email: string | null;
  effective_from: string;
  effective_to: string | null;
  status: 'active' | 'terminated' | 'suspended';
  coverage_tier: string | null;
  metadata: Record<string, unknown> | null;
};

function normalize(value: string | null): string {
  return (value || '').trim().toLowerCase();
}

function isEffectiveNow(effectiveFrom: string, effectiveTo: string | null): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (effectiveFrom > today) return false;
  if (effectiveTo && effectiveTo < today) return false;
  return true;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const programId = url.searchParams.get('program_id');
  const firstName = url.searchParams.get('first_name');
  const lastName = url.searchParams.get('last_name');
  const employeeExternalId = url.searchParams.get('employee_external_id');
  const employeeEmail = url.searchParams.get('employee_email');

  if (!programId) return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
  const serviceClient = createServiceClient();
  const identityRequirements = await getProgramEligibilityIdentityRequirements(serviceClient, programId);

  if ((identityRequirements.requiresFirstName && !firstName) || (identityRequirements.requiresLastName && !lastName)) {
    return NextResponse.json({ error: 'first_name and last_name are required' }, { status: 400 });
  }
  if (
    (!identityRequirements.acceptsEmployeeId || !employeeExternalId) &&
    (!identityRequirements.acceptsEmail || !employeeEmail)
  ) {
    return NextResponse.json(
      { error: 'Provide at least one active identity field for this company.' },
      { status: 400 }
    );
  }

  const { data, error } = await serviceClient
    .from('program_enrollments')
    .select('id, employee_first_name, employee_last_name, employee_external_id, employee_email, effective_from, effective_to, status, coverage_tier, metadata')
    .eq('program_id', programId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const rows = (data || []) as EnrollmentCheckRow[];

  const normalizedFirst = normalize(firstName);
  const normalizedLast = normalize(lastName);
  const normalizedExternal = normalize(employeeExternalId);
  const normalizedEmail = normalize(employeeEmail);

  const match = rows.find((row) => {
    const nameMatch =
      normalize(row.employee_first_name) === normalizedFirst &&
      normalize(row.employee_last_name) === normalizedLast;
    if (!nameMatch) return false;

    const idMatch =
      identityRequirements.acceptsEmployeeId &&
      normalizedExternal &&
      normalize(row.employee_external_id) === normalizedExternal;
    const emailMatch =
      identityRequirements.acceptsEmail &&
      normalizedEmail &&
      normalize(row.employee_email) === normalizedEmail;
    if (!idMatch && !emailMatch) return false;

    return isEffectiveNow(row.effective_from, row.effective_to);
  });

  if (!match) {
    return NextResponse.json(
      {
        eligible: false,
        reason: 'No active enrollment matched this name + identifier combination.',
      },
      { status: 200 }
    );
  }

  const eligibilityStatus = getEnrollmentEligibilityStatus(
    match,
    isEffectiveNow(match.effective_from, match.effective_to) ? 'active' : 'inactive'
  );
  if (eligibilityStatus !== 'eligible') {
    return NextResponse.json(
      {
        eligible: false,
        reason:
          eligibilityStatus === 'pending'
            ? 'Matched roster row is pending review.'
            : 'Matched roster row is not currently eligible.',
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      eligible: true,
      reason: `Matched active enrollment (${match.coverage_tier || 'standard coverage'}).`,
      enrollment: match,
    },
    { status: 200 }
  );
}
