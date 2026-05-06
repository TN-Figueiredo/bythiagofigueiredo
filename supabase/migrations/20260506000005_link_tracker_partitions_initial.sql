-- ─── create_monthly_partitions ───
-- Creates RANGE partitions for link_clicks for each month
-- in the window [current month .. current month + p_months_ahead].
-- tracked_links is NOT partitioned (metadata table, low volume).
-- Idempotent: uses IF NOT EXISTS on partition creation.
CREATE OR REPLACE FUNCTION public.create_monthly_partitions(p_months_ahead int DEFAULT 3)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month      date;
  v_start      date;
  v_end        date;
  v_suffix     text;
  v_tbl        text;
BEGIN
  FOR i IN 0..p_months_ahead LOOP
    v_month  := date_trunc('month', now()) + (i || ' months')::interval;
    v_start  := v_month;
    v_end    := v_month + interval '1 month';
    v_suffix := to_char(v_month, 'YYYY_MM');

    -- link_clicks partition
    v_tbl := 'link_clicks_' || v_suffix;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = v_tbl AND n.nspname = 'public'
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.link_clicks
           FOR VALUES FROM (%L) TO (%L)',
        v_tbl, v_start, v_end
      );
    END IF;
  END LOOP;
END;
$$;

-- ─── Initial partitions ───
-- Create partitions for May, June, July 2026 so link_clicks is immediately
-- writable after this migration runs in prod (2026-05 window).

CREATE TABLE IF NOT EXISTS public.link_clicks_2026_05
  PARTITION OF public.link_clicks
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS public.link_clicks_2026_06
  PARTITION OF public.link_clicks
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS public.link_clicks_2026_07
  PARTITION OF public.link_clicks
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
