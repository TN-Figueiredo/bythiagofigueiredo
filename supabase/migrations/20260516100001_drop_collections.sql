-- =============================================================================
-- MIGRATION: Drop collection tables (never used in production — zero rows)
-- =============================================================================

-- Junction table first (has FK to content_collections)
DROP TABLE IF EXISTS public.content_pipeline_memberships CASCADE;
DROP TABLE IF EXISTS public.content_collections CASCADE;
