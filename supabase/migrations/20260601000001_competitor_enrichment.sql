-- =============================================================================
-- MIGRATION: Phase 2a — Competitor enrichment + channel snapshots
-- =============================================================================

-- 1. competitor_videos: new columns for enriched data
ALTER TABLE competitor_videos
  ADD COLUMN IF NOT EXISTS like_count bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS is_short boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS category_id text,
  ADD COLUMN IF NOT EXISTS original_thumbnail_url text;

-- 2. Indexes for new query patterns
CREATE INDEX IF NOT EXISTS idx_competitor_videos_tags
  ON competitor_videos USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_competitor_videos_short
  ON competitor_videos (competitor_channel_id) WHERE is_short = true;

-- 3. Index for AB test detection query (2+ thumbnail changes in 14 days)
CREATE INDEX IF NOT EXISTS idx_competitor_changes_video_type
  ON competitor_changes (video_id, change_type, detected_at DESC);

-- 4. Filtered indexes for change feed
CREATE INDEX IF NOT EXISTS idx_competitor_changes_type_date
  ON competitor_changes (site_id, change_type, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_changes_bookmarked
  ON competitor_changes (site_id, detected_at DESC) WHERE bookmarked = true;

-- 5. Channel snapshots table (growth tracking)
CREATE TABLE IF NOT EXISTS competitor_channel_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_channel_id uuid NOT NULL REFERENCES competitor_channels(id) ON DELETE CASCADE,
  subscriber_count bigint,
  video_count integer,
  view_count bigint,
  snapshot_date date NOT NULL,
  UNIQUE(competitor_channel_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_comp_snapshots_channel_date
  ON competitor_channel_snapshots (competitor_channel_id, snapshot_date DESC);

-- 6. RLS for snapshots
ALTER TABLE competitor_channel_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "competitor_channel_snapshots_select" ON competitor_channel_snapshots;
CREATE POLICY "competitor_channel_snapshots_select"
  ON competitor_channel_snapshots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM competitor_channels cc
    WHERE cc.id = competitor_channel_id
      AND public.can_view_site(cc.site_id)
  ));
