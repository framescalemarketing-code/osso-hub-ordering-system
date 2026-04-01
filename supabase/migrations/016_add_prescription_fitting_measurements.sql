-- ============================================================
-- 016_add_prescription_fitting_measurements.sql
-- Add fitting measurements needed for ClickUp/lab handoff payloads.
-- Additive-only migration.
-- ============================================================

ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS oc_right_height NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS oc_left_height NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS seg_height NUMERIC(5,1);
