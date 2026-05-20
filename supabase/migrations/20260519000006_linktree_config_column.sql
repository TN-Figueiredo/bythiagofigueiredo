-- =============================================================================
-- MIGRATION: Add linktree_config JSONB column to sites table
-- =============================================================================

ALTER TABLE sites ADD COLUMN IF NOT EXISTS linktree_config JSONB DEFAULT '{}';
COMMENT ON COLUMN sites.linktree_config IS 'Linktree page config: highlight, taglines, blog descriptions, shared links';
