-- =============================================================================
-- Widen blog_posts.category to include 'ai' and 'control' (from design handoff)
-- =============================================================================

ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_category_check;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_category_check
  CHECK (category = ANY (ARRAY[
    'stories'::text, 'building'::text, 'money'::text, 'bts'::text,
    'ai'::text, 'control'::text
  ]));
