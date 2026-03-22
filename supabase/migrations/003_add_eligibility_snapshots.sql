-- ============================================================
-- 003_add_eligibility_snapshots.sql
-- Additive eligibility import + snapshot model for program orders
-- ============================================================

CREATE TYPE eligibility_import_status AS ENUM ('received', 'validated', 'applied', 'failed');
CREATE TYPE eligibility_snapshot_status AS ENUM ('draft', 'active', 'superseded', 'archived');

-- Tracks each eligibility file import attempt for auditability.
CREATE TABLE eligibility_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    import_month DATE NOT NULL,
    source_filename TEXT,
    source_checksum TEXT,
    row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
    valid_row_count INTEGER NOT NULL DEFAULT 0 CHECK (valid_row_count >= 0),
    invalid_row_count INTEGER NOT NULL DEFAULT 0 CHECK (invalid_row_count >= 0),
    status eligibility_import_status NOT NULL DEFAULT 'received',
    error_summary TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT eligibility_imports_month_start_chk
        CHECK (import_month = date_trunc('month', import_month)::date),
    CONSTRAINT eligibility_imports_counts_chk
        CHECK (valid_row_count + invalid_row_count <= row_count)
);

CREATE INDEX idx_eligibility_imports_program_month
    ON eligibility_imports(program_id, import_month DESC);
CREATE INDEX idx_eligibility_imports_status
    ON eligibility_imports(status);

-- One immutable snapshot per program/month.
CREATE TABLE eligibility_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    import_id UUID REFERENCES eligibility_imports(id) ON DELETE SET NULL,
    snapshot_month DATE NOT NULL,
    status eligibility_snapshot_status NOT NULL DEFAULT 'draft',
    effective_from DATE NOT NULL,
    effective_to DATE,
    eligible_count INTEGER NOT NULL DEFAULT 0 CHECK (eligible_count >= 0),
    notes TEXT,
    created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT eligibility_snapshots_month_start_chk
        CHECK (snapshot_month = date_trunc('month', snapshot_month)::date),
    CONSTRAINT eligibility_snapshots_effective_range_chk
        CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT eligibility_snapshots_program_month_uniq
        UNIQUE (program_id, snapshot_month)
);

CREATE INDEX idx_eligibility_snapshots_program_status
    ON eligibility_snapshots(program_id, status);
CREATE INDEX idx_eligibility_snapshots_effective
    ON eligibility_snapshots(effective_from, effective_to);

-- Membership rows inside each snapshot.
CREATE TABLE eligibility_snapshot_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_id UUID NOT NULL REFERENCES eligibility_snapshots(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    employee_external_id TEXT,
    employee_first_name TEXT NOT NULL,
    employee_last_name TEXT NOT NULL,
    employee_email TEXT,
    employee_identifier_hash TEXT,
    cost_center_code TEXT,
    coverage_tier TEXT,
    is_eligible BOOLEAN NOT NULL DEFAULT true,
    ineligibility_reason TEXT,
    effective_from DATE,
    effective_to DATE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT eligibility_snapshot_entries_identity_chk
        CHECK (customer_id IS NOT NULL OR employee_external_id IS NOT NULL),
    CONSTRAINT eligibility_snapshot_entries_effective_range_chk
        CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_eligibility_entries_snapshot
    ON eligibility_snapshot_entries(snapshot_id);
CREATE INDEX idx_eligibility_entries_customer
    ON eligibility_snapshot_entries(customer_id);
CREATE INDEX idx_eligibility_entries_snapshot_eligible
    ON eligibility_snapshot_entries(snapshot_id, is_eligible);
CREATE UNIQUE INDEX idx_eligibility_entries_snapshot_external_uniq
    ON eligibility_snapshot_entries(snapshot_id, employee_external_id)
    WHERE employee_external_id IS NOT NULL;

-- Link program orders to the exact eligibility member row used at order time.
ALTER TABLE orders
    ADD COLUMN eligibility_snapshot_entry_id UUID REFERENCES eligibility_snapshot_entries(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_eligibility_snapshot_entry
    ON orders(eligibility_snapshot_entry_id);

-- Updated-at triggers
CREATE TRIGGER tr_eligibility_imports_updated
    BEFORE UPDATE ON eligibility_imports FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_eligibility_snapshots_updated
    BEFORE UPDATE ON eligibility_snapshots FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Audit triggers on mutable business headers.
CREATE TRIGGER tr_audit_eligibility_imports
    AFTER INSERT OR UPDATE OR DELETE ON eligibility_imports FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER tr_audit_eligibility_snapshots
    AFTER INSERT OR UPDATE OR DELETE ON eligibility_snapshots FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- RLS
ALTER TABLE eligibility_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligibility_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligibility_snapshot_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eligibility_imports_select" ON eligibility_imports
    FOR SELECT TO authenticated USING (get_employee_role() IN ('admin', 'manager'));
CREATE POLICY "eligibility_imports_insert" ON eligibility_imports
    FOR INSERT TO authenticated WITH CHECK (get_employee_role() IN ('admin', 'manager'));
CREATE POLICY "eligibility_imports_update" ON eligibility_imports
    FOR UPDATE TO authenticated USING (get_employee_role() IN ('admin', 'manager'));

CREATE POLICY "eligibility_snapshots_select" ON eligibility_snapshots
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "eligibility_snapshots_insert" ON eligibility_snapshots
    FOR INSERT TO authenticated WITH CHECK (get_employee_role() IN ('admin', 'manager'));
CREATE POLICY "eligibility_snapshots_update" ON eligibility_snapshots
    FOR UPDATE TO authenticated USING (get_employee_role() IN ('admin', 'manager'));

CREATE POLICY "eligibility_entries_select" ON eligibility_snapshot_entries
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "eligibility_entries_insert" ON eligibility_snapshot_entries
    FOR INSERT TO authenticated WITH CHECK (get_employee_role() IN ('admin', 'manager'));
CREATE POLICY "eligibility_entries_update" ON eligibility_snapshot_entries
    FOR UPDATE TO authenticated USING (get_employee_role() IN ('admin', 'manager'));
