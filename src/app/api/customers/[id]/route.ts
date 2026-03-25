import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEmployee } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import type { Address } from '@/lib/types';

type CustomerPatchPayload = {
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  employer?: string | null;
  notes?: string | null;
  address?: Address | null;
  program_id?: string | null;
};

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function canManageCustomerProfile(role?: string | null): boolean {
  return ['admin', 'manager'].includes(role || '');
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageCustomerProfile(employee.role)) {
    return NextResponse.json({ error: 'Only admin and manager roles can update customers' }, { status: 403 });
  }

  let body: CustomerPatchPayload;
  try {
    body = (await request.json()) as CustomerPatchPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.first_name === 'string') patch.first_name = body.first_name.trim();
  if (typeof body.last_name === 'string') patch.last_name = body.last_name.trim();
  if ('email' in body) patch.email = normalizeText(body.email);
  if ('phone' in body) patch.phone = normalizeText(body.phone);
  if ('date_of_birth' in body) patch.date_of_birth = body.date_of_birth || null;
  if ('employer' in body) patch.employer = normalizeText(body.employer);
  if ('notes' in body) patch.notes = normalizeText(body.notes);
  if ('address' in body) patch.address = body.address || null;
  if ('program_id' in body) patch.program_id = body.program_id || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  const { id } = await context.params;
  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from('customers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ customer: data });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageCustomerProfile(employee.role)) {
    return NextResponse.json({ error: 'Only admin and manager roles can archive customers' }, { status: 403 });
  }

  const { id } = await context.params;
  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from('customers')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
