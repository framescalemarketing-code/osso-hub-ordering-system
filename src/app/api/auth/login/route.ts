import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const cookieStore = await cookies();
  let response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
          response = NextResponse.json({ ok: true });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error: authError, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const userId = data.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unable to establish session' }, { status: 401 });
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('id, first_name, last_name')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (!employee) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: 'Your login is valid, but it is not linked to an employee profile yet.' },
      { status: 403 },
    );
  }

  const { error: employeeUpdateError } = await supabase
    .from('employees')
    .update({ last_login_at: new Date().toISOString() })
    .eq('auth_user_id', userId);

  if (employeeUpdateError) {
    return NextResponse.json({ error: employeeUpdateError.message }, { status: 500 });
  }

  const finalResponse = NextResponse.json({
    ok: true,
    employee: {
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
    },
  });

  response.cookies.getAll().forEach(cookie => {
    finalResponse.cookies.set(cookie.name, cookie.value);
  });

  return finalResponse;
}
