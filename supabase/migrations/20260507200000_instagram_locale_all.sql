-- Allow instagram accounts to serve all locales with locale = 'all'
-- When locale = 'all', the account appears for every locale on the site.

ALTER TABLE public.instagram_accounts
  DROP CONSTRAINT instagram_accounts_locale_check;

ALTER TABLE public.instagram_accounts
  ADD CONSTRAINT instagram_accounts_locale_check
  CHECK (locale IN ('pt', 'en', 'all'));

-- Update the public view to match
CREATE OR REPLACE VIEW public.instagram_accounts_public AS
SELECT
  id, site_id, locale, handle, ig_user_id,
  sync_enabled, display_slots, layout_type,
  last_synced_at, token_expires_at,
  created_at, updated_at
FROM public.instagram_accounts;
