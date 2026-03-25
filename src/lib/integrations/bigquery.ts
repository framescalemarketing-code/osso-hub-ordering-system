import { integrations } from './config';
import type { Dataset, Table } from '@google-cloud/bigquery';
import type { Customer, Order, OrderItem, Program } from '@/lib/types';

type BigQueryMode = 'NULLABLE' | 'REQUIRED' | 'REPEATED';

type ExtendedProgram = Program & {
  program_type?: string | null;
  employee_count?: number | null;
  restricted_guidelines?: string | null;
  loyalty_credit_count?: number | null;
  referral_credit_count?: number | null;
};

type BigQueryOrderContext = Order & {
  customer: Customer & { program?: ExtendedProgram | null };
  items: OrderItem[];
  program?: ExtendedProgram | null;
};

type BigQueryField = {
  name: string;
  type: string;
  mode?: BigQueryMode;
  description?: string;
  fields?: BigQueryField[];
};

type BigQueryRow = Record<string, unknown>;

type BigQueryTargets = {
  dataset: Dataset;
  ordersTable: Table;
  orderItemsTable: Table;
  customersTable: Table;
  programsTable: Table;
};

const SOURCE_SYSTEM = 'osso-hub';
const READY_TARGETS_CACHE = new Map<string, Promise<BigQueryTargets>>();

const CUSTOMER_SCHEMA: BigQueryField[] = [
  { name: 'customer_id', type: 'STRING' },
  { name: 'first_name', type: 'STRING' },
  { name: 'last_name', type: 'STRING' },
  { name: 'full_name', type: 'STRING' },
  { name: 'email', type: 'STRING' },
  { name: 'phone', type: 'STRING' },
  { name: 'date_of_birth', type: 'DATE' },
  { name: 'employer', type: 'STRING' },
  { name: 'address_street', type: 'STRING' },
  { name: 'address_city', type: 'STRING' },
  { name: 'address_state', type: 'STRING' },
  { name: 'address_zip', type: 'STRING' },
  { name: 'marketing_consent', type: 'BOOLEAN' },
  { name: 'hipaa_consent_signed', type: 'BOOLEAN' },
  { name: 'ccpa_consent_signed', type: 'BOOLEAN' },
  { name: 'notes', type: 'STRING' },
  { name: 'program_id', type: 'STRING' },
  { name: 'program_name', type: 'STRING' },
  { name: 'program_type', type: 'STRING' },
  { name: 'program_contact_name', type: 'STRING' },
  { name: 'program_contact_email', type: 'STRING' },
  { name: 'program_invoice_terms', type: 'STRING' },
  { name: 'program_approval_required', type: 'BOOLEAN' },
  { name: 'program_is_active', type: 'BOOLEAN' },
  { name: 'program_eu_package', type: 'STRING' },
  { name: 'program_service_tier', type: 'STRING' },
  { name: 'source_customer_updated_at', type: 'TIMESTAMP' },
  { name: 'source_order_id', type: 'STRING' },
  { name: 'synced_at', type: 'TIMESTAMP' },
];

const PROGRAM_SCHEMA: BigQueryField[] = [
  { name: 'program_id', type: 'STRING' },
  { name: 'company_name', type: 'STRING' },
  { name: 'program_type', type: 'STRING' },
  { name: 'employee_count', type: 'INTEGER' },
  { name: 'contact_name', type: 'STRING' },
  { name: 'contact_email', type: 'STRING' },
  { name: 'contact_phone', type: 'STRING' },
  { name: 'approval_required', type: 'BOOLEAN' },
  { name: 'approver_emails', type: 'STRING', mode: 'REPEATED' },
  { name: 'billing_street', type: 'STRING' },
  { name: 'billing_city', type: 'STRING' },
  { name: 'billing_state', type: 'STRING' },
  { name: 'billing_zip', type: 'STRING' },
  { name: 'location_street', type: 'STRING' },
  { name: 'location_city', type: 'STRING' },
  { name: 'location_state', type: 'STRING' },
  { name: 'location_zip', type: 'STRING' },
  { name: 'shipping_street', type: 'STRING' },
  { name: 'shipping_city', type: 'STRING' },
  { name: 'shipping_state', type: 'STRING' },
  { name: 'shipping_zip', type: 'STRING' },
  { name: 'invoice_terms', type: 'STRING' },
  { name: 'eu_package', type: 'STRING' },
  { name: 'eu_package_add_ons', type: 'STRING', mode: 'REPEATED' },
  { name: 'eu_package_custom_adjustments_json', type: 'STRING' },
  { name: 'service_tier', type: 'STRING' },
  { name: 'service_tier_custom_adjustments_json', type: 'STRING' },
  { name: 'restricted_guidelines', type: 'STRING' },
  { name: 'loyalty_credit_count', type: 'INTEGER' },
  { name: 'referral_credit_count', type: 'INTEGER' },
  { name: 'notes', type: 'STRING' },
  { name: 'is_active', type: 'BOOLEAN' },
  { name: 'source_program_updated_at', type: 'TIMESTAMP' },
  { name: 'source_order_id', type: 'STRING' },
  { name: 'synced_at', type: 'TIMESTAMP' },
];

