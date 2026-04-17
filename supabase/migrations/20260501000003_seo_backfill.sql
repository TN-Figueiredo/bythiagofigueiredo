-- supabase/migrations/20260501000003_seo_backfill.sql
-- Sprint 5b: SEO hardening — backfill twitter handle + ensure supported_locales reflects prod reality.
-- Idempotent: each update has a guard preventing clobber/repeat.

-- 1. Backfill twitter handle for master site. Only sets when currently NULL — re-runs are no-op.
update public.sites
set twitter_handle = 'tnFigueiredo'
where slug = 'bythiagofigueiredo'
  and twitter_handle is null;

-- 2. Ensure supported_locales reflects the live ('pt-BR','en') set. Only fires when current
--    value is the schema default {pt-BR} — preserves manual edits, no-op once applied.
update public.sites
set supported_locales = array['pt-BR','en']
where slug = 'bythiagofigueiredo'
  and supported_locales = array['pt-BR'];
