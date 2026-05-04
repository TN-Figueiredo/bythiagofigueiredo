ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS view_count int NOT NULL DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS read_complete_count int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_blog_posts_view_count ON blog_posts(view_count DESC)
  WHERE status = 'published';
