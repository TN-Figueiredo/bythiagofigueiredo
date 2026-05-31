-- Prevent duplicate cycles for the same test on the same day (race condition guard)
-- timestamptz::date is not IMMUTABLE (depends on session TZ), so we use an explicit UTC cast
CREATE OR REPLACE FUNCTION public.utc_date(ts timestamptz)
RETURNS date
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT (ts AT TIME ZONE 'UTC')::date $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ab_test_cycles_unique_daily
ON ab_test_cycles (test_id, public.utc_date(started_at))
WHERE ended_at IS NULL;
