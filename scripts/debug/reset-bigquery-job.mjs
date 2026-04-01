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

const env = parseEnv(resolve('.env.local'));

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY
);

// Get latest order
const { data: latestOrder } = await supabase
  .from('orders')
  .select('id')
  .order('created_at', { ascending: false })
  .limit(1);

if (!latestOrder || latestOrder.length === 0) {
  console.error('No orders found');
  process.exit(1);
}

const orderId = latestOrder[0].id;

// Reset the BigQuery job
const { data, error } = await supabase
  .from('integration_jobs')
  .update({ 
    status: 'pending', 
    attempts: 0, 
    next_run_at: new Date().toISOString(),
    last_error: null
  })
  .eq('integration', 'bigquery')
  .eq('order_id', orderId)
  .select();

if (error) {
  console.error('Error resetting job:', error);
  process.exit(1);
} else {
  console.log('Reset BigQuery job for latest order:', data);
}
