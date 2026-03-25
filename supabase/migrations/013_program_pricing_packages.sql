-- ============================================================
-- 013_program_pricing_packages.sql
-- Company/program package + pricing configuration fields.
-- Additive-only migration.
-- ============================================================

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS eu_package TEXT,
  ADD COLUMN IF NOT EXISTS eu_package_add_ons TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS eu_package_custom_adjustments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS service_tier TEXT,
  ADD COLUMN IF NOT EXISTS service_tier_custom_adjustments JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'programs_eu_package_check'
      AND conrelid = 'programs'::regclass
  ) THEN
    ALTER TABLE programs
      ADD CONSTRAINT programs_eu_package_check
      CHECK (
        eu_package IS NULL
        OR eu_package IN ('Compliance', 'Comfort', 'Complete', 'Covered')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'programs_service_tier_check'
      AND conrelid = 'programs'::regclass
  ) THEN
    ALTER TABLE programs
      ADD CONSTRAINT programs_service_tier_check
      CHECK (
        service_tier IS NULL
        OR service_tier IN ('Essential', 'Access', 'Premier', 'Enterprise')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_programs_eu_package
  ON programs (eu_package)
  WHERE eu_package IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_programs_service_tier
  ON programs (service_tier)
  WHERE service_tier IS NOT NULL;
