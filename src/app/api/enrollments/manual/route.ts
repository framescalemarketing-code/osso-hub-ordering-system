import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEmployee } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { createManualProgramEnrollment } from '@/lib/enrollments/service';
import type { CreateManualProgramEnrollmentInput } from '@/lib/types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!['admin', 'manager'].includes(employee.role)) {
    return NextResponse.json({ error: 'admin or manager role required' }, { status: 403 });
  }

  let body: CreateManualProgramEnrollmentInput;
  try {
    body = (await request.json()) as CreateManualProgramEnrollmentInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.program_id) {
    return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
  }

  if (!body.employee_first_name?.trim()) {
    return NextResponse.json({ error: 'employee_first_name is required' }, { status: 400 });
  }

  if (!body.employee_last_name?.trim()) {
    return NextResponse.json({ error: 'employee_last_name is required' }, { status: 400 });
  }

  const hasEmail = Boolean(body.employee_email?.trim());
  const hasExternalId = Boolean(body.employee_external_id?.trim());
  if (!hasEmail && !hasExternalId) {
    return NextResponse.json(
      { error: 'employee_email or employee_external_id is required' },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  try {
    const enrollment = await createManualProgramEnrollment({
      supabase: serviceClient,
      actorEmployeeId: employee.id,
      input: body,
    });

    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create manual enrollment';

    // Partial unique indexes in migration 006 enforce single active identity per program.
    if (message.includes('duplicate key value') || message.includes('unique')) {
      return NextResponse.json(
        { error: 'Active enrollment already exists for this employee identity in this program' },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
