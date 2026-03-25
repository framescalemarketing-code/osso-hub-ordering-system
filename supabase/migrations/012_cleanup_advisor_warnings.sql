-- ============================================================
-- 012_cleanup_advisor_warnings.sql
-- Cleanup for post-optimization advisor warnings.
-- ============================================================

-- Move pg_trgm out of public schema.
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Remove duplicate indexes introduced by overlapping migrations.
DROP INDEX IF EXISTS idx_orders_status_created_at_desc;
DROP INDEX IF EXISTS idx_orders_order_type_created_at_desc;

-- RLS initplan optimization: avoid re-evaluating auth.uid() per row.
DROP POLICY IF EXISTS "employees_update" ON public.employees;
CREATE POLICY "employees_update" ON public.employees
  FOR UPDATE TO authenticated
  USING (get_employee_role() IN ('admin', 'manager') OR auth_user_id = (select auth.uid()))
  WITH CHECK (get_employee_role() IN ('admin', 'manager') OR auth_user_id = (select auth.uid()));
