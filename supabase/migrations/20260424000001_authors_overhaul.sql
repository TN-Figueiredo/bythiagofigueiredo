-- Authors overhaul: add site_id, display_name, bio, social_links, avatar_color, sort_order, is_default
-- Supports the CMS authors management page (Group 2 of CMS overhaul).

-- 1. Add site_id (FK to sites) — required for multi-ring scoping
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE;

-- 2. Add display_name (presentation name, replaces 'name' for display purposes)
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS display_name text;

-- Backfill display_name from name where null
UPDATE public.authors SET display_name = name WHERE display_name IS NULL;

-- 3. Add bio (plain text bio, separate from bio_md which is markdown)
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS bio text;

-- Backfill bio from bio_md where null
UPDATE public.authors SET bio = bio_md WHERE bio IS NULL AND bio_md IS NOT NULL;

-- 4. Add new columns for CMS overhaul
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS avatar_color TEXT;
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- 5. Unique constraint: one slug per site
-- First, drop the old global unique constraint on slug if it exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'authors_slug_key')
  THEN ALTER TABLE public.authors DROP CONSTRAINT authors_slug_key;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'authors_site_slug_unique')
  THEN ALTER TABLE public.authors ADD CONSTRAINT authors_site_slug_unique UNIQUE (site_id, slug);
  END IF;
END $$;

-- 6. Unique partial index: only one default author per site
CREATE UNIQUE INDEX IF NOT EXISTS authors_one_default_per_site ON public.authors (site_id) WHERE is_default = true;
