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

async function getJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}) ${url}: ${text}`);
  }
  return res.json();
}

const out = [];
const teamPayload = await getJson('https://api.clickup.com/api/v2/team');

for (const team of teamPayload.teams || []) {
  out.push({ level: 'team', id: team.id, name: team.name });

  const spacesPayload = await getJson(`https://api.clickup.com/api/v2/team/${team.id}/space?archived=false`);
  for (const space of spacesPayload.spaces || []) {
    out.push({ level: 'space', team_id: team.id, id: space.id, name: space.name });

    const foldersPayload = await getJson(`https://api.clickup.com/api/v2/space/${space.id}/folder?archived=false`);
    for (const folder of foldersPayload.folders || []) {
      out.push({ level: 'folder', space_id: space.id, id: folder.id, name: folder.name });

      const listsPayload = await getJson(`https://api.clickup.com/api/v2/folder/${folder.id}/list?archived=false`);
      for (const list of listsPayload.lists || []) {
        out.push({ level: 'list', folder_id: folder.id, id: list.id, name: list.name });
      }
    }

    const folderlessPayload = await getJson(`https://api.clickup.com/api/v2/space/${space.id}/list?archived=false`);
    for (const list of folderlessPayload.lists || []) {
      out.push({ level: 'list_space', space_id: space.id, id: list.id, name: list.name });
    }
  }
}

console.log(JSON.stringify(out, null, 2));
