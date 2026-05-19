-- RPC to refresh the fan_scores materialized view.
-- Called by refreshFanScores() server action (daily cron).
-- CONCURRENTLY requires the unique index idx_fan_scores_pk to exist.

CREATE OR REPLACE FUNCTION public.refresh_fan_scores()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.fan_scores;
$$;
