-- Prevent duplicate cycles for the same test on the same day (race condition guard)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ab_test_cycles_unique_daily
ON ab_test_cycles (test_id, (started_at::date))
WHERE ended_at IS NULL;
