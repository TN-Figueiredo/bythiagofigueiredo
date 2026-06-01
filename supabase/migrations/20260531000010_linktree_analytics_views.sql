-- View: aggregated device/browser/os/referrer breakdowns per site
CREATE OR REPLACE VIEW public.linktree_device_stats AS
SELECT
  site_id,
  device_type,
  browser,
  os,
  referrer_source,
  COUNT(*) AS event_count
FROM public.linktree_events
WHERE event_type = 'pageview'
GROUP BY site_id, device_type, browser, os, referrer_source;

-- View: daily geo aggregation for linktree analytics
CREATE OR REPLACE VIEW public.linktree_daily_geo AS
SELECT
  site_id,
  DATE(created_at AT TIME ZONE 'UTC') AS event_date,
  EXTRACT(DOW FROM created_at AT TIME ZONE 'UTC')::int AS weekday,
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour,
  country,
  city,
  device_type,
  COUNT(*) AS event_count
FROM public.linktree_events
WHERE event_type = 'pageview'
GROUP BY site_id, event_date, weekday, hour, country, city, device_type;
