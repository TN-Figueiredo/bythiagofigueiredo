-- =============================================================================
-- MIGRATION: add_unique_tracked_links_source
-- =============================================================================

-- Add UNIQUE constraint on (site_id, source_type, source_id) to prevent duplicate
-- tracked links for the same source content.
-- The existing idx_tracked_links_source index covers the same columns but is non-unique.
-- We drop it and recreate as a UNIQUE index in one step.

-- Remove any duplicate tracked_links rows for the same (site_id, source_type, source_id)
-- keeping only the oldest row per combination. Required before UNIQUE constraint can be applied.
DELETE FROM tracked_links
WHERE source_id IS NOT NULL
  AND id NOT IN (
    SELECT DISTINCT ON (site_id, source_type, source_id) id
    FROM tracked_links
    WHERE source_id IS NOT NULL
    ORDER BY site_id, source_type, source_id, created_at ASC
  );

DROP INDEX IF EXISTS idx_tracked_links_source;

CREATE UNIQUE INDEX idx_tracked_links_source
  ON public.tracked_links (site_id, source_type, source_id)
  WHERE source_id IS NOT NULL;

