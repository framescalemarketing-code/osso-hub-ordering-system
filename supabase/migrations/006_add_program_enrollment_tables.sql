-- ============================================================
-- 006_add_program_enrollment_tables.sql
-- Canonical enrollment tracking for program employees:
-- CSV batch import headers, per-employee enrollment records,
-- and linkage from eligibility snapshot entries back to the
-- enrollment record they were derived from.
-- ============================================================
--
-- Design notes:
--
-- enrollment_imports  — separate from eligibility_imports (migration 003).
--   eligibility_imports drives billing snapshot generation.
--   enrollment_imports tracks the operational enrollment CSV workflow.
--   Keeping them separate allows the two workflows to evolve independently.
--
-- program_enrollments — canonical enrollment record.
--   One row per employee per program per coverage period.
--   The FK goes FROM this table TO customers(id), never the reverse.
--   Retail customer.program_id already links toward programs;
--   enrollment_id is set by admin after patient matching and is never required.
--
-- eligibility_snapshot_entries (altered, additive only) —
--   Gets a nullable enrollment_id FK so a billing-time snapshot entry
--   can be linked back to the canonical enrollment record it was derived from.
-- ============================================================

-- ============================================================
-- ENUM TYPES
-- ============================================================

-- Mirrors eligibility_import_status values but is kept as a distinct type
-- so the enrollment and billing import workflows can diverge independently.
CREATE TYPE enrollment_import_status AS ENUM ('received', 'validated', 'applied', 'failed');

-- Source of an individual enrollment record.
-- 'self_register' is reserved for a future self-service employee portal;
-- no table, flow, or RLS support is built for it in this migration.
CREATE TYPE enrollment_source AS ENUM ('csv', 'manual', 'self_register');

-- Lifecycle state of a single enrollment record.
CREATE TYPE enrollment_status AS ENUM ('active', 'terminated', 'suspended');

-- ============================================================
-- ENROLLMENT_IMPORTS
-- One row per CSV upload attempt per program.
-- Tracks who uploaded the file, when, what it contained, and whether
-- it was successfully applied to program_enrollments.
-- Idempotency guard: the same file (by SHA-256 checksum) cannot be
-- re-submitted to the same program, regardless of import_month.
-- ============================================================

CREATE TABLE enrollment_imports (
    id                   UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id           UUID                     NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    uploaded_by          UUID                     REFERENCES employees(id) ON DELETE SET NULL,
    -- First day of the month this enrollment batch covers (must be a month boundary).
    import_month         DATE                     NOT NULL,
    source_filename      TEXT,
    -- SHA-256 hex digest of the raw file bytes.  Required — used for idempotency check.
    source_checksum      TEXT                     NOT NULL,
    row_count            INTEGER                  NOT NULL DEFAULT 0,
    valid_row_count      INTEGER                  NOT NULL DEFAULT 0,
    invalid_row_count    INTEGER                  NOT NULL DEFAULT 0,
    status               enrollment_import_status NOT NULL DEFAULT 'received',
    error_summary        TEXT,
    metadata             JSONB                    NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ              NOT NULL DEFAULT NOW(),

    -- import_month must always be the first day of the month.
    CONSTRAINT enrollment_imports_month_start_chk
        CHECK (import_month = date_trunc('month', import_month)::date),

    -- Row count consistency: valid + invalid cannot exceed reported total.
    CONSTRAINT enrollment_imports_counts_nonneg_chk
        CHECK (row_count >= 0 AND valid_row_count >= 0 AND invalid_row_count >= 0),
    CONSTRAINT enrollment_imports_counts_sum_chk
        CHECK (valid_row_count + invalid_row_count <= row_count),

    -- Idempotency guard: identical file cannot be re-processed for the same program.
    -- Prevents double-application of the same CSV upload regardless of import_month.
    CONSTRAINT enrollment_imports_program_checksum_uniq
        UNIQUE (program_id, source_checksum)
);

CREATE INDEX idx_enrollment_imports_program_month
    ON enrollment_imports(program_id, import_month DESC);
CREATE INDEX idx_enrollment_imports_status
    ON enrollment_imports(status);
CREATE INDEX idx_enrollment_imports_uploaded_by
    ON enrollment_imports(uploaded_by)
    WHERE uploaded_by IS NOT NULL;

