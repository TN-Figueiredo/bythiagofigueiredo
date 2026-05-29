-- Migration: social_poll_manual_type
-- Extends social_posts type to include 'poll' (YT community polls) and 'manual'
-- (posts prepared for copy-paste, e.g. YT community without API).
-- Spec Section 6, Migration 2.

ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_type_check;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_type_check
  CHECK (type IN ('link', 'video', 'image', 'text', 'poll', 'manual'));

COMMENT ON COLUMN social_posts.type IS
  'Post type. poll = YT community poll, manual = copy-paste (no publish API).';