const ORDER_SCHEMA: BigQueryField[] = [
  { name: 'order_id', type: 'STRING' },
  { name: 'order_number', type: 'STRING' },
  { name: 'order_type', type: 'STRING' },
  { name: 'status', type: 'STRING' },
  { name: 'source_order_updated_at', type: 'TIMESTAMP' },
  { name: 'synced_at', type: 'TIMESTAMP' },
  { name: 'source_system', type: 'STRING' },
  { name: 'customer_id', type: 'STRING' },
  { name: 'customer_name', type: 'STRING' },
  { name: 'customer_first_name', type: 'STRING' },
  { name: 'customer_last_name', type: 'STRING' },
  { name: 'customer_email', type: 'STRING' },
  { name: 'customer_phone', type: 'STRING' },
  { name: 'customer_date_of_birth', type: 'DATE' },
  { name: 'customer_company_name', type: 'STRING' },
  { name: 'customer_notes', type: 'STRING' },
  { name: 'customer_marketing_consent', type: 'BOOLEAN' },
  { name: 'customer_program_id', type: 'STRING' },
  { name: 'customer_program_name', type: 'STRING' },
  { name: 'customer_program_type', type: 'STRING' },
  { name: 'customer_program_contact_name', type: 'STRING' },
  { name: 'customer_program_contact_email', type: 'STRING' },
  { name: 'customer_program_eu_package', type: 'STRING' },
  { name: 'customer_program_service_tier', type: 'STRING' },
  { name: 'program_id', type: 'STRING' },
  { name: 'program_name', type: 'STRING' },
  { name: 'program_type', type: 'STRING' },
  { name: 'program_contact_name', type: 'STRING' },
  { name: 'program_contact_email', type: 'STRING' },
  { name: 'program_invoice_terms', type: 'STRING' },
  { name: 'program_approval_required', type: 'BOOLEAN' },
  { name: 'program_is_active', type: 'BOOLEAN' },
  { name: 'program_eu_package', type: 'STRING' },
  { name: 'program_eu_package_add_ons', type: 'STRING', mode: 'REPEATED' },
  { name: 'program_eu_package_custom_adjustments_json', type: 'STRING' },
  { name: 'program_service_tier', type: 'STRING' },
  { name: 'program_service_tier_custom_adjustments_json', type: 'STRING' },
  { name: 'program_employee_count', type: 'INTEGER' },
  { name: 'program_restricted_guidelines', type: 'STRING' },
  { name: 'program_loyalty_credit_count', type: 'INTEGER' },
  { name: 'program_referral_credit_count', type: 'INTEGER' },
  { name: 'employee_id', type: 'STRING' },
  { name: 'subtotal', type: 'NUMERIC' },
  { name: 'tax', type: 'NUMERIC' },
  { name: 'discount', type: 'NUMERIC' },
  { name: 'total', type: 'NUMERIC' },
  { name: 'shipping_street', type: 'STRING' },
  { name: 'shipping_city', type: 'STRING' },
  { name: 'shipping_state', type: 'STRING' },
  { name: 'shipping_zip', type: 'STRING' },
  { name: 'internal_notes', type: 'STRING' },
  { name: 'customer_profile_notes', type: 'STRING' },
  { name: 'customer_notes', type: 'STRING' },
  { name: 'prescription_id', type: 'STRING' },
  { name: 'bigquery_sync_source', type: 'STRING' },
];

