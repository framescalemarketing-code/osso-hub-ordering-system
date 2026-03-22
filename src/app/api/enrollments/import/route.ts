import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';

// This route must run in the Node.js runtime to use Node's crypto module.
// App Router default is Node — do NOT add `export const runtime = 'edge'`.

// ─── MVP CSV column spec ───────────────────────────────────────────────────
//
// Required columns (case-insensitive after normalisation):
//   first_name, last_name
//
// Identity columns (at least one must be present in the file header):
//   external_id   — HR/payroll system employee identifier
//   email         — employee email address
//
// Optional columns:
//   cost_center   — cost centre code
//   coverage_tier — coverage tier label (e.g. "tier1", "exec")
//   effective_from — YYYY-MM-DD; defaults to import_month when absent
//
// Example header row:
//   first_name,last_name,external_id,email,cost_center,coverage_tier,effective_from

const REQUIRED_HEADERS = ['first_name', 'last_name'] as const;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

// ─── Types used only within this module ───────────────────────────────────

interface ValidationError {
  line: number;
  error: string;
}

interface ValidEnrollmentRow {
  employee_first_name: string;
  employee_last_name: string;
  employee_external_id: string | null;
  employee_email: string | null;
  cost_center_code: string | null;
  coverage_tier: string | null;
  effective_from: string;
}

// ─── CSV parsing helpers ───────────────────────────────────────────────────

/**
 * RFC 4180-compliant CSV line splitter.
 * Handles quoted fields (including quoted commas and escaped double-quotes).
 */
function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped double-quote inside a quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(text: string): { headers: string[]; rawRows: string[][] } {
  // Strip BOM (Excel CSV exports), normalise line endings
  const normalised = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  const lines = normalised.split('\n');
  if (lines.length === 0) return { headers: [], rawRows: [] };

  const headers = splitCSVLine(lines[0]).map(h =>
    h.toLowerCase().replace(/^"|"$/g, '').trim()
  );

  const rawRows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed) rawRows.push(splitCSVLine(trimmed));
  }

  return { headers, rawRows };
}

// ─── Validation helpers ────────────────────────────────────────────────────

function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !isNaN(new Date(s).getTime());
}

