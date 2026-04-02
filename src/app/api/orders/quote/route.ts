import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { calculateOrderPricing } from '@/lib/orders/pricing';
import type { OrderIntake } from '@/lib/types';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as { intake?: OrderIntake };
  if (!body.intake) {
    return NextResponse.json({ error: 'intake required' }, { status: 400 });
  }

  const summary = calculateOrderPricing(body.intake);
  return NextResponse.json({ summary });
}
