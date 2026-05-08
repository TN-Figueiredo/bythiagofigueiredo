-- Add configurable section title/subtitle per locale (4 columns for pt/en)
-- Also fix the stored handle that contains a full URL

ALTER TABLE public.instagram_accounts
  ADD COLUMN IF NOT EXISTS section_title_pt text,
  ADD COLUMN IF NOT EXISTS section_title_en text,
  ADD COLUMN IF NOT EXISTS section_subtitle_pt text,
  ADD COLUMN IF NOT EXISTS section_subtitle_en text;

-- Drop legacy columns if they exist (from previous failed migration attempt)
ALTER TABLE public.instagram_accounts
  DROP COLUMN IF EXISTS section_title,
  DROP COLUMN IF EXISTS section_subtitle;

-- Fix any handles stored as full URLs
UPDATE public.instagram_accounts
SET handle = regexp_replace(
  regexp_replace(handle, '^@', ''),
  '^https?://(?:www\.)?instagram\.com/([^/]+)/?$', '\1'
)
WHERE handle LIKE '%instagram.com%' OR handle LIKE '@%';

-- Drop and recreate the view (column set changed)
DROP VIEW IF EXISTS public.instagram_accounts_public;
CREATE VIEW public.instagram_accounts_public AS
SELECT
  id, site_id, locale, handle, ig_user_id,
  sync_enabled, display_slots, layout_type,
  section_title_pt, section_title_en,
  section_subtitle_pt, section_subtitle_en,
  last_synced_at, token_expires_at,
  created_at, updated_at
FROM public.instagram_accounts;
