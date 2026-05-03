-- Backfill cadence_pattern from existing cadence_days
-- Converts integer interval to JSONB pattern format for backward compat
UPDATE newsletter_types
SET cadence_pattern = jsonb_build_object('type', 'every_n_days', 'interval', cadence_days)
WHERE cadence_days IS NOT NULL AND cadence_pattern IS NULL;
