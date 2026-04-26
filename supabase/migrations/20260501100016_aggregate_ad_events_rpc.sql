-- Migration: aggregate_ad_events_yesterday RPC
-- Called daily by /api/cron/ad-events-aggregate to roll up yesterday's
-- ad_events into ad_slot_metrics (impressions + clicks per campaign/slot/date).

CREATE OR REPLACE FUNCTION public.aggregate_ad_events_yesterday()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _yesterday date := (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1;
  _rows_upserted integer := 0;
BEGIN
  WITH agg AS (
    SELECT
      ad_id                                              AS campaign_id,
      slot_id                                            AS slot_key,
      _yesterday                                         AS date,
      COUNT(*) FILTER (WHERE event_type = 'impression')  AS imp,
      COUNT(*) FILTER (WHERE event_type = 'click')       AS clk
    FROM public.ad_events
    WHERE ad_id IS NOT NULL
      AND created_at >= _yesterday::timestamptz
      AND created_at <  (_yesterday + 1)::timestamptz
    GROUP BY ad_id, slot_id
  )
  INSERT INTO public.ad_slot_metrics (campaign_id, slot_key, date, impressions, clicks)
  SELECT campaign_id, slot_key, date, imp, clk
  FROM agg
  ON CONFLICT (campaign_id, slot_key, date)
  DO UPDATE SET
    impressions = ad_slot_metrics.impressions + EXCLUDED.impressions,
    clicks      = ad_slot_metrics.clicks      + EXCLUDED.clicks;

  GET DIAGNOSTICS _rows_upserted = ROW_COUNT;
  RETURN _rows_upserted;
END;
$$;

COMMENT ON FUNCTION public.aggregate_ad_events_yesterday() IS
  'Aggregate yesterday''s ad_events into ad_slot_metrics. Called by cron /api/cron/ad-events-aggregate. Returns number of rows upserted.';

-- Grant execute to service_role only (cron runs with service client)
REVOKE ALL ON FUNCTION public.aggregate_ad_events_yesterday() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aggregate_ad_events_yesterday() TO service_role;
