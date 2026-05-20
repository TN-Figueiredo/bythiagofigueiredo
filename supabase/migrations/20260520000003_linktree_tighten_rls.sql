-- =============================================================
-- Tighten linktree RLS policies
-- Fixes: overly permissive authenticated insert/write policies
-- =============================================================

-- 1. linktree_events: authenticated users can only insert for sites they can view
DROP POLICY IF EXISTS linktree_events_service_insert ON public.linktree_events;
CREATE POLICY linktree_events_service_insert ON public.linktree_events
  FOR INSERT TO authenticated WITH CHECK (public.site_visible(site_id));

-- 2. linktree_daily_metrics: remove overly permissive FOR ALL policy
-- Service role (used by cron) bypasses RLS. Authenticated users should only read.
-- No authenticated write policy needed — cron uses service role which bypasses RLS.
DROP POLICY IF EXISTS linktree_daily_metrics_service_write ON public.linktree_daily_metrics;
