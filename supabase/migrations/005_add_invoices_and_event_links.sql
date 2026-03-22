-- ============================================================
-- 005_add_invoices_and_event_links.sql
-- Additive invoice records + billing event linkage
-- Preserves existing orders.invoice_* fields
-- ============================================================

CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'sent', 'partially_paid', 'paid', 'void');

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT NOT NULL UNIQUE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    status invoice_status NOT NULL DEFAULT 'draft',
    service_period_start DATE,
    service_period_end DATE,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    balance_due NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    quickbooks_id TEXT,
    netsuite_id TEXT,
    sent_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    pdf_path TEXT,
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT invoices_anchor_chk
        CHECK (order_id IS NOT NULL OR program_id IS NOT NULL OR customer_id IS NOT NULL),
    CONSTRAINT invoices_service_period_chk
        CHECK (service_period_end IS NULL OR service_period_start IS NULL OR service_period_end >= service_period_start),
    CONSTRAINT invoices_due_date_chk
        CHECK (due_date IS NULL OR due_date >= invoice_date),
    CONSTRAINT invoices_amounts_chk
        CHECK (total >= 0 AND balance_due >= 0),
    CONSTRAINT invoices_currency_chk
        CHECK (char_length(currency) = 3 AND currency = upper(currency))
);

-- Optional 1:1 order invoice relationship while still allowing program-level invoices.
CREATE UNIQUE INDEX idx_invoices_order_unique
    ON invoices(order_id)
    WHERE order_id IS NOT NULL;

CREATE INDEX idx_invoices_status_due
    ON invoices(status, due_date);
CREATE INDEX idx_invoices_program
    ON invoices(program_id);
CREATE INDEX idx_invoices_customer
    ON invoices(customer_id);
CREATE INDEX idx_invoices_service_period
    ON invoices(service_period_start, service_period_end);

CREATE TABLE invoice_billing_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    billing_event_id UUID NOT NULL REFERENCES billing_events(id) ON DELETE RESTRICT,
    applied_amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT invoice_billing_events_amount_chk
        CHECK (applied_amount <> 0),
    CONSTRAINT invoice_billing_events_invoice_event_uniq
        UNIQUE (invoice_id, billing_event_id),
    -- MVP guardrail: one billing event can only be invoiced once.
    CONSTRAINT invoice_billing_events_event_unique_once
        UNIQUE (billing_event_id)
);

CREATE INDEX idx_invoice_billing_events_invoice
    ON invoice_billing_events(invoice_id);
CREATE INDEX idx_invoice_billing_events_event
    ON invoice_billing_events(billing_event_id);

CREATE TRIGGER tr_invoices_updated
    BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_audit_invoices
    AFTER INSERT OR UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select" ON invoices
    FOR SELECT TO authenticated USING (get_employee_role() IN ('admin', 'manager'));
CREATE POLICY "invoices_insert" ON invoices
    FOR INSERT TO authenticated WITH CHECK (get_employee_role() IN ('admin', 'manager'));
CREATE POLICY "invoices_update" ON invoices
    FOR UPDATE TO authenticated USING (get_employee_role() IN ('admin', 'manager'));

CREATE POLICY "invoice_billing_events_select" ON invoice_billing_events
    FOR SELECT TO authenticated USING (get_employee_role() IN ('admin', 'manager'));
CREATE POLICY "invoice_billing_events_insert" ON invoice_billing_events
    FOR INSERT TO authenticated WITH CHECK (get_employee_role() IN ('admin', 'manager'));
CREATE POLICY "invoice_billing_events_delete" ON invoice_billing_events
    FOR DELETE TO authenticated USING (get_employee_role() IN ('admin', 'manager'));
