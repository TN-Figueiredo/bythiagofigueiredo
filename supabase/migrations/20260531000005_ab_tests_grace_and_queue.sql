-- P3: Auto-apply grace period columns
ALTER TABLE ab_tests
  ADD COLUMN IF NOT EXISTS grace_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS winner_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS applied_by text CHECK (applied_by IN ('auto','manual')),
  ADD COLUMN IF NOT EXISTS apply_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_apply_error text,
  ADD COLUMN IF NOT EXISTS revert_expires_at timestamptz;

-- P3: Batch start queue column
ALTER TABLE ab_tests
  ADD COLUMN IF NOT EXISTS queue_start_after timestamptz;

-- Index for grace period processing (cron picks up expired grace periods)
CREATE INDEX IF NOT EXISTS idx_ab_tests_grace_pending
ON ab_tests (grace_expires_at)
WHERE grace_expires_at IS NOT NULL AND winner_applied_at IS NULL;

-- Index for queued tests ready to start
CREATE INDEX IF NOT EXISTS idx_ab_tests_queued
ON ab_tests (queue_start_after)
WHERE status = 'queued' AND queue_start_after IS NOT NULL;
