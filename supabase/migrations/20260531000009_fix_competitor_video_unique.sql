-- Fix: video_id should be unique per channel, not globally
ALTER TABLE competitor_videos DROP CONSTRAINT IF EXISTS competitor_videos_video_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitor_videos_channel_video
ON competitor_videos (competitor_channel_id, video_id);
