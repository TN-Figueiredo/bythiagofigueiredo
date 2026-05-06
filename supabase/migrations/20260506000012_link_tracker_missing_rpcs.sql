-- ─── increment_link_clicks RPC ───
-- Called by click-recorder.ts to atomically bump counters on tracked_links.
CREATE OR REPLACE FUNCTION public.increment_link_clicks(p_link_id uuid, p_is_unique boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tracked_links
  SET
    total_clicks = total_clicks + 1,
    unique_visitors = CASE WHEN p_is_unique THEN unique_visitors + 1 ELSE unique_visitors END,
    last_clicked_at = now()
  WHERE id = p_link_id;
END;
$$;

-- ─── create_link_clicks_partition RPC ───
-- Called by links-partition-maintenance cron to create monthly partitions.
CREATE OR REPLACE FUNCTION public.create_link_clicks_partition(
  p_partition_name text,
  p_start_date text,
  p_end_date text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF link_clicks FOR VALUES FROM (%L) TO (%L)',
    p_partition_name,
    p_start_date,
    p_end_date
  );
  RETURN p_partition_name;
END;
$$;

-- ─── link_aggregation_watermark table ───
-- Singleton row tracking last-processed timestamp for the aggregate cron.
CREATE TABLE IF NOT EXISTS link_aggregation_watermark (
  id text PRIMARY KEY,
  last_processed_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO link_aggregation_watermark (id, last_processed_at)
VALUES ('singleton', '2000-01-01T00:00:00Z')
ON CONFLICT DO NOTHING;

-- ─── Fix anonymize_old_link_clicks ───
-- Override migration 20260506000004: stop nullifying visitor_id.
-- visitor_id is a daily-rotating SHA-256 hash (non-PII); nullifying it
-- breaks uniqueness analytics. Keep ip/user_agent/city/region anonymization.
CREATE OR REPLACE FUNCTION public.anonymize_old_link_clicks(p_older_than_days int DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anonymized int;
BEGIN
  UPDATE link_clicks
  SET
    ip          = NULL,
    user_agent  = NULL,
    city        = NULL,
    region      = NULL
  WHERE
    clicked_at < now() - (p_older_than_days || ' days')::interval
    AND ip IS NOT NULL;

  GET DIAGNOSTICS v_anonymized = ROW_COUNT;

  RETURN jsonb_build_object(
    'anonymized', v_anonymized,
    'older_than_days', p_older_than_days
  );
END;
$$;