function toFirstOfMonth(isoDate: string): string {
  return isoDate.slice(0, 7) + '-01';
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Authentication ────────────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: employee } = await supabase
    .from('employees')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single();

  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 403 });
  if (!['admin', 'manager'].includes(employee.role)) {
    return NextResponse.json({ error: 'admin or manager role required' }, { status: 403 });
  }

  // ── Parse multipart form ──────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Malformed multipart form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const programId = formData.get('program_id') as string | null;
  const importMonth = formData.get('import_month') as string | null;

  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });
  if (!programId) return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
  if (!importMonth) return NextResponse.json({ error: 'import_month is required' }, { status: 400 });

  // import_month must be the first day of a month
  if (!isValidISODate(importMonth) || importMonth !== toFirstOfMonth(importMonth)) {
    return NextResponse.json(
      { error: 'import_month must be a valid date in YYYY-MM-01 format' },
      { status: 400 }
    );
  }

  // ── File size guard ───────────────────────────────────────────────────────
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds the 5 MB limit' }, { status: 400 });
  }

  // ── Verify program ────────────────────────────────────────────────────────
  const { data: program } = await supabase
    .from('programs')
    .select('id, is_active')
    .eq('id', programId)
    .single();

  if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 });
  if (!program.is_active) {
    return NextResponse.json({ error: 'Program is not active' }, { status: 400 });
  }

  // ── Checksum and idempotency check ────────────────────────────────────────
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash('sha256').update(fileBuffer).digest('hex');

  const serviceClient = createServiceClient();

  const { data: existingImport } = await serviceClient
    .from('enrollment_imports')
    .select('id, status')
    .eq('program_id', programId)
    .eq('source_checksum', checksum)
    .maybeSingle();

  if (existingImport) {
    return NextResponse.json(
      {
        error: 'This exact file has already been imported for this program',
        existing_import_id: existingImport.id,
        existing_import_status: existingImport.status,
      },
      { status: 409 }
    );
  }

  // ── Create enrollment_imports header row ──────────────────────────────────
  // Status starts as 'received'. Updated to 'applied' or 'failed' after processing.
  const { data: importRecord, error: importInsertError } = await serviceClient
    .from('enrollment_imports')
    .insert({
      program_id: programId,
      uploaded_by: employee.id,
      import_month: importMonth,
      source_filename: file.name,
      source_checksum: checksum,
      row_count: 0,
      valid_row_count: 0,
      invalid_row_count: 0,
      status: 'received',
    })
    .select('id')
    .single();

  if (importInsertError || !importRecord) {
    return NextResponse.json(
      { error: 'Failed to create import record', detail: importInsertError?.message },
      { status: 500 }
    );
  }

  const importId: string = importRecord.id;

  // Helper: mark the import record as failed and return an error response.
  // Used for early exits after the import header row already exists.
  async function failImport(
    summary: string,
    responseBody: Record<string, unknown>,
    httpStatus: number
  ): Promise<NextResponse> {
    await serviceClient
      .from('enrollment_imports')
      .update({ status: 'failed', error_summary: summary })
      .eq('id', importId);
    return NextResponse.json(responseBody, { status: httpStatus });
  }

  // ── Parse CSV ─────────────────────────────────────────────────────────────
  const csvText = fileBuffer.toString('utf-8');
  const { headers, rawRows } = parseCSV(csvText);

  // Validate required column presence
  const missingRequired = REQUIRED_HEADERS.filter(h => !headers.includes(h));
  if (missingRequired.length > 0) {
    return failImport(
      `Missing required columns: ${missingRequired.join(', ')}`,
      {
        import_id: importId,
        error: 'CSV is missing required columns',
        missing_columns: missingRequired,
        required_columns: [...REQUIRED_HEADERS],
        optional_columns: ['external_id', 'email', 'cost_center', 'coverage_tier', 'effective_from'],
      },
      400
    );
  }

  // At least one identity column must be present in the file header
  const hasExternalId = headers.includes('external_id');
  const hasEmail = headers.includes('email');
  if (!hasExternalId && !hasEmail) {
    return failImport(
      'CSV header must include at least one identity column: external_id or email',
      {
        import_id: importId,
        error: 'CSV must include at least one of: external_id, email',
      },
      400
    );
  }

  // No data rows
  if (rawRows.length === 0) {
    return failImport(
      'CSV file contains no data rows',
      { import_id: importId, error: 'CSV file contains no data rows' },
      400
    );
  }

  // ── Validate rows ─────────────────────────────────────────────────────────
  const colIndex: Record<string, number> = {};
  headers.forEach((h, i) => { colIndex[h] = i; });

  // Extract and trim a field value; returns null for missing or blank values
  const getField = (fields: string[], col: string): string | null => {
    const idx = colIndex[col];
    if (idx === undefined) return null;
    const val = (fields[idx] ?? '').trim();
    return val === '' ? null : val;
  };

  const errors: ValidationError[] = [];
  const validRows: ValidEnrollmentRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const lineNumber = i + 2; // 1-based line number, accounting for header
    const fields = rawRows[i];

    const firstName = getField(fields, 'first_name');
    const lastName = getField(fields, 'last_name');
    const externalId = getField(fields, 'external_id');
    const email = getField(fields, 'email');
    const rawEffectiveFrom = getField(fields, 'effective_from');

    if (!firstName) {
      errors.push({ line: lineNumber, error: 'first_name is required' });
      continue;
    }
    if (!lastName) {
      errors.push({ line: lineNumber, error: 'last_name is required' });
      continue;
    }

    // Identity constraint: at least one anchor must be nonblank
    if (!externalId && !email) {
      errors.push({ line: lineNumber, error: 'external_id or email (or both) must be provided' });
      continue;
    }

    if (email && !isValidEmail(email)) {
      errors.push({ line: lineNumber, error: `Invalid email format: ${email}` });
      continue;
    }

    // effective_from defaults to import_month when the column is absent or blank
    const effectiveFrom = rawEffectiveFrom ?? importMonth;
    if (!isValidISODate(effectiveFrom)) {
      errors.push({
        line: lineNumber,
        error: `Invalid effective_from date "${effectiveFrom}" — expected YYYY-MM-DD`,
      });
      continue;
    }

    validRows.push({
      employee_first_name: firstName,
      employee_last_name: lastName,
      employee_external_id: externalId,
      employee_email: email ? email.toLowerCase() : null,
      cost_center_code: getField(fields, 'cost_center'),
      coverage_tier: getField(fields, 'coverage_tier'),
      effective_from: effectiveFrom,
    });
  }

  const rowCount = rawRows.length;
  const invalidCount = errors.length;
  const validCount = validRows.length;

  // All rows failed validation — nothing to insert
  if (validCount === 0) {
    await serviceClient
      .from('enrollment_imports')
      .update({
        status: 'failed',
        row_count: rowCount,
        valid_row_count: 0,
        invalid_row_count: invalidCount,
        error_summary: `All ${rowCount} row(s) failed validation`,
      })
      .eq('id', importId);

    return NextResponse.json(
      {
        import_id: importId,
        status: 'failed',
        row_count: rowCount,
        valid_row_count: 0,
        invalid_row_count: invalidCount,
        errors: errors.map(e => `Line ${e.line}: ${e.error}`),
      },
      { status: 422 }
    );
  }

  // ── Persist enrollment rows ───────────────────────────────────────────────
  // upsert with ignoreDuplicates generates ON CONFLICT DO NOTHING at the DB level,
  // which silently skips rows that would violate any unique constraint — including
  // the partial unique indexes on (program_id, employee_external_id) WHERE active
  // and (program_id, lower(employee_email)) WHERE active.
  // This means re-importing a file with returning employees is safe: existing active
  // rows are unaffected and the import still completes successfully.
  const enrollmentRows = validRows.map(row => ({
    program_id: programId,
    enrollment_source: 'csv' as const,
    enrollment_import_id: importId,
    employee_external_id: row.employee_external_id,
    employee_first_name: row.employee_first_name,
    employee_last_name: row.employee_last_name,
    employee_email: row.employee_email,
    cost_center_code: row.cost_center_code,
    coverage_tier: row.coverage_tier,
    status: 'active' as const,
    effective_from: row.effective_from,
    enrolled_by: employee.id,
  }));

  const { error: insertError } = await serviceClient
    .from('program_enrollments')
    .upsert(enrollmentRows, { ignoreDuplicates: true });

  if (insertError) {
    return failImport(
      `Enrollment row insert failed: ${insertError.message}`,
      {
        import_id: importId,
        status: 'failed',
        error: 'Failed to persist enrollment rows',
        detail: insertError.message,
      },
      500
    );
  }

  // ── Finalise import record ────────────────────────────────────────────────
  const errorSummary =
    errors.length > 0
      ? [
          `${errors.length} row(s) skipped due to validation errors`,
          ...errors.slice(0, 10).map(e => `Line ${e.line}: ${e.error}`),
          ...(errors.length > 10 ? [`...and ${errors.length - 10} more`] : []),
        ].join(' | ')
      : null;

  await serviceClient
    .from('enrollment_imports')
    .update({
      status: 'applied',
      row_count: rowCount,
      valid_row_count: validCount,
      invalid_row_count: invalidCount,
      error_summary: errorSummary,
    })
    .eq('id', importId);

  return NextResponse.json(
    {
      import_id: importId,
      status: 'applied',
      row_count: rowCount,
      valid_row_count: validCount,
      invalid_row_count: invalidCount,
      errors: errors.map(e => `Line ${e.line}: ${e.error}`),
    },
    { status: 201 }
  );
}
