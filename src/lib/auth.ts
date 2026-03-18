import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Employee } from '@/lib/types';

export async function getCurrentEmployee(): Promise<Employee | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('employees')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  return data as Employee | null;
}
