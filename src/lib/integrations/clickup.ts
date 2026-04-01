import { integrations } from './config';
import { calculateEuPackagePerEmployee, type EUPackageAddOnKey, type PriceAdjustment } from '@/lib/pricing';
import type { Order, Customer, OrderItem, Program, Prescription } from '@/lib/types';

type ClickUpOrderContext = Order & {
  customer: Customer;
  items: OrderItem[];
  program?: Program | null;
  prescription?: Prescription | null;
};

const folderListCache = new Map<string, Promise<Array<{ id: string; name: string }>>>();
const listFieldCache = new Map<string, Promise<ClickUpCustomField[]>>();
const listStatusCache = new Map<string, Promise<string[]>>();

type ClickUpCustomField = {
  id: string;
  name: string;
  type: string;
  type_config?: {
    options?: Array<{ id?: string | number; name?: string }>;
  } | null;
};

type ClickUpCustomFieldValue = {
  id: string;
  value: string | number | boolean | string[];
};

type ClickUpListMetadata = {
  statuses?: Array<{ status?: string; type?: string }>;
};

const FIELD_ALIASES: Record<string, string[]> = {
  company_code: ['company code', 'company_code', 'program code'],
  allowance: ['allowance', 'allowance amount', 'eu allowance', 'coverage allowance'],
  order_number: ['order number', 'order #', 'order_no'],
  order_type: ['order type'],
  order_status: ['order status', 'status'],
  customer_name: ['customer name', 'employee name', 'member name'],
  customer_email: ['customer email', 'email'],
  customer_phone: ['customer phone', 'phone'],
  customer_employer: ['employer', 'company name', 'employer name'],
  total: ['total', 'order total'],
  pair_price: ['pair price', 'line total', 'glasses price'],
  frame_brand: ['frame brand'],
  frame_model: ['frame model'],
  frame_color: ['frame color'],
  frame_size: ['frame size'],
  lens_type: ['lens type'],
  lens_material: ['lens material'],
  lens_tint: ['lens tint', 'tint'],
  lens_coating: ['lens coating', 'lens coatings', 'coatings'],
  lens_vendor: ['lens vendor', 'vendor'],
  polarized: ['polarized', 'is polarized'],
  od_sphere: ['od sphere', 'right sphere'],
  od_cylinder: ['od cylinder', 'right cylinder'],
  od_axis: ['od axis', 'right axis'],
  od_add: ['od add', 'right add'],
  od_prism: ['od prism', 'right prism'],
  od_prism_base: ['od prism base', 'right prism base'],
  os_sphere: ['os sphere', 'left sphere'],
  os_cylinder: ['os cylinder', 'left cylinder'],
  os_axis: ['os axis', 'left axis'],
  os_add: ['os add', 'left add'],
  os_prism: ['os prism', 'left prism'],
  os_prism_base: ['os prism base', 'left prism base'],
  pd_distance: ['pd distance', 'distance pd'],
  pd_near: ['pd near', 'near pd'],
  pd_right: ['pd right', 'right pd'],
  pd_left: ['pd left', 'left pd'],
  oc_right_height: ['oc right height', 'right oc height', 'oc right'],
  oc_left_height: ['oc left height', 'left oc height', 'oc left'],
  seg_height: ['seg height', 'segment height'],
  rx_date: ['rx date', 'prescription date'],
  expiration_date: ['expiration date', 'rx expiration'],
};

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePriceAdjustments(input: unknown): PriceAdjustment[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const candidate = entry as { label?: unknown; amount?: unknown };
      const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
      const amount = Number(candidate.amount);
      if (!label || Number.isNaN(amount)) return null;
      return { label, amount };
    })
    .filter((entry): entry is PriceAdjustment => !!entry);
}

function calculateProgramAllowance(program: Program | null | undefined): number | null {
  if (!program?.eu_package) return null;
  const addOns = Array.isArray(program.eu_package_add_ons)
    ? (program.eu_package_add_ons as EUPackageAddOnKey[])
    : [];
  const adjustments = normalizePriceAdjustments(program.eu_package_custom_adjustments);
  return calculateEuPackagePerEmployee(program.eu_package, addOns, adjustments);
}

