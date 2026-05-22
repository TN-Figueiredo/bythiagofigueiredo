-- =============================================================================
-- MIGRATION: sync_pipeline_published_stages
-- =============================================================================
-- Sync pipeline item stages with their linked blog post status
-- for items published/scheduled before the unification

UPDATE content_pipeline cp
SET stage = bp.status
FROM blog_posts bp
WHERE cp.blog_post_id = bp.id
  AND bp.status IN ('published', 'scheduled')
  AND cp.stage NOT IN ('published', 'scheduled', 'archived');
