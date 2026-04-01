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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.log(JSON.stringify({ error: 'Missing Supabase env vars' }, null, 2));
  process.exit(0);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: orders, error: orderErr } = await supabase
  .from('orders')
  .select('id,order_number,created_at,status,total,clickup_task_id,bigquery_synced_at,program_id,customer_id')
  .order('created_at', { ascending: false })
  .limit(1);

if (orderErr || !orders || orders.length === 0) {
  console.log(JSON.stringify({ error: orderErr?.message || 'No orders found' }, null, 2));
  process.exit(0);
}

const order = orders[0];

const [{ data: logs }, { data: jobs }] = await Promise.all([
  supabase
    .from('sync_log')
    .select('integration,status,external_id,error_message,attempts,last_attempt_at,created_at')
    .eq('record_type', 'order')
    .eq('record_id', order.id)
    .order('created_at', { ascending: false }),
  supabase
    .from('integration_jobs')
    .select('integration,status,attempts,max_attempts,next_run_at,last_error,external_id,updated_at')
    .eq('order_id', order.id)
    .order('updated_at', { ascending: false }),
]);

console.log(JSON.stringify({ order, sync_log: logs || [], integration_jobs: jobs || [] }, null, 2));
