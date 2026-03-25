-- ============================================================
-- 009_harden_rls_and_function_search_path.sql
-- Tighten permissive RLS write policies and lock function search_path.
-- ============================================================

-- 1) Lock function search_path for SECURITY warnings.
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.generate_order_number() SET search_path = public;
ALTER FUNCTION public.get_employee_role() SET search_path = public;

-- 2) Replace permissive write policies with role-gated checks.
-- Allowed operational writers: admin, manager, sales, optician.
-- readonly users keep read access only.

-- approvals
DROP POLICY IF EXISTS "approvals_insert" ON public.approvals;
DROP POLICY IF EXISTS "approvals_update" ON public.approvals;
CREATE POLICY "approvals_insert" ON public.approvals
  FOR INSERT TO authenticated
  WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));
CREATE POLICY "approvals_update" ON public.approvals
  FOR UPDATE TO authenticated
  USING (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'))
  WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));

-- consent_log
DROP POLICY IF EXISTS "consent_insert" ON public.consent_log;
CREATE POLICY "consent_insert" ON public.consent_log
  FOR INSERT TO authenticated
  WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));

-- customers
DROP POLICY IF EXISTS "customers_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_update" ON public.customers;
CREATE POLICY "customers_insert" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));
CREATE POLICY "customers_update" ON public.customers
  FOR UPDATE TO authenticated
  USING (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'))
  WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));

-- order_items
DROP POLICY IF EXISTS "items_insert" ON public.order_items;
DROP POLICY IF EXISTS "items_update" ON public.order_items;
DROP POLICY IF EXISTS "items_delete" ON public.order_items;
CREATE POLICY "items_insert" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));
CREATE POLICY "items_update" ON public.order_items
  FOR UPDATE TO authenticated
  USING (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'))
  WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));
CREATE POLICY "items_delete" ON public.order_items
  FOR DELETE TO authenticated
  USING (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));

-- orders
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;
CREATE POLICY "orders_insert" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));
CREATE POLICY "orders_update" ON public.orders
  FOR UPDATE TO authenticated
  USING (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'))
  WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));

-- prescriptions
DROP POLICY IF EXISTS "rx_insert" ON public.prescriptions;
DROP POLICY IF EXISTS "rx_update" ON public.prescriptions;
CREATE POLICY "rx_insert" ON public.prescriptions
  FOR INSERT TO authenticated
  WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));
CREATE POLICY "rx_update" ON public.prescriptions
  FOR UPDATE TO authenticated
  USING (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'))
  WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));

-- reminders
DROP POLICY IF EXISTS "reminders_all" ON public.reminders;
CREATE POLICY "reminders_select" ON public.reminders
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "reminders_insert" ON public.reminders
  FOR INSERT TO authenticated
  WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));
CREATE POLICY "reminders_update" ON public.reminders
  FOR UPDATE TO authenticated
  USING (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'))
  WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));
CREATE POLICY "reminders_delete" ON public.reminders
  FOR DELETE TO authenticated
  USING (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));

-- sync_log
DROP POLICY IF EXISTS "sync_insert" ON public.sync_log;
CREATE POLICY "sync_insert" ON public.sync_log
  FOR INSERT TO authenticated
  WITH CHECK (get_employee_role() IN ('admin', 'manager'));
