ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS blog_posts_is_featured_idx
  ON blog_posts (site_id, is_featured)
  WHERE is_featured = true;
