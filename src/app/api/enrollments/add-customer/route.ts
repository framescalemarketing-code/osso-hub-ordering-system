import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEmployee } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

function canManage(role?: string | null): boolean {
  return ['admin', 'manager', 'sales', 'optician'].includes(role || '');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManage(employee.role)) {
    return NextResponse.json({ error: 'Not allowed to add enrollment customers' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    program_id?: string;
    enrollment_id?: string | null;
    first_name?: string;
    last_name?: string;
    employee_email?: string | null;
    employee_external_id?: string | null;
  } | null;

  if (!body?.program_id) return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
  if (!body?.first_name?.trim() || !body?.last_name?.trim()) {
    return NextResponse.json({ error: 'first_name and last_name are required' }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const { data: program, error: programError } = await serviceClient
    .from('programs')
    .select('id, company_name, restricted_guidelines')
    .eq('id', body.program_id)
    .single();

  if (programError || !program) {
    return NextResponse.json({ error: programError?.message || 'Program not found' }, { status: 404 });
  }

  const normalizedEmail = body.employee_email?.trim().toLowerCase() || null;

  let existingCustomerId: string | null = null;
  if (normalizedEmail) {
    const { data: existingByEmail } = await serviceClient
      .from('customers')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('is_active', true)
      .maybeSingle();

    existingCustomerId = existingByEmail?.id || null;
  }

  const notes = [
    body.employee_external_id ? `Employee ID: ${body.employee_external_id.trim()}` : null,
    program.restricted_guidelines ? `Program guidelines snapshot: ${program.restricted_guidelines}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  let customer = null;
  if (existingCustomerId) {
    const { data, error } = await serviceClient
      .from('customers')
      .update({
        program_id: program.id,
        employer: program.company_name,
        notes: notes || null,
      })
      .eq('id', existingCustomerId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    customer = data;
  } else {
    const { data, error } = await serviceClient
      .from('customers')
      .insert({
        first_name: body.first_name.trim(),
        last_name: body.last_name.trim(),
        email: normalizedEmail,
        employer: program.company_name,
        program_id: program.id,
        notes: notes || null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    customer = data;
  }

  if (body.enrollment_id && customer?.id) {
    await serviceClient
      .from('program_enrollments')
      .update({ customer_id: customer.id })
      .eq('id', body.enrollment_id);
  }

  return NextResponse.json({ customer }, { status: 201 });
}
