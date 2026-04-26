-- Align ad_media columns with the server action that writes to them.
-- Action inserts: public_url, file_name, storage_path, mime_type
-- Original schema had: url, filename (no storage_path, no mime_type)

-- 1. Rename url → public_url
DO $$ BEGIN
  ALTER TABLE public.ad_media RENAME COLUMN url TO public_url;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- 2. Rename filename → file_name
DO $$ BEGIN
  ALTER TABLE public.ad_media RENAME COLUMN filename TO file_name;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- 3. Add storage_path column (needed for delete operations — stores the path within the storage bucket)
ALTER TABLE public.ad_media ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- 4. Add mime_type column
ALTER TABLE public.ad_media ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- 5. Backfill storage_path from public_url for existing rows.
--    Public URLs follow the pattern: https://<host>/storage/v1/object/public/media/<path>
--    We extract everything after '/storage/v1/object/public/media/' as the storage_path.
UPDATE public.ad_media
SET storage_path = substring(public_url FROM '/storage/v1/object/public/media/(.+)$')
WHERE storage_path IS NULL
  AND public_url IS NOT NULL
  AND public_url LIKE '%/storage/v1/object/public/media/%';
