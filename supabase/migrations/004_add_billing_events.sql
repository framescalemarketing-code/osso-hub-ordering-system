-- ============================================================
-- 004_add_billing_events.sql
-- Additive auditable billing event ledger
-- ============================================================

CREATE TYPE billing_event_type AS ENUM (
    'order_charge',
    'order_credit',
    'pepm_charge',
    'visit_overage_charge',
    'manual_adjustment',
    'write_off'
);

CREATE TYPE billing_event_status AS ENUM ('pending', 'posted', 'invoiced', 'void');

CREATE TABLE billing_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idempotency_scope TEXT NOT NULL DEFAULT 'billing_event',
    idempotency_key TEXT NOT NULL,
    event_type billing_event_type NOT NULL,
    status billing_event_status NOT NULL DEFAULT 'pending',
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    approval_id UUID REFERENCES approvals(id) ON DELETE SET NULL,
    eligibility_snapshot_id UUID REFERENCES eligibility_snapshots(id) ON DELETE SET NULL,
    event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    service_period_start DATE,
    service_period_end DATE,
    currency TEXT NOT NULL DEFAULT 'USD',
    amount NUMERIC(10,2) NOT NULL,
    description TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_system TEXT NOT NULL DEFAULT 'app',
    created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    voided_at TIMESTAMPTZ,
    void_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT billing_events_nonzero_amount_chk
        CHECK (amount <> 0),
    CONSTRAINT billing_events_anchor_chk
        CHECK (order_id IS NOT NULL OR program_id IS NOT NULL OR customer_id IS NOT NULL),
    CONSTRAINT billing_events_period_chk
        CHECK (service_period_end IS NULL OR service_period_start IS NULL OR service_period_end >= service_period_start),
    CONSTRAINT billing_events_currency_chk
        CHECK (char_length(currency) = 3 AND currency = upper(currency)),
    CONSTRAINT billing_events_void_state_chk
        CHECK (
            (status <> 'void' AND voided_at IS NULL)
            OR
            (status = 'void' AND voided_at IS NOT NULL)
        ),
    CONSTRAINT billing_events_idempotency_uniq
        UNIQUE (idempotency_scope, idempotency_key)
);

CREATE INDEX idx_billing_events_status_event_at
    ON billing_events(status, event_at DESC);
CREATE INDEX idx_billing_events_program_period
    ON billing_events(program_id, service_period_start, service_period_end);
CREATE INDEX idx_billing_events_order
    ON billing_events(order_id);
CREATE INDEX idx_billing_events_customer
    ON billing_events(customer_id);
CREATE INDEX idx_billing_events_approval
    ON billing_events(approval_id);
CREATE INDEX idx_billing_events_eligibility_snapshot
    ON billing_events(eligibility_snapshot_id);

CREATE TRIGGER tr_billing_events_updated
    BEFORE UPDATE ON billing_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_audit_billing_events
    AFTER INSERT OR UPDATE OR DELETE ON billing_events FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_events_select" ON billing_events
    FOR SELECT TO authenticated USING (get_employee_role() IN ('admin', 'manager'));
CREATE POLICY "billing_events_insert" ON billing_events
    FOR INSERT TO authenticated WITH CHECK (get_employee_role() IN ('admin', 'manager'));
CREATE POLICY "billing_events_update" ON billing_events
    FOR UPDATE TO authenticated USING (get_employee_role() IN ('admin', 'manager'));
