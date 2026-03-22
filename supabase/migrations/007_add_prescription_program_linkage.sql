-- ============================================================
-- 007_add_prescription_program_linkage.sql
-- Additive linkage from prescriptions to program enrollment context
-- ============================================================

ALTER TABLE prescriptions
    ADD COLUMN program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    ADD COLUMN program_enrollment_id UUID REFERENCES program_enrollments(id) ON DELETE SET NULL,
    ADD COLUMN enrollment_resolution_status TEXT
        CHECK (enrollment_resolution_status IN ('active', 'inactive', 'not_found', 'not_applicable')),
    ADD COLUMN enrollment_resolution_reason TEXT,
    ADD COLUMN upload_source TEXT NOT NULL DEFAULT 'order_intake';

CREATE INDEX idx_prescriptions_program_id
    ON prescriptions(program_id)
    WHERE program_id IS NOT NULL;

CREATE INDEX idx_prescriptions_program_enrollment_id
    ON prescriptions(program_enrollment_id)
    WHERE program_enrollment_id IS NOT NULL;

CREATE INDEX idx_prescriptions_customer_program_created
    ON prescriptions(customer_id, program_id, created_at DESC);
