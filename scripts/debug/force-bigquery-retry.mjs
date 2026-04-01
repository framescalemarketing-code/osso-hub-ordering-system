import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function parseEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
  return out;
}

const env = parseEnv(resolve(process.cwd(), '.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: orderRows, error: orderErr } = await supabase
  .from('orders')
  .select('id,order_number')
  .order('created_at', { ascending: false })
  .limit(1);

if (orderErr) {
  console.error(orderErr.message);
  process.exit(1);
}

const order = (orderRows || [])[0];
if (!order) {
  console.log('No order found');
  process.exit(0);
}

const { error } = await supabase
  .from('integration_jobs')
  .update({ next_run_at: '2000-01-01T00:00:00.000Z', status: 'pending' })
  .eq('order_id', order.id)
  .eq('integration', 'bigquery')
  .in('status', ['pending', 'processing']);

if (error) {
  console.error('Force retry update failed:', error.message);
  process.exit(1);
}

console.log(`Forced bigquery retry for ${order.order_number} (${order.id})`);
