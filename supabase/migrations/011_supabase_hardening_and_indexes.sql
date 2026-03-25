-- ============================================================
-- 011_supabase_hardening_and_indexes.sql
-- Search/performance indexes for the live app access patterns.
-- Additive only: no tables, columns, or role policies are removed.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Fast customer search and list views.
CREATE INDEX IF NOT EXISTS idx_customers_created_at_desc
  ON customers (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_first_name_trgm
  ON customers USING gin (first_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_last_name_trgm
  ON customers USING gin (last_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_email_trgm
  ON customers USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm
  ON customers USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_program_created_at_desc
  ON customers (program_id, created_at DESC)
  WHERE program_id IS NOT NULL;

-- Program selector and lookup paths used during order intake.
CREATE INDEX IF NOT EXISTS idx_programs_company_name_trgm
  ON programs USING gin (company_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_programs_active_company_name
  ON programs (company_name)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_programs_created_at_desc
  ON programs (created_at DESC);

-- Orders dashboard and detail views.
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc
  ON orders (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_created_at_desc
  ON orders (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_order_type_created_at_desc
  ON orders (order_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_program_created_at_desc
  ON orders (program_id, created_at DESC)
  WHERE program_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_prescription_id
  ON orders (prescription_id)
  WHERE prescription_id IS NOT NULL;

-- Recency lookups for prescription history.
CREATE INDEX IF NOT EXISTS idx_prescriptions_customer_created_at_desc
  ON prescriptions (customer_id, created_at DESC);

-- Faster enrollment resolution lookups by identity and program.
CREATE INDEX IF NOT EXISTS idx_program_enrollments_customer_recent
  ON program_enrollments (customer_id, program_id, effective_from DESC, created_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_enrollments_email_recent
  ON program_enrollments (employee_email, program_id, effective_from DESC, created_at DESC)
  WHERE employee_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_enrollments_external_id_recent
  ON program_enrollments (employee_external_id, program_id, effective_from DESC, created_at DESC)
  WHERE employee_external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_enrollments_program_created_at_desc
  ON program_enrollments (program_id, created_at DESC);

-- Import and audit tables that are queried or sorted by recent activity.
CREATE INDEX IF NOT EXISTS idx_enrollment_imports_program_created_at_desc
  ON enrollment_imports (program_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_eligibility_imports_program_created_at_desc
  ON eligibility_imports (program_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_eligibility_snapshots_program_created_at_desc
  ON eligibility_snapshots (program_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_events_status_created_at_desc
  ON billing_events (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_status_created_at_desc
  ON invoices (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_log_created_at_desc
  ON sync_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approvals_order_status
  ON approvals (order_id, status);

CREATE INDEX IF NOT EXISTS idx_approvals_requested_by
  ON approvals (requested_by)
  WHERE requested_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by
  ON audit_log (changed_by)
  WHERE changed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_events_created_by
  ON billing_events (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consent_log_recorded_by
  ON consent_log (recorded_by)
  WHERE recorded_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eligibility_imports_uploaded_by
  ON eligibility_imports (uploaded_by)
  WHERE uploaded_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eligibility_snapshots_import_id
  ON eligibility_snapshots (import_id)
  WHERE import_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eligibility_snapshots_created_by
  ON eligibility_snapshots (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_created_by
  ON invoices (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id_created_at_desc
  ON order_items (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescriptions_uploaded_by
  ON prescriptions (uploaded_by)
  WHERE uploaded_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_enrollments_enrolled_by
  ON program_enrollments (enrolled_by)
  WHERE enrolled_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_enrollments_terminated_by
  ON program_enrollments (terminated_by)
  WHERE terminated_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reminders_order_id
  ON reminders (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reminders_employee_id
  ON reminders (employee_id)
  WHERE employee_id IS NOT NULL;

-- Helpful for active reminder processing at scale.
CREATE INDEX IF NOT EXISTS idx_reminders_pending_due_at
  ON reminders (due_at)
  WHERE status = 'pending';
