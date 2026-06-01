-- Fix: add 'queued' to ab_tests status CHECK constraint
ALTER TABLE ab_tests DROP CONSTRAINT IF EXISTS ab_tests_status_check;
ALTER TABLE ab_tests ADD CONSTRAINT ab_tests_status_check
  CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived', 'queued'));

-- Fix: add new completed_reason values
ALTER TABLE ab_tests DROP CONSTRAINT IF EXISTS ab_tests_completed_reason_check;
ALTER TABLE ab_tests ADD CONSTRAINT ab_tests_completed_reason_check
  CHECK (completed_reason IN ('auto_resolve', 'manual_winner', 'manual_archive', 'max_duration', 'inconclusive', 'manual_no_apply', 'manual_apply'));