const ORDER_ITEM_SCHEMA: BigQueryField[] = [
  { name: 'item_id', type: 'STRING' },
  { name: 'order_id', type: 'STRING' },
  { name: 'order_number', type: 'STRING' },
  { name: 'source_order_updated_at', type: 'TIMESTAMP' },
  { name: 'synced_at', type: 'TIMESTAMP' },
  { name: 'source_system', type: 'STRING' },
  { name: 'customer_id', type: 'STRING' },
  { name: 'customer_name', type: 'STRING' },
  { name: 'program_id', type: 'STRING' },
  { name: 'program_name', type: 'STRING' },
  { name: 'program_eu_package', type: 'STRING' },
  { name: 'program_service_tier', type: 'STRING' },
  { name: 'glasses_type', type: 'STRING' },
  { name: 'frame_brand', type: 'STRING' },
  { name: 'frame_model', type: 'STRING' },
  { name: 'frame_color', type: 'STRING' },
  { name: 'frame_size', type: 'STRING' },
  { name: 'frame_price', type: 'NUMERIC' },
  { name: 'lens_type', type: 'STRING' },
  { name: 'lens_material', type: 'STRING' },
  { name: 'lens_coating', type: 'STRING', mode: 'REPEATED' },
  { name: 'lens_tint', type: 'STRING' },
  { name: 'lens_vendor', type: 'STRING' },
  { name: 'lens_price', type: 'NUMERIC' },
  { name: 'quantity', type: 'INTEGER' },
  { name: 'line_total', type: 'NUMERIC' },
  { name: 'notes', type: 'STRING' },
  { name: 'created_at', type: 'TIMESTAMP' },
];

export async function writeOrderToBigQuery(order: BigQueryOrderContext) {
  if (!integrations.bigquery.enabled()) return;

  const { ordersTable, orderItemsTable, customersTable, programsTable } = await getBigQueryTargets();
  const syncedAt = new Date().toISOString();
  const program = resolveProgramContext(order);

  const customerRow = buildCustomerRow(order, program, syncedAt);
  const programRow = program ? buildProgramRow(order, program, syncedAt) : null;
  const orderRow = buildOrderRow(order, program, syncedAt);
  const orderItemRows = order.items.map((item) => buildOrderItemRow(order, program, item, syncedAt));

  const writes = [
    ordersTable.insert([buildInsertRow(orderRow, `order:${order.id}`)], {
      raw: true,
      createInsertId: false,
      ignoreUnknownValues: true,
      partialRetries: 3,
    }),
    customersTable.insert(
      [
        buildInsertRow(
          customerRow,
          `customer:${String(customerRow.customer_id)}:${String(customerRow.source_customer_updated_at || order.customer.updated_at)}`
        ),
      ],
      {
        raw: true,
        createInsertId: false,
        ignoreUnknownValues: true,
        partialRetries: 3,
      }
    ),
  ];

  if (programRow) {
    writes.push(
      programsTable.insert(
        [buildInsertRow(programRow, `program:${String(programRow.program_id)}:${String(programRow.source_program_updated_at || syncedAt)}`)],
        {
          raw: true,
          createInsertId: false,
          ignoreUnknownValues: true,
          partialRetries: 3,
        }
      )
    );
  }

  if (orderItemRows.length) {
    writes.push(
      orderItemsTable.insert(
        orderItemRows.map((row) =>
          buildInsertRow(row, `order_item:${String(row.item_id)}:${String(row.source_order_updated_at || syncedAt)}`)
        ),
        {
          raw: true,
          createInsertId: false,
          ignoreUnknownValues: true,
          partialRetries: 3,
        }
      )
    );
  }

  await Promise.all(writes);
}

export async function ensureBigQuerySyncSchema() {
  if (!integrations.bigquery.enabled()) return null;
  return getBigQueryTargets();
}

