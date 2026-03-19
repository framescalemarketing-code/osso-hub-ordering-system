-- ============================================================
-- OSSO Hub Ordering System — Full Supabase Schema
-- HIPAA + CCPA compliant, RLS-enforced, audit-logged
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE employee_role AS ENUM ('admin', 'manager', 'sales', 'optician', 'readonly');
CREATE TYPE order_type AS ENUM ('regular', 'program');
CREATE TYPE order_status AS ENUM ('draft', 'pending_approval', 'approved', 'processing', 'lens_ordered', 'completed', 'cancelled');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE glasses_type AS ENUM ('safety_rx', 'safety_non_rx', 'non_safety_rx', 'non_safety_non_rx');
CREATE TYPE lens_vendor AS ENUM ('nassau', 'abb_optical', 'other');
CREATE TYPE reminder_type AS ENUM ('follow_up', 'order_update', 'approval_needed', 'invoice_due');
CREATE TYPE reminder_status AS ENUM ('pending', 'sent', 'cancelled');
CREATE TYPE consent_type AS ENUM ('hipaa', 'ccpa', 'marketing');

-- ============================================================
-- EMPLOYEES (authentication + roles)
-- ============================================================
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role employee_role NOT NULL DEFAULT 'sales',
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_auth ON employees(auth_user_id);
CREATE INDEX idx_employees_email ON employees(email);

-- ============================================================
-- PROGRAMS (companies/organizations with safety eyewear programs)
-- ============================================================
CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT NOT NULL,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    billing_address JSONB,
    shipping_address JSONB,
    approval_required BOOLEAN NOT NULL DEFAULT true,
    approver_emails TEXT[] DEFAULT '{}',
    invoice_terms TEXT DEFAULT 'Net 30',
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    date_of_birth DATE,
    address JSONB, -- {street, city, state, zip}
    employer TEXT,
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    -- HIPAA / CCPA
    hipaa_consent_signed BOOLEAN NOT NULL DEFAULT false,
    hipaa_consent_date TIMESTAMPTZ,
    ccpa_consent_signed BOOLEAN NOT NULL DEFAULT false,
    ccpa_consent_date TIMESTAMPTZ,
    marketing_consent BOOLEAN NOT NULL DEFAULT false,
    marketing_consent_date TIMESTAMPTZ,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_name ON customers(last_name, first_name);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_program ON customers(program_id);

-- ============================================================
-- CONSENT LOG (immutable audit trail for HIPAA/CCPA)
-- ============================================================
CREATE TABLE consent_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    consent_type consent_type NOT NULL,
    granted BOOLEAN NOT NULL,
    ip_address INET,
    user_agent TEXT,
    signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by UUID REFERENCES employees(id)
);

CREATE INDEX idx_consent_customer ON consent_log(customer_id);

-- ============================================================
-- PRESCRIPTIONS
-- ============================================================
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    -- Right eye
    od_sphere NUMERIC(6,2),
    od_cylinder NUMERIC(6,2),
    od_axis INTEGER,
    od_add NUMERIC(5,2),
    od_prism NUMERIC(5,2),
    od_prism_base TEXT,
    -- Left eye
    os_sphere NUMERIC(6,2),
    os_cylinder NUMERIC(6,2),
    os_axis INTEGER,
    os_add NUMERIC(5,2),
    os_prism NUMERIC(5,2),
    os_prism_base TEXT,
    -- PD
    pd_distance NUMERIC(5,1),
    pd_near NUMERIC(5,1),
    pd_right NUMERIC(5,1),
    pd_left NUMERIC(5,1),
    -- Meta
    prescriber_name TEXT,
    prescriber_npi TEXT,
    rx_date DATE,
    expiration_date DATE,
    pdf_storage_path TEXT, -- Supabase Storage path
    notes TEXT,
    is_current BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    uploaded_by UUID REFERENCES employees(id)
);

CREATE INDEX idx_rx_customer ON prescriptions(customer_id);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT NOT NULL UNIQUE,
    order_type order_type NOT NULL,
    status order_status NOT NULL DEFAULT 'draft',
    customer_id UUID NOT NULL REFERENCES customers(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    program_id UUID REFERENCES programs(id),
    prescription_id UUID REFERENCES prescriptions(id),
    -- Pricing
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    -- Shipping
    shipping_address JSONB,
    shipping_method TEXT,
    tracking_number TEXT,
    -- Integration references
    clickup_task_id TEXT,
    netsuite_id TEXT,
    quickbooks_id TEXT,
    bigquery_synced_at TIMESTAMPTZ,
    -- Invoice
    invoice_number TEXT,
    invoice_sent_at TIMESTAMPTZ,
    invoice_pdf_path TEXT,
    -- Notes
    internal_notes TEXT,
    customer_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_employee ON orders(employee_id);
CREATE INDEX idx_orders_program ON orders(program_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);

-- ============================================================
-- ORDER ITEMS (glasses line items)
-- ============================================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    glasses_type glasses_type NOT NULL,
    -- Frame
    frame_brand TEXT,
    frame_model TEXT,
    frame_color TEXT,
    frame_size TEXT,
    frame_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    -- Lens
    lens_type TEXT,
    lens_material TEXT,
    lens_coating TEXT[],
    lens_tint TEXT,
    lens_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    -- Lens ordering
    lens_vendor lens_vendor,
    lens_order_id TEXT,
    lens_order_status TEXT,
    lens_ordered_at TIMESTAMPTZ,
    -- Totals
    quantity INTEGER NOT NULL DEFAULT 1,
    line_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_items_order ON order_items(order_id);

-- ============================================================
-- APPROVALS (for program orders)
-- ============================================================
CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    approver_email TEXT NOT NULL,
    approver_name TEXT,
    status approval_status NOT NULL DEFAULT 'pending',
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    notes TEXT,
    requested_by UUID REFERENCES employees(id)
);