-- ============================================================
-- PROGRAM_ENROLLMENTS
-- Canonical enrollment record: one row per enrolled employee per
-- program per coverage period.
--
-- Enrollment source is auditable on every row (csv / manual / self_register).
-- CSV-sourced rows must reference the enrollment_import batch they came from.
-- Manual rows carry enrolled_by (the admin who entered the record).
--
-- The optional customer_id FK is set by an admin after matching an enrollment
-- record to an existing patient record.  It is NEVER required — retail
-- customer records must never be forced through enrollment tables.
-- ============================================================

CREATE TABLE program_enrollments (
    id                       UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id               UUID               NOT NULL REFERENCES programs(id) ON DELETE CASCADE,

    -- Source tracking -----------------------------------------------
    enrollment_source        enrollment_source  NOT NULL DEFAULT 'manual',
    -- Populated for csv-sourced rows; NULL for manual/self_register rows.
    enrollment_import_id     UUID               REFERENCES enrollment_imports(id) ON DELETE SET NULL,

    -- Employee identity (from CSV or entered manually by admin) ------
    employee_external_id     TEXT,              -- HR / payroll system employee ID
    employee_first_name      TEXT               NOT NULL,
    employee_last_name       TEXT               NOT NULL,
    employee_email           TEXT,
    -- Hex digest of canonical identity fields for soft deduplication
    -- without persisting PII in a searchable index.
    employee_identifier_hash TEXT,
    cost_center_code         TEXT,
    coverage_tier            TEXT,

    -- Enrollment lifecycle -------------------------------------------
    status                   enrollment_status  NOT NULL DEFAULT 'active',
    effective_from           DATE               NOT NULL,
    -- NULL while the enrollment is active; set when the employee is terminated.
    effective_to             DATE,
    termination_reason       TEXT,
    terminated_at            TIMESTAMPTZ,
    -- Employee who processed the termination action in the admin UI.
    terminated_by            UUID               REFERENCES employees(id) ON DELETE SET NULL,

    -- Optional link to an existing customer (patient) record.
    -- FK direction: enrollment → customer.
    -- Retail customers are never required to link into this table.
    customer_id              UUID               REFERENCES customers(id) ON DELETE SET NULL,

    -- Admin housekeeping ---------------------------------------------
    -- Employee who created this enrollment row (manual or CSV batch).
    enrolled_by              UUID               REFERENCES employees(id) ON DELETE SET NULL,
    notes                    TEXT,
    metadata                 JSONB              NOT NULL DEFAULT '{}'::jsonb,
    created_at               TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

    -- At least one non-hashed identity field must be populated.
    CONSTRAINT program_enrollments_identity_chk
        CHECK (
            employee_external_id IS NOT NULL
            OR employee_email     IS NOT NULL
        ),

    -- Effective date range must be internally consistent.
    CONSTRAINT program_enrollments_effective_range_chk
        CHECK (effective_to IS NULL OR effective_to >= effective_from),

    -- Terminated rows must carry an end date and a termination timestamp.
    CONSTRAINT program_enrollments_termination_state_chk
        CHECK (
            (status = 'terminated' AND effective_to IS NOT NULL AND terminated_at IS NOT NULL)
            OR status <> 'terminated'
        ),

    -- CSV-sourced rows must always reference the import batch they came from.
    CONSTRAINT program_enrollments_csv_import_ref_chk
        CHECK (enrollment_source <> 'csv' OR enrollment_import_id IS NOT NULL)
);

-- Navigational indexes
CREATE INDEX idx_program_enrollments_program
    ON program_enrollments(program_id);
CREATE INDEX idx_program_enrollments_program_status
    ON program_enrollments(program_id, status);
CREATE INDEX idx_program_enrollments_customer
    ON program_enrollments(customer_id)
    WHERE customer_id IS NOT NULL;
CREATE INDEX idx_program_enrollments_import
    ON program_enrollments(enrollment_import_id)
    WHERE enrollment_import_id IS NOT NULL;
CREATE INDEX idx_program_enrollments_effective
    ON program_enrollments(program_id, effective_from, effective_to);

-- Deduplication guards: prevent two active enrollment records for the same
-- employee identity within the same program.
-- Partial on status = 'active' so that terminated/suspended rows do not
-- block re-enrollment when an employee returns.
CREATE UNIQUE INDEX idx_program_enrollments_active_external_uniq
    ON program_enrollments(program_id, employee_external_id)
    WHERE employee_external_id IS NOT NULL AND status = 'active';

