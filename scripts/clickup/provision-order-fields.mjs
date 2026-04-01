import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LIST_IDS = [
  '901711619377',
  '901711619378',
  '901711619379',
  '901711619380',
  '901711619381',
  '901711619382',
  '901711619384',
  '901711619385',
];

const FIELD_DEFINITIONS = [
  { name: 'Company Code', type: 'text' },
  { name: 'Allowance Amount', type: 'number' },
  { name: 'Order Number', type: 'text' },
  { name: 'Order Type', type: 'text' },
  { name: 'Order Status', type: 'text' },
  { name: 'Customer Name', type: 'text' },
  { name: 'Customer Email', type: 'text' },
  { name: 'Customer Phone', type: 'text' },
  { name: 'Employer', type: 'text' },
  { name: 'Order Total', type: 'number' },
  { name: 'Pair Price', type: 'number' },
  { name: 'Frame Brand', type: 'text' },
  { name: 'Frame Model', type: 'text' },
  { name: 'Frame Color', type: 'text' },
  { name: 'Frame Size', type: 'text' },
  { name: 'Lens Type', type: 'text' },
  { name: 'Lens Material', type: 'text' },
  { name: 'Lens Tint', type: 'text' },
  { name: 'Lens Coating', type: 'text' },
  { name: 'Lens Vendor', type: 'text' },
  { name: 'Polarized', type: 'checkbox' },
  { name: 'OD Sphere', type: 'number' },
  { name: 'OD Cylinder', type: 'number' },
  { name: 'OD Axis', type: 'number' },
  { name: 'OD Add', type: 'number' },
  { name: 'OD Prism', type: 'number' },
  { name: 'OD Prism Base', type: 'text' },
  { name: 'OS Sphere', type: 'number' },
  { name: 'OS Cylinder', type: 'number' },
  { name: 'OS Axis', type: 'number' },
  { name: 'OS Add', type: 'number' },
  { name: 'OS Prism', type: 'number' },
  { name: 'OS Prism Base', type: 'text' },
  { name: 'PD Distance', type: 'number' },
  { name: 'PD Near', type: 'number' },
  { name: 'PD Right', type: 'number' },
  { name: 'PD Left', type: 'number' },
  { name: 'OC Right Height', type: 'number' },
  { name: 'OC Left Height', type: 'number' },
  { name: 'Seg Height', type: 'number' },
  { name: 'Rx Date', type: 'date' },
  { name: 'Expiration Date', type: 'date' },
];

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

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

const localEnv = parseEnvFile(resolve(process.cwd(), '.env.local'));
const apiKey = process.env.CLICKUP_API_KEY?.trim() || localEnv.CLICKUP_API_KEY;

if (!apiKey) {
  console.error('Missing CLICKUP_API_KEY.');
  process.exit(1);
}

const headers = {
  Authorization: apiKey,
  'Content-Type': 'application/json',
};

async function getFields(listId) {
  const res = await fetch(`https://api.clickup.com/api/v2/list/${listId}/field`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed field fetch for ${listId}: ${res.status} ${text}`);
  }

  const data = await res.json();
  return Array.isArray(data.fields) ? data.fields : [];
}

async function createField(listId, field) {
  const res = await fetch(`https://api.clickup.com/api/v2/list/${listId}/field`, {
    method: 'POST',
    headers,
    body: JSON.stringify(field),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed field create ${field.name} on ${listId}: ${res.status} ${text}`);
  }

  return res.json();
}

const summary = [];

for (const listId of LIST_IDS) {
  const existing = await getFields(listId);
  const existingByName = new Set(existing.map((field) => normalize(field.name)));

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (const field of FIELD_DEFINITIONS) {
    if (existingByName.has(normalize(field.name))) {
      skipped += 1;
      continue;
    }

    try {
      await createField(listId, field);
      created += 1;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Unknown error creating ${field.name}`);
    }
  }

  summary.push({ list_id: listId, created, skipped, errors });
}

console.log(JSON.stringify({ lists: summary }, null, 2));