CREATE INDEX idx_approvals_order ON approvals(order_id);
CREATE INDEX idx_approvals_token ON approvals(token);

-- ============================================================
-- REMINDERS / FOLLOW-UPS
-- ============================================================
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id),
    reminder_type reminder_type NOT NULL,
    subject TEXT NOT NULL,
    body TEXT,
    due_at TIMESTAMPTZ NOT NULL,
    status reminder_status NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reminders_due ON reminders(due_at) WHERE status = 'pending';
CREATE INDEX idx_reminders_customer ON reminders(customer_id);

-- ============================================================
-- AUDIT LOG (immutable)
-- ============================================================
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES employees(id),
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_table ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_time ON audit_log(created_at);

-- ============================================================
-- INTEGRATION SYNC LOG
-- ============================================================
CREATE TABLE sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration TEXT NOT NULL, -- 'clickup', 'netsuite', 'quickbooks', 'mailchimp', 'bigquery', 'nassau', 'abb_optical'
    record_type TEXT NOT NULL, -- 'order', 'customer', 'invoice'
    record_id UUID NOT NULL,
    external_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
    request_payload JSONB,
    response_payload JSONB,
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_integration ON sync_log(integration, status);
CREATE INDEX idx_sync_record ON sync_log(record_type, record_id);

-- ============================================================
-- AUTO-UPDATE TIMESTAMPS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_employees_updated BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_programs_updated BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUDIT LOG TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log(table_name, record_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), current_setting('app.current_employee_id', true)::uuid);
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log(table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), current_setting('app.current_employee_id', true)::uuid);
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log(table_name, record_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), current_setting('app.current_employee_id', true)::uuid);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tr_audit_customers AFTER INSERT OR UPDATE OR DELETE ON customers FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER tr_audit_orders AFTER INSERT OR UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER tr_audit_order_items AFTER INSERT OR UPDATE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER tr_audit_prescriptions AFTER INSERT OR UPDATE OR DELETE ON prescriptions FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER tr_audit_approvals AFTER INSERT OR UPDATE OR DELETE ON approvals FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================================
-- ORDER NUMBER SEQUENCE
-- ============================================================
CREATE SEQUENCE order_number_seq START 10001;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := 'OSSO-' || LPAD(nextval('order_number_seq')::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_order_number BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Helper: get current employee role
CREATE OR REPLACE FUNCTION get_employee_role()
RETURNS employee_role AS $$
    SELECT role FROM employees WHERE auth_user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Employees: all authenticated can read, admin can write
CREATE POLICY "employees_select" ON employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "employees_insert" ON employees FOR INSERT TO authenticated WITH CHECK (get_employee_role() = 'admin');
CREATE POLICY "employees_update" ON employees FOR UPDATE TO authenticated USING (get_employee_role() IN ('admin', 'manager') OR auth_user_id = auth.uid());

-- Customers: authenticated employees can CRUD
CREATE POLICY "customers_select" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_insert" ON customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "customers_update" ON customers FOR UPDATE TO authenticated USING (true);

-- Prescriptions: authenticated employees
CREATE POLICY "rx_select" ON prescriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "rx_insert" ON prescriptions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rx_update" ON prescriptions FOR UPDATE TO authenticated USING (true);

-- Orders: authenticated employees
CREATE POLICY "orders_select" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders_insert" ON orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "orders_update" ON orders FOR UPDATE TO authenticated USING (true);

-- Order items
CREATE POLICY "items_select" ON order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "items_insert" ON order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "items_update" ON order_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "items_delete" ON order_items FOR DELETE TO authenticated USING (true);

-- Approvals
CREATE POLICY "approvals_select" ON approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "approvals_insert" ON approvals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "approvals_update" ON approvals FOR UPDATE TO authenticated USING (true);

-- Reminders
CREATE POLICY "reminders_all" ON reminders FOR ALL TO authenticated USING (true);

-- Programs
CREATE POLICY "programs_select" ON programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "programs_insert" ON programs FOR INSERT TO authenticated WITH CHECK (get_employee_role() IN ('admin', 'manager'));
CREATE POLICY "programs_update" ON programs FOR UPDATE TO authenticated USING (get_employee_role() IN ('admin', 'manager'));

-- Audit log: read-only for admin/manager, no deletes
CREATE POLICY "audit_select" ON audit_log FOR SELECT TO authenticated USING (get_employee_role() IN ('admin', 'manager'));

-- Consent log: read-only for admin/manager
CREATE POLICY "consent_select" ON consent_log FOR SELECT TO authenticated USING (get_employee_role() IN ('admin', 'manager'));
CREATE POLICY "consent_insert" ON consent_log FOR INSERT TO authenticated WITH CHECK (true);

-- Sync log: admin/manager
CREATE POLICY "sync_select" ON sync_log FOR SELECT TO authenticated USING (get_employee_role() IN ('admin', 'manager'));
CREATE POLICY "sync_insert" ON sync_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sync_update" ON sync_log FOR UPDATE TO authenticated USING (get_employee_role() IN ('admin', 'manager'));

-- ============================================================
-- STORAGE BUCKET for prescriptions
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('prescriptions', 'prescriptions', false);

CREATE POLICY "rx_upload" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'prescriptions');
CREATE POLICY "rx_read" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'prescriptions');
CREATE POLICY "rx_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'prescriptions' AND (SELECT get_employee_role()) IN ('admin', 'manager'));
