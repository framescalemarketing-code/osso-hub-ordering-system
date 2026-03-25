-- ============================================================
-- 008_add_integration_jobs.sql
-- Durable integration job queue for order sync processing.
-- ============================================================

CREATE TYPE integration_job_status AS ENUM ('pending', 'processing', 'succeeded', 'failed');

CREATE TABLE integration_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    integration TEXT NOT NULL,
    status integration_job_status NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    external_id TEXT,
    last_error TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT integration_jobs_attempts_nonneg_chk CHECK (attempts >= 0),
    CONSTRAINT integration_jobs_max_attempts_chk CHECK (max_attempts > 0),
    CONSTRAINT integration_jobs_integration_chk CHECK (
        integration IN ('clickup', 'netsuite', 'quickbooks', 'bigquery', 'mailchimp')
    ),
    CONSTRAINT integration_jobs_order_integration_uniq UNIQUE (order_id, integration)
);

CREATE INDEX idx_integration_jobs_status_next_run
    ON integration_jobs(status, next_run_at);
CREATE INDEX idx_integration_jobs_order
    ON integration_jobs(order_id);
CREATE INDEX idx_integration_jobs_locked
    ON integration_jobs(locked_at)
    WHERE locked_at IS NOT NULL;

CREATE TRIGGER tr_integration_jobs_updated
    BEFORE UPDATE ON integration_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_audit_integration_jobs
    AFTER INSERT OR UPDATE OR DELETE ON integration_jobs
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

ALTER TABLE integration_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integration_jobs_select" ON integration_jobs
    FOR SELECT TO authenticated
    USING (get_employee_role() IN ('admin', 'manager'));

CREATE POLICY "integration_jobs_insert" ON integration_jobs
    FOR INSERT TO authenticated
    WITH CHECK (get_employee_role() IN ('admin', 'manager'));

CREATE POLICY "integration_jobs_update" ON integration_jobs
    FOR UPDATE TO authenticated
    USING (get_employee_role() IN ('admin', 'manager'));
