import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEmployee } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { createPrescriptionForOrderIntake } from '@/lib/prescriptions/service';
import type { CreatePrescriptionInput } from '@/lib/types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: CreatePrescriptionInput;
  try {
    body = (await request.json()) as CreatePrescriptionInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.customer_id) {
    return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });
  }

  if (!body.order_type || !['regular', 'program'].includes(body.order_type)) {
    return NextResponse.json({ error: 'order_type must be regular or program' }, { status: 400 });
  }

  if (!body.expiration_date) {
    return NextResponse.json({ error: 'expiration_date is required' }, { status: 400 });
  }

  if (body.order_type === 'program' && !body.program_id) {
    return NextResponse.json(
      { error: 'program_id is required when order_type is program' },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  try {
    const result = await createPrescriptionForOrderIntake({
      supabase: serviceClient,
      actorEmployeeId: employee.id,
      input: body,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create prescription';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