async function getBigQueryTargets(): Promise<BigQueryTargets> {
  const projectId = integrations.bigquery.projectId();
  const datasetId = integrations.bigquery.dataset();
  const cacheKey = `${projectId}:${datasetId}`;

  const cached = READY_TARGETS_CACHE.get(cacheKey);
  if (cached) return cached;

  const readyPromise = (async () => {
    const { BigQuery } = await import('@google-cloud/bigquery');
    const bigQuery = new BigQuery({ projectId });

    const dataset = bigQuery.dataset(datasetId);
    const [datasetExists] = await dataset.exists();
    if (!datasetExists) {
      try {
        await bigQuery.createDataset(datasetId);
        console.info(`[BigQuery] Created dataset ${projectId}.${datasetId}`);
      } catch (error) {
        if (!isAlreadyExistsError(error)) {
          throw error;
        }
      }
    }

    const ordersTable = await ensureTable(dataset, 'orders', ORDER_SCHEMA);
    const orderItemsTable = await ensureTable(dataset, 'order_items', ORDER_ITEM_SCHEMA);
    const customersTable = await ensureTable(dataset, 'customers', CUSTOMER_SCHEMA);
    const programsTable = await ensureTable(dataset, 'programs', PROGRAM_SCHEMA);

    return {
      dataset,
      ordersTable,
      orderItemsTable,
      customersTable,
      programsTable,
    };
  })();

  const wrappedPromise = readyPromise.catch((error) => {
    READY_TARGETS_CACHE.delete(cacheKey);
    throw error;
  });

  READY_TARGETS_CACHE.set(cacheKey, wrappedPromise);
  return wrappedPromise;
}

async function ensureTable(dataset: Dataset, tableId: string, schema: BigQueryField[]): Promise<Table> {
  const table = dataset.table(tableId);
  const [exists] = await table.exists();

  if (!exists) {
    try {
      await dataset.createTable(tableId, { schema });
      console.info(`[BigQuery] Created table ${dataset.id}.${tableId}`);
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }
    }
    return table;
  }

  const [metadata] = await table.getMetadata();
  const existingSchema = normalizeSchema(metadata.schema);
  const mergedSchema = mergeSchemas(existingSchema, schema);

  if (!schemasEqual(existingSchema, mergedSchema)) {
    await table.setMetadata({ schema: mergedSchema });
    const addedFields = diffSchemaFields(existingSchema, mergedSchema).map((field) => field.name);
    console.info(
      `[BigQuery] Patched table ${dataset.id}.${tableId} schema${addedFields.length ? ` (+${addedFields.join(', ')})` : ''}`
    );
  }

  return table;
}

function resolveProgramContext(order: BigQueryOrderContext): ExtendedProgram | null {
  return order.program ?? order.customer.program ?? null;
}

function buildCustomerRow(
  order: BigQueryOrderContext,
  program: ExtendedProgram | null,
  syncedAt: string
): BigQueryRow {
  const customer = order.customer;
  return {
    customer_id: customer.id,
    first_name: customer.first_name,
    last_name: customer.last_name,
    full_name: `${customer.first_name} ${customer.last_name}`.trim(),
    email: customer.email,
    phone: customer.phone,
    date_of_birth: customer.date_of_birth,
    employer: customer.employer,
    address_street: customer.address?.street ?? null,
    address_city: customer.address?.city ?? null,
    address_state: customer.address?.state ?? null,
    address_zip: customer.address?.zip ?? null,
    marketing_consent: customer.marketing_consent,
    hipaa_consent_signed: customer.hipaa_consent_signed,
    ccpa_consent_signed: customer.ccpa_consent_signed,
    notes: customer.notes,
    program_id: customer.program?.id ?? program?.id ?? null,
    program_name: customer.program?.company_name ?? program?.company_name ?? null,
    program_type: getProgramType(customer.program ?? program),
    program_contact_name: customer.program?.contact_name ?? program?.contact_name ?? null,
    program_contact_email: customer.program?.contact_email ?? program?.contact_email ?? null,
    program_invoice_terms: customer.program?.invoice_terms ?? program?.invoice_terms ?? null,
    program_approval_required: customer.program?.approval_required ?? program?.approval_required ?? null,
    program_is_active: customer.program?.is_active ?? program?.is_active ?? null,
    program_eu_package: customer.program?.eu_package ?? program?.eu_package ?? null,
    program_service_tier: customer.program?.service_tier ?? program?.service_tier ?? null,
    source_customer_updated_at: customer.updated_at,
    source_order_id: order.id,
    synced_at: syncedAt,
  };
}

