import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEmployee } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();

  if (query.length < 2) {
    return NextResponse.json({ error: 'q must be at least 2 characters' }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const [customersRes, companiesRes, ordersRes] = await Promise.all([
    serviceClient
      .from('customers')
      .select('id, first_name, last_name, email, employer')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,employer.ilike.%${query}%`)
      .eq('is_active', true)
      .limit(8),
    serviceClient
      .from('programs')
      .select('id, company_name, company_code, contact_name, contact_email')
      .or(`company_name.ilike.%${query}%,company_code.ilike.%${query}%,contact_name.ilike.%${query}%,contact_email.ilike.%${query}%`)
      .eq('is_active', true)
      .limit(8),
    serviceClient
      .from('orders')
      .select('id, order_number, status, order_type, customer:customers(first_name, last_name)')
      .or(`order_number.ilike.%${query}%`)
      .limit(8),
  ]);

  if (customersRes.error || companiesRes.error || ordersRes.error) {
    return NextResponse.json(
      {
        error:
          customersRes.error?.message ||
          companiesRes.error?.message ||
          ordersRes.error?.message ||
          'Search failed',
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      customers: customersRes.data || [],
      companies: companiesRes.data || [],
      orders: ordersRes.data || [],
    },
    { status: 200 }
  );
}
