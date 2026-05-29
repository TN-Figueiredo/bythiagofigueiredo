-- Migration: social_queue_position
-- Adds queue_position column for manual queue reordering (Spec Section 3.1.5)

ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS queue_position INTEGER;

CREATE INDEX IF NOT EXISTS idx_social_posts_queue
  ON social_posts (site_id, queue_position)
  WHERE status IN ('scheduled', 'queued') AND queue_position IS NOT NULL;

COMMENT ON COLUMN social_posts.queue_position IS
  'Manual position within site queue. NULL = not in queue. Managed by reorderQueue() action.';
