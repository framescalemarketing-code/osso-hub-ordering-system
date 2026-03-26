-- ============================================================
-- 014_add_program_company_code.sql
-- Add company code to programs for faster lookup and display.
-- Additive-only migration.
-- ============================================================

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS company_code TEXT;

CREATE INDEX IF NOT EXISTS idx_programs_company_code
  ON programs (company_code)
  WHERE company_code IS NOT NULL;
