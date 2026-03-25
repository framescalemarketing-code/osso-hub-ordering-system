import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEmployee } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

function canLookup(role?: string | null): boolean {
  return ['admin', 'manager', 'sales', 'optician', 'readonly'].includes(role || '');
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canLookup(employee.role)) {
    return NextResponse.json({ error: 'Not allowed to access enrollment lookup' }, { status: 403 });
  }

  const url = new URL(request.url);
  const programId = url.searchParams.get('program_id');
  const query = (url.searchParams.get('q') || '').trim();

  if (!programId) return NextResponse.json({ error: 'program_id is required' }, { status: 400 });

  const serviceClient = createServiceClient();
  let q = serviceClient
    .from('program_enrollments')
    .select('id, employee_first_name, employee_last_name, employee_external_id, employee_email, coverage_tier, cost_center_code, status, effective_from, effective_to, customer_id')
    .eq('program_id', programId)
    .order('employee_last_name', { ascending: true })
    .limit(100);

  if (query) {
    q = q.or([
      `employee_first_name.ilike.%${query}%`,
      `employee_last_name.ilike.%${query}%`,
      `employee_external_id.ilike.%${query}%`,
      `employee_email.ilike.%${query}%`,
      `cost_center_code.ilike.%${query}%`,
    ].join(','));
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ rows: data || [] }, { status: 200 });
}