-- Case-insensitive email uniqueness via expression index.
CREATE UNIQUE INDEX idx_program_enrollments_active_email_uniq
    ON program_enrollments(program_id, lower(employee_email))
    WHERE employee_email IS NOT NULL AND status = 'active';

-- ============================================================
-- EXISTING TABLE ALTERATIONS (additive only — no columns dropped or changed)
-- ============================================================

-- Link each eligibility snapshot entry back to the canonical enrollment record
-- it was derived from.
-- Nullable because:
--   (a) existing snapshot entries predate this migration
--   (b) snapshot entries may be generated from eligibility_imports directly
--       without a corresponding program_enrollment record
--   (c) this linkage is filled in by the application when it populates snapshot
--       entries from enrollment records going forward
ALTER TABLE eligibility_snapshot_entries
    ADD COLUMN enrollment_id UUID REFERENCES program_enrollments(id) ON DELETE SET NULL;

CREATE INDEX idx_eligibility_entries_enrollment
    ON eligibility_snapshot_entries(enrollment_id)
    WHERE enrollment_id IS NOT NULL;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER tr_enrollment_imports_updated
    BEFORE UPDATE ON enrollment_imports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_program_enrollments_updated
    BEFORE UPDATE ON program_enrollments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Audit both mutable business-meaningful tables via the shared audit_trigger_func.
-- No new audit infrastructure is introduced; these reuse the existing pattern
-- established in migrations 001–005.
CREATE TRIGGER tr_audit_enrollment_imports
    AFTER INSERT OR UPDATE OR DELETE ON enrollment_imports
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER tr_audit_program_enrollments
    AFTER INSERT OR UPDATE OR DELETE ON program_enrollments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- eligibility_snapshot_entries already has no audit trigger (migration 003 established
-- that the parent eligibility_snapshots row covers auditability for the entries).
-- The additive enrollment_id column on that table does not change this decision.

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE enrollment_imports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_enrollments ENABLE ROW LEVEL SECURITY;

-- enrollment_imports: admin/manager can manage batch uploads.
-- Other roles do not need direct access to import batch records.
CREATE POLICY "enrollment_imports_select" ON enrollment_imports
    FOR SELECT TO authenticated
    USING (get_employee_role() IN ('admin', 'manager'));

CREATE POLICY "enrollment_imports_insert" ON enrollment_imports
    FOR INSERT TO authenticated
    WITH CHECK (get_employee_role() IN ('admin', 'manager'));

CREATE POLICY "enrollment_imports_update" ON enrollment_imports
    FOR UPDATE TO authenticated
    USING (get_employee_role() IN ('admin', 'manager'));

-- program_enrollments: all authenticated roles can read (sales and opticians
-- must be able to look up whether a patient is enrolled before placing an order).
-- Only admin and manager can write (create, update, terminate enrollments).
CREATE POLICY "program_enrollments_select" ON program_enrollments
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "program_enrollments_insert" ON program_enrollments
    FOR INSERT TO authenticated
    WITH CHECK (get_employee_role() IN ('admin', 'manager'));

CREATE POLICY "program_enrollments_update" ON program_enrollments
    FOR UPDATE TO authenticated
    USING (get_employee_role() IN ('admin', 'manager'));

-- ============================================================
-- EXPLICITLY DEFERRED — NOT IN THIS MIGRATION
-- ============================================================
--
-- 1. Self-service employee portal and self_register enrollment flow.
--    The enum value 'self_register' is present in enrollment_source but
--    no routes, UI, or RLS for employee-initiated registration are built here.
--
-- 2. PEPM calculation integration.
--    program_enrollments provides the eligible_count source data that a
--    PEPM billing event query will need, but the billing_event rows and
--    invoice generation for PEPM are out of scope for this migration.
--
-- 3. Visit entitlement tracking.
--    Coverage tiers are recorded in program_enrollments.coverage_tier
--    (text column) as a forward-compatibility field, but no visit
--    entitlement tables or overage logic are introduced here.
--
-- 4. Program-level enrollment rules (maximum coverage per period,
--    auto-termination rules, anniversary logic).
--    These belong in a future programs_config or program_versions table.
-- ============================================================