function buildProgramRow(order: BigQueryOrderContext, program: ExtendedProgram, syncedAt: string): BigQueryRow {
  return {
    program_id: program.id,
    company_name: program.company_name,
    program_type: getProgramType(program),
    employee_count: program.employee_count ?? null,
    contact_name: program.contact_name,
    contact_email: program.contact_email,
    contact_phone: program.contact_phone,
    approval_required: program.approval_required,
    approver_emails: program.approver_emails || [],
    billing_street: program.billing_address?.street ?? null,
    billing_city: program.billing_address?.city ?? null,
    billing_state: program.billing_address?.state ?? null,
    billing_zip: program.billing_address?.zip ?? null,
    location_street: program.location_address?.street ?? null,
    location_city: program.location_address?.city ?? null,
    location_state: program.location_address?.state ?? null,
    location_zip: program.location_address?.zip ?? null,
    shipping_street: program.shipping_address?.street ?? null,
    shipping_city: program.shipping_address?.city ?? null,
    shipping_state: program.shipping_address?.state ?? null,
    shipping_zip: program.shipping_address?.zip ?? null,
    invoice_terms: program.invoice_terms,
    eu_package: program.eu_package ?? null,
    eu_package_add_ons: program.eu_package_add_ons || [],
    eu_package_custom_adjustments_json: toJsonString(program.eu_package_custom_adjustments),
    service_tier: program.service_tier ?? null,
    service_tier_custom_adjustments_json: toJsonString(program.service_tier_custom_adjustments),
    restricted_guidelines: program.restricted_guidelines ?? program.notes ?? null,
    loyalty_credit_count: program.loyalty_credit_count ?? null,
    referral_credit_count: program.referral_credit_count ?? null,
    notes: program.notes,
    is_active: program.is_active,
    source_program_updated_at: program.updated_at,
    source_order_id: order.id,
    synced_at: syncedAt,
  };
}

function buildOrderRow(order: BigQueryOrderContext, program: ExtendedProgram | null, syncedAt: string): BigQueryRow {
  const customerProgram = order.customer.program ?? null;
  const effectiveProgram = program ?? customerProgram;

  return {
    order_id: order.id,
    order_number: order.order_number,
    order_type: order.order_type,
    status: order.status,
    source_order_updated_at: order.updated_at,
    synced_at: syncedAt,
    source_system: SOURCE_SYSTEM,
    customer_id: order.customer_id,
    customer_name: `${order.customer.first_name} ${order.customer.last_name}`.trim(),
    customer_first_name: order.customer.first_name,
    customer_last_name: order.customer.last_name,
    customer_email: order.customer.email,
    customer_phone: order.customer.phone,
    customer_date_of_birth: order.customer.date_of_birth,
    customer_company_name: order.customer.employer,
    customer_profile_notes: order.customer.notes,
    customer_marketing_consent: order.customer.marketing_consent,
    customer_program_id: customerProgram?.id ?? null,
    customer_program_name: customerProgram?.company_name ?? null,
    customer_program_type: getProgramType(customerProgram),
    customer_program_contact_name: customerProgram?.contact_name ?? null,
    customer_program_contact_email: customerProgram?.contact_email ?? null,
    customer_program_eu_package: customerProgram?.eu_package ?? null,
    customer_program_service_tier: customerProgram?.service_tier ?? null,
    program_id: effectiveProgram?.id ?? order.program_id ?? null,
    program_name: effectiveProgram?.company_name ?? null,
    program_type: getProgramType(effectiveProgram),
    program_contact_name: effectiveProgram?.contact_name ?? null,
    program_contact_email: effectiveProgram?.contact_email ?? null,
    program_invoice_terms: effectiveProgram?.invoice_terms ?? null,
    program_approval_required: effectiveProgram?.approval_required ?? null,
    program_is_active: effectiveProgram?.is_active ?? null,
    program_eu_package: effectiveProgram?.eu_package ?? null,
    program_eu_package_add_ons: effectiveProgram?.eu_package_add_ons || [],
    program_eu_package_custom_adjustments_json: toJsonString(effectiveProgram?.eu_package_custom_adjustments),
    program_service_tier: effectiveProgram?.service_tier ?? null,
    program_service_tier_custom_adjustments_json: toJsonString(effectiveProgram?.service_tier_custom_adjustments),
    program_employee_count: effectiveProgram?.employee_count ?? null,
    program_restricted_guidelines: effectiveProgram?.restricted_guidelines ?? effectiveProgram?.notes ?? null,
    program_loyalty_credit_count: effectiveProgram?.loyalty_credit_count ?? null,
    program_referral_credit_count: effectiveProgram?.referral_credit_count ?? null,
    employee_id: order.employee_id,
    subtotal: order.subtotal,
    tax: order.tax,
    discount: order.discount,
    total: order.total,
    shipping_street: order.shipping_address?.street ?? null,
    shipping_city: order.shipping_address?.city ?? null,
    shipping_state: order.shipping_address?.state ?? null,
    shipping_zip: order.shipping_address?.zip ?? null,
    internal_notes: order.internal_notes,
    customer_notes: order.customer_notes,
    prescription_id: order.prescription_id,
    bigquery_sync_source: SOURCE_SYSTEM,
  };
}

