-- Weekly pick: pinned_until replaces is_featured for home page locale-specific picks
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS pinned_until timestamptz;

-- Only 1 pinned video per channel (= per locale, since UNIQUE(site_id, locale) on channels)
DROP INDEX IF EXISTS youtube_videos_pinned_per_channel;
CREATE UNIQUE INDEX youtube_videos_pinned_per_channel
  ON youtube_videos(channel_id) WHERE pinned_until > now();

DROP INDEX IF EXISTS idx_youtube_videos_pinned;
CREATE INDEX idx_youtube_videos_pinned
  ON youtube_videos(site_id, pinned_until DESC) WHERE pinned_until IS NOT NULL;
