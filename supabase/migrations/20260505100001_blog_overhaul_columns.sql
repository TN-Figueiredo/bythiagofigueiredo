-- Blog overhaul: new columns for series linking + structured content

-- === blog_posts: series linking ===
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS previous_post_id uuid REFERENCES blog_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS continues_in_next boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS blog_posts_previous_post_idx ON blog_posts(previous_post_id)
  WHERE previous_post_id IS NOT NULL;

-- === blog_translations: Tiptap storage + structured metadata ===
ALTER TABLE blog_translations
  ADD COLUMN IF NOT EXISTS content_json jsonb,
  ADD COLUMN IF NOT EXISTS content_html text,
  ADD COLUMN IF NOT EXISTS colophon text,
  ADD COLUMN IF NOT EXISTS notes text[],
  ADD COLUMN IF NOT EXISTS pull_quote text,
  ADD COLUMN IF NOT EXISTS key_points text[];
