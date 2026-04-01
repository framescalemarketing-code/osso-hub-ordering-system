import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const COMPANY_LISTS = [
  { code: 'ABZE', listId: '901711619377' },
  { code: 'ADAR', listId: '901711619378' },
  { code: 'ABCB', listId: '901711619379' },
  { code: 'DEXAZ', listId: '901711619380' },
  { code: 'NTXT', listId: '901711619381' },
  { code: 'WFSQ', listId: '901711619382' },
  { code: 'GKNA', listId: '901711619384' },
  { code: 'EMDG', listId: '901711619385' },
];

const ALLOWANCE_OPTIONS = [300, 500, 620];
const BASE_ALLOWANCE = 435;

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  const parsed = {};
  const raw = readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, '');
    parsed[key] = value;
  }

  return parsed;
}

function pickRandomAllowance() {
  return ALLOWANCE_OPTIONS[Math.floor(Math.random() * ALLOWANCE_OPTIONS.length)];
}

function buildAllowanceAdjustments(targetAllowance) {
  return [
    {
      label: `Allowance target ${targetAllowance}`,
      amount: targetAllowance - BASE_ALLOWANCE,
    },
  ];
}

const localEnv = parseEnvFile(resolve(process.cwd(), '.env.local'));
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || localEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecret = process.env.SUPABASE_SECRET_KEY?.trim() || localEnv.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecret) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: buckets } = await supabase
  .from('program_buckets')
  .select('id, code')
  .in('code', ['EU_COMPLETE', 'SERVICE_ESSENTIAL']);

const euBucketId = (buckets || []).find((row) => row.code === 'EU_COMPLETE')?.id || null;
const serviceBucketId = (buckets || []).find((row) => row.code === 'SERVICE_ESSENTIAL')?.id || null;

const summary = [];

for (const company of COMPANY_LISTS) {
  const allowance = pickRandomAllowance();
  const companyName = `OM - ${company.code}`;

  const payload = {
    company_name: companyName,
    company_code: company.code,
    approval_required: false,
    approver_emails: [],
    invoice_terms: 'Net 30',
    program_type: 'order_management',
    employee_count: 0,
    eu_package: 'Complete',
    eu_package_add_ons: [],
    eu_package_custom_adjustments: buildAllowanceAdjustments(allowance),
    service_tier: 'Essential',
    service_tier_custom_adjustments: [],
    is_active: true,
    notes: `Seeded from ClickUp Companies list ${company.listId}`,
  };

  const { data: existingRows, error: existingError } = await supabase
    .from('programs')
    .select('id, company_name')
    .eq('company_code', company.code)
    .order('created_at', { ascending: true })
    .limit(1);

  if (existingError) {
    console.error(`Lookup failed for ${company.code}: ${existingError.message}`);
    continue;
  }

  let programId;
  if (existingRows && existingRows.length > 0) {
    programId = existingRows[0].id;
    const { error: updateError } = await supabase.from('programs').update(payload).eq('id', programId);
    if (updateError) {
      console.error(`Update failed for ${company.code}: ${updateError.message}`);
      continue;
    }
  } else {
    const { data: created, error: insertError } = await supabase
      .from('programs')
      .insert(payload)
      .select('id')
      .single();

    if (insertError || !created) {
      console.error(`Insert failed for ${company.code}: ${insertError?.message || 'Unknown insert error'}`);
      continue;
    }
    programId = created.id;
  }

  const companyProgramPayload = {
    program_id: programId,
    company_code: company.code,
    code: company.code,
    name: companyName,
    eu_package_bucket_id: euBucketId,
    service_tier_bucket_id: serviceBucketId,
    status: 'active',
  };

  const { error: companyProgramError } = await supabase
    .from('company_programs')
    .upsert(companyProgramPayload, { onConflict: 'program_id' });

  if (companyProgramError) {
    console.warn(`company_programs sync warning for ${company.code}: ${companyProgramError.message}`);
  }

  summary.push({
    company_code: company.code,
    list_id: company.listId,
    allowance,
    program_id: programId,
  });
}

console.log(JSON.stringify({ seeded: summary.length, companies: summary }, null, 2));
