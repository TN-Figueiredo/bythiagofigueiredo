-- =============================================================================
-- MIGRATION: Add notes jsonb column to playlists table
-- =============================================================================

ALTER TABLE public.playlists ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT NULL;
