-- Rename single section_title/section_subtitle to per-locale columns
-- and add the missing en columns

ALTER TABLE public.instagram_accounts
  RENAME COLUMN section_title TO section_title_pt;

ALTER TABLE public.instagram_accounts
  RENAME COLUMN section_subtitle TO section_subtitle_pt;

ALTER TABLE public.instagram_accounts
  ADD COLUMN IF NOT EXISTS section_title_en text,
  ADD COLUMN IF NOT EXISTS section_subtitle_en text;

-- Recreate the view with per-locale columns
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
