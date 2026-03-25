-- ============================================================
-- 010_perf_indexes_and_job_queue.sql
-- Performance indexes, queue claim functions, and reminder locks.
-- ============================================================

-- ------------------------------------------------------------
-- Program enrichment for company-profile UX and warehouse sync.
-- ------------------------------------------------------------
ALTER TABLE programs
    ADD COLUMN IF NOT EXISTS program_type TEXT,
    ADD COLUMN IF NOT EXISTS employee_count INTEGER,
    ADD COLUMN IF NOT EXISTS location_address JSONB,
    ADD COLUMN IF NOT EXISTS restricted_guidelines TEXT,
    ADD COLUMN IF NOT EXISTS loyalty_credit_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS referral_credit_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_programs_company_name
    ON programs(company_name);
CREATE INDEX IF NOT EXISTS idx_programs_is_active_company_name
    ON programs(is_active, company_name);
CREATE INDEX IF NOT EXISTS idx_programs_program_type
    ON programs(program_type);
CREATE INDEX IF NOT EXISTS idx_programs_employee_count
    ON programs(employee_count);

-- ------------------------------------------------------------
-- Order hot-path indexes.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
    ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_type_created_at
    ON orders(order_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_created_at
    ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_program_created_at
    ON orders(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc
    ON orders(created_at DESC);

-- ------------------------------------------------------------
-- Reminder queue hardening.
-- ------------------------------------------------------------
ALTER TABLE reminders
    ADD COLUMN IF NOT EXISTS processing_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processing_by TEXT,
    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_error TEXT;

DROP INDEX IF EXISTS idx_reminders_due;

CREATE INDEX IF NOT EXISTS idx_reminders_pending_due_created_at
    ON reminders(due_at, created_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reminders_processing_at
    ON reminders(processing_at)
    WHERE status = 'processing';

-- ------------------------------------------------------------
-- Integration job queue claim path.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_integration_jobs_pending_next_run_created_at
    ON integration_jobs(next_run_at, created_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_integration_jobs_processing_locked_at
    ON integration_jobs(locked_at)
    WHERE status = 'processing' AND locked_at IS NOT NULL;

CREATE OR REPLACE FUNCTION claim_integration_jobs(
    p_worker_id TEXT,
    p_limit INTEGER DEFAULT 25,
    p_stale_after_minutes INTEGER DEFAULT 15
)
RETURNS TABLE (
    id UUID,
    order_id UUID,
    integration TEXT,
    attempts INTEGER,
    max_attempts INTEGER,
    payload JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE integration_jobs
    SET status = 'pending',
        locked_at = NULL,
        locked_by = NULL,
        next_run_at = NOW()
    WHERE status = 'processing'
      AND locked_at IS NOT NULL
      AND locked_at < NOW() - (INTERVAL '1 minute' * p_stale_after_minutes);

    RETURN QUERY
    WITH candidate AS (
        SELECT ij.id
        FROM integration_jobs ij
        WHERE ij.status = 'pending'
          AND ij.next_run_at <= NOW()
        ORDER BY ij.next_run_at ASC, ij.created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    UPDATE integration_jobs ij
    SET status = 'processing',
        locked_at = NOW(),
        locked_by = p_worker_id
    FROM candidate
    WHERE ij.id = candidate.id
    RETURNING ij.id, ij.order_id, ij.integration, ij.attempts, ij.max_attempts, ij.payload;
END;
$$;

CREATE OR REPLACE FUNCTION claim_due_reminders(
    p_worker_id TEXT,
    p_limit INTEGER DEFAULT 50,
    p_stale_after_minutes INTEGER DEFAULT 30
)
RETURNS TABLE (
    id UUID,
    order_id UUID,
    customer_id UUID,
    employee_id UUID,
    reminder_type reminder_type,
    subject TEXT,
    body TEXT,
    due_at TIMESTAMPTZ,
    attempts INTEGER,
    customer_first_name TEXT,
    customer_last_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    order_number TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE reminders
    SET status = 'pending',
        processing_at = NULL,
        processing_by = NULL
    WHERE status = 'processing'
      AND processing_at IS NOT NULL
      AND processing_at < NOW() - (INTERVAL '1 minute' * p_stale_after_minutes);

    RETURN QUERY
    WITH candidate AS (
        SELECT r.id
        FROM reminders r
        WHERE r.status = 'pending'
          AND r.due_at <= NOW()
        ORDER BY r.due_at ASC, r.created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    ),
    claimed AS (
        UPDATE reminders r
        SET status = 'processing',
            processing_at = NOW(),
            processing_by = p_worker_id,
            attempts = r.attempts + 1,
            last_error = NULL
        FROM candidate
        WHERE r.id = candidate.id
        RETURNING r.*
    )
    SELECT
        claimed.id,
        claimed.order_id,
        claimed.customer_id,
        claimed.employee_id,
        claimed.reminder_type,
        claimed.subject,
        claimed.body,
        claimed.due_at,
        claimed.attempts,
        c.first_name AS customer_first_name,
        c.last_name AS customer_last_name,
        c.email AS customer_email,
        c.phone AS customer_phone,
        o.order_number
    FROM claimed
    LEFT JOIN customers c ON c.id = claimed.customer_id
    LEFT JOIN orders o ON o.id = claimed.order_id;
END;
$$;
