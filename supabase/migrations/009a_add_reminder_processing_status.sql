-- ============================================================
-- 009a_add_reminder_processing_status.sql
-- Adds processing state for reminder queue workers.
-- Must run before migrations that reference reminders.status='processing'.
-- ============================================================

ALTER TYPE reminder_status ADD VALUE IF NOT EXISTS 'processing';
