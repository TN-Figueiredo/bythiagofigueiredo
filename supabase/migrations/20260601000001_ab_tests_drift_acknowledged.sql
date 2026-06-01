ALTER TABLE ab_tests
  ADD COLUMN IF NOT EXISTS drift_acknowledged_at timestamptz;
