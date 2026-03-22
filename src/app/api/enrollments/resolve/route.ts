import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEmployee } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveEnrollmentForOrderIntake } from '@/lib/enrollments/service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const customerId = url.searchParams.get('customer_id');
  const programId = url.searchParams.get('program_id');
  const employeeEmail = url.searchParams.get('employee_email');
  const employeeExternalId = url.searchParams.get('employee_external_id');
  const asOfDate = url.searchParams.get('as_of');

  if (!customerId && !employeeEmail && !employeeExternalId) {
    return NextResponse.json(
      { error: 'Provide at least one of customer_id, employee_email, or employee_external_id' },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();
  const context = await resolveEnrollmentForOrderIntake({
    supabase: serviceClient,
    customerId,
    programId,
    employeeEmail,
    employeeExternalId,
    asOfDate: asOfDate || undefined,
  });

  return NextResponse.json(context, { status: 200 });
}
