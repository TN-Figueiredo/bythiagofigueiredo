-- Materialized view for fan scoring (refreshed daily via cron)

DROP MATERIALIZED VIEW IF EXISTS public.fan_scores;

CREATE MATERIALIZED VIEW public.fan_scores AS
SELECT
  site_id,
  visitor_hash,
  COUNT(*) AS total_interactions,
  COUNT(DISTINCT platform) AS platform_count,
  COUNT(DISTINCT DATE(created_at)) AS active_days,
  MAX(created_at) AS last_seen,
  MIN(created_at) AS first_seen,
  (
    LEAST(COUNT(*), 50) / 50.0 * 25 +
    CASE WHEN MAX(created_at) > NOW() - INTERVAL '7 days'
      THEN 25 ELSE GREATEST(0, 25 - EXTRACT(DAY FROM NOW() - MAX(created_at))) END +
    LEAST(COUNT(DISTINCT platform), 4) / 4.0 * 25 +
    LEAST(COUNT(DISTINCT DATE(created_at)), 30) / 30.0 * 25
  ) AS score
FROM public.fan_interactions
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY site_id, visitor_hash;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fan_scores_pk
  ON public.fan_scores (site_id, visitor_hash);

CREATE INDEX IF NOT EXISTS idx_fan_scores_top
  ON public.fan_scores (site_id, score DESC);
