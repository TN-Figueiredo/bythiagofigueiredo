-- Full sync support: per-channel sync mode, concurrency guard, progress tracking
ALTER TABLE competitor_channels
  ADD COLUMN IF NOT EXISTS sync_mode text NOT NULL DEFAULT 'recent'
    CHECK (sync_mode IN ('recent', 'full')),
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'idle'
    CHECK (sync_status IN ('idle', 'syncing', 'error')),
  ADD COLUMN IF NOT EXISTS sync_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sync_error text,
  ADD COLUMN IF NOT EXISTS full_sync_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS youtube_video_count integer;

-- Covers ORDER BY published_at DESC in page.tsx channel video queries
CREATE INDEX IF NOT EXISTS idx_competitor_videos_channel_published
  ON competitor_videos (competitor_channel_id, published_at DESC);
