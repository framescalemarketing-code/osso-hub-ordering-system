import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

function getEnv(name, fallback = '') {
  if (process.env[name]?.trim()) return process.env[name].trim();
  if (fallback) return fallback;
  return '';
}

const localEnv = parseEnvFile(resolve(process.cwd(), '.env.local'));
const clickupApiKey = getEnv('CLICKUP_API_KEY', localEnv.CLICKUP_API_KEY);
const clickupListId = getEnv('CLICKUP_LIST_ID', localEnv.CLICKUP_LIST_ID);

if (!clickupApiKey || !clickupListId) {
  console.error('Missing CLICKUP_API_KEY or CLICKUP_LIST_ID.');
  process.exit(1);
}

const listUrl = `https://api.clickup.com/api/v2/list/${clickupListId}`;
const res = await fetch(listUrl, {
  method: 'GET',
  headers: {
    Authorization: clickupApiKey,
    'Content-Type': 'application/json',
  },
});

if (!res.ok) {
  const text = await res.text();
  console.error(`ClickUp list fetch failed: ${res.status} ${text}`);
  process.exit(1);
}

const data = await res.json();
const fieldsRes = await fetch(`https://api.clickup.com/api/v2/list/${clickupListId}/field`, {
  method: 'GET',
  headers: {
    Authorization: clickupApiKey,
    'Content-Type': 'application/json',
  },
});

let fields = [];
if (fieldsRes.ok) {
  const fieldPayload = await fieldsRes.json();
  fields = Array.isArray(fieldPayload?.fields) ? fieldPayload.fields : [];
} else {
  fields = Array.isArray(data?.field_settings) ? data.field_settings : [];
}
const statuses = Array.isArray(data?.statuses) ? data.statuses : [];

const output = {
  list: {
    id: data?.id,
    name: data?.name,
  },
  statuses: statuses.map((s) => ({
    id: s.id,
    status: s.status,
    type: s.type,
  })),
  custom_fields: fields.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    required: !!f.required,
    type_config: f.type_config ?? null,
  })),
};

console.log(JSON.stringify(output, null, 2));