-- =============================================================================
-- Ensure each blog post is linked to at most ONE pipeline item.
-- Partial unique index allows multiple NULLs (unlinked items).
-- Makes getPipelineItemForPost's .maybeSingle() safe and prevents
-- linkPostToItem race conditions at the DB level.
-- =============================================================================

DROP INDEX IF EXISTS idx_pipeline_blog_post_id;

CREATE UNIQUE INDEX idx_pipeline_blog_post_id
  ON public.content_pipeline (blog_post_id)
  WHERE blog_post_id IS NOT NULL;
