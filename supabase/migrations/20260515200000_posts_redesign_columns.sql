-- Posts redesign: add distribution/SEO/scheduling columns to blog_posts
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS include_in_newsletter boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rss_included boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS search_indexable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS canonical_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz DEFAULT NULL;
