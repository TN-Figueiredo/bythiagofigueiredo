-- =============================================================================
-- MIGRATION: Add version column to youtube_videos for optimistic locking
-- =============================================================================

ALTER TABLE youtube_videos
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