function buildOrderItemRow(
  order: BigQueryOrderContext,
  program: ExtendedProgram | null,
  item: OrderItem,
  syncedAt: string
): BigQueryRow {
  const effectiveProgram = program ?? order.customer.program ?? null;
  return {
    item_id: item.id,
    order_id: order.id,
    order_number: order.order_number,
    source_order_updated_at: order.updated_at,
    synced_at: syncedAt,
    source_system: SOURCE_SYSTEM,
    customer_id: order.customer_id,
    customer_name: `${order.customer.first_name} ${order.customer.last_name}`.trim(),
    program_id: effectiveProgram?.id ?? order.program_id ?? null,
    program_name: effectiveProgram?.company_name ?? null,
    program_eu_package: effectiveProgram?.eu_package ?? null,
    program_service_tier: effectiveProgram?.service_tier ?? null,
    glasses_type: item.glasses_type,
    frame_brand: item.frame_brand,
    frame_model: item.frame_model,
    frame_color: item.frame_color,
    frame_size: item.frame_size,
    frame_price: item.frame_price,
    lens_type: item.lens_type,
    lens_material: item.lens_material,
    lens_coating: item.lens_coating || [],
    lens_tint: item.lens_tint,
    lens_vendor: item.lens_vendor,
    lens_price: item.lens_price,
    quantity: item.quantity,
    line_total: item.line_total,
    notes: item.notes,
    created_at: item.created_at,
  };
}

function buildInsertRow(row: BigQueryRow, insertId: string) {
  return {
    insertId,
    json: row,
  };
}

function toJsonString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function getProgramType(program?: ExtendedProgram | null): string | null {
  if (!program) return null;
  return program.program_type ?? null;
}

function normalizeSchema(schema: unknown): BigQueryField[] {
  if (!Array.isArray(schema)) return [];
  return schema as BigQueryField[];
}

function mergeSchemas(existing: BigQueryField[], desired: BigQueryField[]): BigQueryField[] {
  const desiredMap = new Map(desired.map((field) => [field.name, field]));
  const merged = existing.map((existingField) => {
    const desiredField = desiredMap.get(existingField.name);
    if (!desiredField) return existingField;
    return mergeField(existingField, desiredField);
  });

  for (const desiredField of desired) {
    if (!existing.some((field) => field.name === desiredField.name)) {
      merged.push(desiredField);
    }
  }

  return merged;
}

function mergeField(existing: BigQueryField, desired: BigQueryField): BigQueryField {
  if (existing.type !== desired.type || existing.mode !== desired.mode) {
    return existing;
  }

  if (!existing.fields || !desired.fields) {
    return { ...existing };
  }

  return {
    ...existing,
    fields: mergeSchemas(existing.fields, desired.fields),
  };
}

function diffSchemaFields(existing: BigQueryField[], desired: BigQueryField[]): BigQueryField[] {
  const existingNames = new Set(existing.map((field) => field.name));
  return desired.filter((field) => !existingNames.has(field.name));
}

function schemasEqual(existing: BigQueryField[], merged: BigQueryField[]): boolean {
  return JSON.stringify(existing) === JSON.stringify(merged);
}

function isAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: number; message?: string };
  return candidate.code === 409 || /already exists/i.test(candidate.message || '');
}
