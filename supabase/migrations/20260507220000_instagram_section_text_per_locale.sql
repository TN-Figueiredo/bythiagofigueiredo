-- Rename single section_title/section_subtitle to per-locale columns
-- and add the missing en columns.
--
-- IDEMPOTENCE FIX (2026-06-11): the earlier 20260507210000 migration already
-- creates section_title_pt/_en directly and DROPs the legacy section_title, so
-- on a FRESH database (CI / local reset) `section_title` never exists and the
-- unguarded RENAME below failed every `supabase db reset` since 2026-05-10
-- (prod was unaffected — its live state predated 210000 and this file is
-- already recorded as applied there). The RENAMEs are now guarded so the
-- migration is a no-op when the legacy columns are absent.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'instagram_accounts'
      AND column_name = 'section_title'
  ) THEN
    ALTER TABLE public.instagram_accounts
      RENAME COLUMN section_title TO section_title_pt;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'instagram_accounts'
      AND column_name = 'section_subtitle'
  ) THEN
    ALTER TABLE public.instagram_accounts
      RENAME COLUMN section_subtitle TO section_subtitle_pt;
  END IF;
END $$;

ALTER TABLE public.instagram_accounts
  ADD COLUMN IF NOT EXISTS section_title_pt text,
  ADD COLUMN IF NOT EXISTS section_subtitle_pt text,
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
