-- ─── tracked_links indexes ───
-- Fast lookup by short code (redirect path — most critical)
CREATE INDEX IF NOT EXISTS idx_tracked_links_code_lookup
  ON tracked_links (site_id, code)
  WHERE deleted_at IS NULL;

-- Lookup by human-readable slug
CREATE INDEX IF NOT EXISTS idx_tracked_links_slug_lookup
  ON tracked_links (site_id, slug)
  WHERE slug IS NOT NULL AND deleted_at IS NULL;

-- Source attribution queries (newsletter edition, campaign, blog post)
CREATE INDEX IF NOT EXISTS idx_tracked_links_source
  ON tracked_links (site_id, source_type, source_id)
  WHERE source_id IS NOT NULL;

-- Active links feed (CMS dashboard)
CREATE INDEX IF NOT EXISTS idx_tracked_links_active
  ON tracked_links (site_id, created_at DESC)
  WHERE active = true AND deleted_at IS NULL;

-- Tag filtering (GIN for array containment)
CREATE INDEX IF NOT EXISTS idx_tracked_links_tags
  ON tracked_links USING GIN (tags)
  WHERE deleted_at IS NULL;

-- ─── link_clicks indexes ───
-- Per-link time-series (analytics charts)
CREATE INDEX IF NOT EXISTS idx_link_clicks_link_time
  ON link_clicks (link_id, clicked_at DESC);

-- Per-site time-series (aggregate dashboard)
CREATE INDEX IF NOT EXISTS idx_link_clicks_site_time
  ON link_clicks (site_id, clicked_at DESC);

-- Visitor deduplication (unique visitor check)
CREATE INDEX IF NOT EXISTS idx_link_clicks_visitor_dedup
  ON link_clicks (link_id, visitor_id, clicked_at)
  WHERE visitor_id IS NOT NULL;

-- Referrer domain breakdown
CREATE INDEX IF NOT EXISTS idx_link_clicks_referrer
  ON link_clicks (link_id, referrer_domain)
  WHERE referrer_domain IS NOT NULL;

-- Conversion funnel queries
CREATE INDEX IF NOT EXISTS idx_link_clicks_conversion
  ON link_clicks (link_id, converted_at)
  WHERE converted_at IS NOT NULL;

-- ─── link_daily_metrics indexes ───
-- Site-wide date range queries (dashboard date pickers)
CREATE INDEX IF NOT EXISTS idx_link_daily_metrics_site_date
  ON link_daily_metrics (site_id, date DESC);

-- Per-link date range queries (single-link analytics)
CREATE INDEX IF NOT EXISTS idx_link_daily_metrics_link_range
  ON link_daily_metrics (link_id, date DESC);

-- ─── link_annotations indexes ───
-- All annotations for a link ordered by time
CREATE INDEX IF NOT EXISTS idx_link_annotations_range
  ON link_annotations (link_id, annotated_at DESC);

-- ─── link_goals indexes ───
-- Pending goals (cron sweep to check if reached)
CREATE INDEX IF NOT EXISTS idx_link_goals_pending
  ON link_goals (link_id, deadline)
  WHERE reached_at IS NULL;

-- ─── link_alerts indexes ───
-- Active alerts (cron sweep)
CREATE INDEX IF NOT EXISTS idx_link_alerts_active
  ON link_alerts (link_id, created_at)
  WHERE active = true;
