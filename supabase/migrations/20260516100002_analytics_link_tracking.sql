-- =============================================================================
-- MIGRATION: analytics_link_tracking
-- Add dest_url and link_type columns to content_events for tracking which
-- links users click inside content. Also adds source attribution to
-- newsletter_subscriptions.
-- =============================================================================

ALTER TABLE content_events ADD COLUMN IF NOT EXISTS dest_url TEXT;
ALTER TABLE content_events ADD COLUMN IF NOT EXISTS link_type TEXT;

-- Source attribution for newsletter subscriptions
ALTER TABLE newsletter_subscriptions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'unknown';

-- Partial index for fast link_click queries
CREATE INDEX IF NOT EXISTS idx_content_events_link_click
  ON content_events (site_id, created_at)
  WHERE event_type = 'link_click';
