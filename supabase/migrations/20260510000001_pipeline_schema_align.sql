-- Align content_collections and reference_content with API/UI expectations.
-- The original migration used title_pt/title_en but API schemas expect `name`.
-- Also adds `position` (used by API ordering) and `title` on reference_content.

BEGIN;

-- content_collections: add name + position
ALTER TABLE public.content_collections
  ADD COLUMN IF NOT EXISTS name     text,
  ADD COLUMN IF NOT EXISTS position int NOT NULL DEFAULT 0;

-- Backfill name from title_pt (or title_en as fallback)
UPDATE public.content_collections
SET name = COALESCE(title_pt, title_en, code)
WHERE name IS NULL;

-- content_pipeline: add archive metadata columns
ALTER TABLE public.content_pipeline
  ADD COLUMN IF NOT EXISTS archived_at    timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text;

-- reference_content: add title
ALTER TABLE public.reference_content
  ADD COLUMN IF NOT EXISTS title text;

-- Backfill title from content_compact->>'title' if present
UPDATE public.reference_content
SET title = content_compact->>'title'
WHERE title IS NULL AND content_compact->>'title' IS NOT NULL;

COMMIT;