function detectPolarizedTint(tint: string | null): boolean | null {
  if (!tint) return null;
  const normalized = tint.toLowerCase();
  if (normalized.includes('non polar')) return false;
  if (normalized.includes('polar')) return true;
  return null;
}

function normalizeCompanyCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  return normalized || null;
}

function findMappedListIdFromEnv(companyCode: string | null): string | null {
  if (!companyCode) return null;

  const mappedKey = `CLICKUP_LIST_ID_${companyCode}`;
  const mappedValue = process.env[mappedKey]?.trim();
  return mappedValue || null;
}

async function listFolderLists(folderId: string): Promise<Array<{ id: string; name: string }>> {
  const cached = folderListCache.get(folderId);
  if (cached) return cached;

  const pending = (async () => {
    const res = await fetch(`https://api.clickup.com/api/v2/folder/${folderId}/list?archived=false`, {
      method: 'GET',
      headers: {
        Authorization: integrations.clickup.apiKey(),
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ClickUp list discovery failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as { lists?: Array<{ id?: string; name?: string | null }> };
    return (data.lists || [])
      .filter((list) => !!list.id && !!list.name)
      .map((list) => ({ id: String(list.id), name: String(list.name || '').trim() }));
  })();

  folderListCache.set(folderId, pending);
  return pending;
}

function findCompanyListByName(lists: Array<{ id: string; name: string }>, companyCode: string): string | null {
  const expectedName = `OM - ${companyCode}`.toUpperCase();
  const exact = lists.find((list) => list.name.trim().toUpperCase() === expectedName);
  if (exact) return exact.id;

  const suffix = lists.find((list) => list.name.trim().toUpperCase().endsWith(companyCode));
  return suffix ? suffix.id : null;
}

async function resolveTargetListId(order: ClickUpOrderContext): Promise<string> {
  const companyCode = normalizeCompanyCode(order.program?.company_code || null);

  const envMappedList = findMappedListIdFromEnv(companyCode);
  if (envMappedList) return envMappedList;

  const folderId = integrations.clickup.companiesFolderId();
  if (folderId && companyCode) {
    const lists = await listFolderLists(folderId);
    const discoveredListId = findCompanyListByName(lists, companyCode);
    if (discoveredListId) return discoveredListId;

    throw new Error(`ClickUp list not found for company code ${companyCode} in folder ${folderId}`);
  }

  if (folderId && order.order_type === 'program' && !companyCode) {
    throw new Error('Program order is missing program.company_code for ClickUp list routing');
  }

  return integrations.clickup.listId();
}

async function getListCustomFields(listId: string): Promise<ClickUpCustomField[]> {
  const cached = listFieldCache.get(listId);
  if (cached) return cached;

  const pending = (async () => {
    const headers = {
      Authorization: integrations.clickup.apiKey(),
      'Content-Type': 'application/json',
    };

    const fieldsRes = await fetch(`https://api.clickup.com/api/v2/list/${listId}/field`, {
      method: 'GET',
      headers,
    });

    if (fieldsRes.ok) {
      const payload = (await fieldsRes.json()) as { fields?: ClickUpCustomField[] };
      return Array.isArray(payload.fields) ? payload.fields : [];
    }

    const listRes = await fetch(`https://api.clickup.com/api/v2/list/${listId}`, {
      method: 'GET',
      headers,
    });

    if (!listRes.ok) {
      const text = await listRes.text();
      throw new Error(`ClickUp custom field discovery failed: ${listRes.status} ${text}`);
    }

    const listPayload = (await listRes.json()) as { field_settings?: ClickUpCustomField[] };
    return Array.isArray(listPayload.field_settings) ? listPayload.field_settings : [];
  })();

  listFieldCache.set(listId, pending);
  return pending;
}

async function getListStatuses(listId: string): Promise<string[]> {
  const cached = listStatusCache.get(listId);
  if (cached) return cached;

  const pending = (async () => {
    const res = await fetch(`https://api.clickup.com/api/v2/list/${listId}`, {
      method: 'GET',
      headers: {
        Authorization: integrations.clickup.apiKey(),
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) return [];
    const payload = (await res.json()) as ClickUpListMetadata;
    return (payload.statuses || [])
      .map((entry) => String(entry.status || '').trim())
      .filter(Boolean);
  })();

  listStatusCache.set(listId, pending);
  return pending;
}

async function resolveInitialTaskStatus(listId: string): Promise<string> {
  const statuses = await getListStatuses(listId);
  const normalized = statuses.map((status) => ({
    original: status,
    normalized: normalizeLabel(status),
  }));

  const preferred = ['on order', 'hold for process'];
  for (const preferredName of preferred) {
    const match = normalized.find((entry) => entry.normalized === preferredName);
    if (match) return match.original;
  }

  return statuses[0] || 'Hold for Process';
}

function resolveCustomFieldByAlias(fields: ClickUpCustomField[], aliases: string[]): ClickUpCustomField | null {
  const normalizedAliases = aliases.map(normalizeLabel);

  for (const alias of normalizedAliases) {
    const exact = fields.find((field) => normalizeLabel(field.name) === alias);
    if (exact) return exact;
  }

  for (const alias of normalizedAliases) {
    const partial = fields.find((field) => normalizeLabel(field.name).includes(alias));
    if (partial) return partial;
  }

  return null;
}

function mapDropdownOptionId(field: ClickUpCustomField, value: string): string | null {
  const options = field.type_config?.options || [];
  const normalizedValue = normalizeLabel(value);
  const option = options.find((candidate) => normalizeLabel(String(candidate.name || '')) === normalizedValue);
  if (!option?.id) return null;
  return String(option.id);
}

function toClickUpFieldValue(field: ClickUpCustomField, value: unknown): ClickUpCustomFieldValue['value'] | null {
  if (value === null || value === undefined || value === '') return null;

  const type = (field.type || '').toLowerCase();
  if (type === 'checkbox') return Boolean(value);

  if (type === 'number' || type === 'currency') {
    const numeric = toNumberOrNull(value);
    return numeric === null ? null : numeric;
  }

  if (type === 'date') {
    const dateValue = typeof value === 'string' ? value : String(value);
    const millis = Date.parse(dateValue);
    return Number.isNaN(millis) ? null : millis;
  }

  if (type === 'drop_down') {
    const label = String(value);
    const optionId = mapDropdownOptionId(field, label);
    return optionId || null;
  }

  if (type === 'labels') {
    const label = String(value);
    const optionId = mapDropdownOptionId(field, label);
    return optionId ? [optionId] : null;
  }

  return String(value);
}

function buildCustomFieldSource(order: ClickUpOrderContext) {
  const firstItem = order.items[0] || null;
  const rx = order.prescription || null;
  const allowance = calculateProgramAllowance(order.program || null);

  return {
    company_code: order.program?.company_code || null,
    allowance,
    order_number: order.order_number,
    order_type: order.order_type,
    order_status: order.status,
    customer_name: `${order.customer.first_name} ${order.customer.last_name}`.trim(),
    customer_email: order.customer.email,
    customer_phone: order.customer.phone,
    customer_employer: order.customer.employer,
    total: toNumberOrNull(order.total),
    pair_price: firstItem ? toNumberOrNull(firstItem.line_total) : null,
    frame_brand: firstItem?.frame_brand || null,
    frame_model: firstItem?.frame_model || null,
    frame_color: firstItem?.frame_color || null,
    frame_size: firstItem?.frame_size || null,
    lens_type: firstItem?.lens_type || null,
    lens_material: firstItem?.lens_material || null,
    lens_tint: firstItem?.lens_tint || null,
    lens_coating: firstItem?.lens_coating?.join(', ') || null,
    lens_vendor: firstItem?.lens_vendor || null,
    polarized: detectPolarizedTint(firstItem?.lens_tint || null),
    od_sphere: rx?.od_sphere ?? null,
    od_cylinder: rx?.od_cylinder ?? null,
    od_axis: rx?.od_axis ?? null,
    od_add: rx?.od_add ?? null,
    od_prism: rx?.od_prism ?? null,
    od_prism_base: rx?.od_prism_base ?? null,
    os_sphere: rx?.os_sphere ?? null,
    os_cylinder: rx?.os_cylinder ?? null,
    os_axis: rx?.os_axis ?? null,
    os_add: rx?.os_add ?? null,
    os_prism: rx?.os_prism ?? null,
    os_prism_base: rx?.os_prism_base ?? null,
    pd_distance: rx?.pd_distance ?? null,
    pd_near: rx?.pd_near ?? null,
    pd_right: rx?.pd_right ?? null,
    pd_left: rx?.pd_left ?? null,
    oc_right_height: rx?.oc_right_height ?? null,
    oc_left_height: rx?.oc_left_height ?? null,
    seg_height: rx?.seg_height ?? null,
    rx_date: rx?.rx_date ?? null,
    expiration_date: rx?.expiration_date ?? null,
  };
}

async function buildCustomFieldPayload(
  listId: string,
  order: ClickUpOrderContext
): Promise<ClickUpCustomFieldValue[]> {
  const availableFields = await getListCustomFields(listId);
  if (!availableFields.length) return [];

  const source = buildCustomFieldSource(order);
  const payload: ClickUpCustomFieldValue[] = [];
  const usedFieldIds = new Set<string>();

  for (const [sourceKey, aliases] of Object.entries(FIELD_ALIASES)) {
    const rawValue = source[sourceKey as keyof typeof source];
    if (rawValue === null || rawValue === undefined || rawValue === '') continue;

    const field = resolveCustomFieldByAlias(availableFields, aliases);
    if (!field || usedFieldIds.has(field.id)) continue;

    const fieldValue = toClickUpFieldValue(field, rawValue);
    if (fieldValue === null) continue;

    payload.push({ id: field.id, value: fieldValue });
    usedFieldIds.add(field.id);
  }

  return payload;
}

export async function syncToClickUp(order: ClickUpOrderContext) {
  if (!integrations.clickup.enabled()) return null;

  const targetListId = await resolveTargetListId(order);
  const customFields = await buildCustomFieldPayload(targetListId, order);
  const taskStatus = await resolveInitialTaskStatus(targetListId);
  const allowance = calculateProgramAllowance(order.program || null);
  const rx = order.prescription || null;

  const itemLines = order.items.map(i =>
    `- ${i.glasses_type.replace(/_/g, ' ')} | Frame: ${i.frame_brand || 'N/A'} ${i.frame_model || ''} | Lens: ${i.lens_type || 'N/A'} / ${i.lens_material || 'N/A'} | Coatings: ${(i.lens_coating || []).join(', ') || 'N/A'} | Price: $${i.line_total}`
  ).join('\n');

  const rxSummary = rx
    ? `OD S/C/A: ${rx.od_sphere ?? 'N/A'} / ${rx.od_cylinder ?? 'N/A'} / ${rx.od_axis ?? 'N/A'}\nOS S/C/A: ${rx.os_sphere ?? 'N/A'} / ${rx.os_cylinder ?? 'N/A'} / ${rx.os_axis ?? 'N/A'}\nPD D/N/R/L: ${rx.pd_distance ?? 'N/A'} / ${rx.pd_near ?? 'N/A'} / ${rx.pd_right ?? 'N/A'} / ${rx.pd_left ?? 'N/A'}\nOC R/L + Seg: ${rx.oc_right_height ?? 'N/A'} / ${rx.oc_left_height ?? 'N/A'} / ${rx.seg_height ?? 'N/A'}`
    : 'Prescription: not attached';

  const body = {
    name: `Order ${order.order_number} — ${order.customer.first_name} ${order.customer.last_name}`,
    description: `Order Type: ${order.order_type}\nProgram Code: ${order.program?.company_code || 'N/A'}\nCustomer: ${order.customer.first_name} ${order.customer.last_name}\nEmail: ${order.customer.email || 'N/A'}\nPhone: ${order.customer.phone || 'N/A'}\nAllowance: ${allowance ?? 'N/A'}\n\nPrescription:\n${rxSummary}\n\nItems:\n${itemLines}\n\nTotal: $${order.total}\nSource Status: ${order.status}`,
    status: taskStatus,
    priority: order.order_type === 'program' ? 2 : 3,
    tags: [order.order_type, 'on_order', order.status],
    custom_fields: customFields,
  };

  const res = await fetch(`https://api.clickup.com/api/v2/list/${targetListId}/task`, {
    method: 'POST',
    headers: {
      'Authorization': integrations.clickup.apiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClickUp sync failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.id as string;
}
