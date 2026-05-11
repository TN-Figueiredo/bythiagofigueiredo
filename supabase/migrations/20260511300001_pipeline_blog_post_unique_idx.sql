-- Enforce 1:1 between pipeline items and blog posts.
-- Also provides an index for O(1) reverse lookup (blog_post → pipeline item).
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_blog_post_id
  ON public.content_pipeline(blog_post_id)
  WHERE blog_post_id IS NOT NULL;
