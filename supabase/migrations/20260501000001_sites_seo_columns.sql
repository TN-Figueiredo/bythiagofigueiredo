-- supabase/migrations/20260501000001_sites_seo_columns.sql
-- Sprint 5b: SEO hardening — add identity_type, twitter_handle, seo_default_og_image to sites.
-- Idempotent: safe to re-run.

-- 1. identity_type — JSON-LD root entity choice (Person vs Organization)
alter table public.sites
  add column if not exists identity_type text not null default 'person';

alter table public.sites
  drop constraint if exists sites_identity_type_chk;
alter table public.sites
  add constraint sites_identity_type_chk
  check (identity_type in ('person','organization'));

comment on column public.sites.identity_type is
  'Sprint 5b — JSON-LD root entity. person=hub site (bythiagofigueiredo), organization=brand site (future ring).';

-- 2. twitter_handle — Twitter Card meta (handle without @)
alter table public.sites
  add column if not exists twitter_handle text;

alter table public.sites
  drop constraint if exists sites_twitter_handle_chk;
alter table public.sites
  add constraint sites_twitter_handle_chk
  check (twitter_handle is null or twitter_handle ~ '^[A-Za-z0-9_]{1,15}$');

comment on column public.sites.twitter_handle is
  'Sprint 5b — Twitter/X handle without @, used in twitter:site card meta.';

-- 3. seo_default_og_image — site-wide static OG fallback (absolute https URL)
alter table public.sites
  add column if not exists seo_default_og_image text;

alter table public.sites
  drop constraint if exists sites_seo_default_og_image_chk;
alter table public.sites
  add constraint sites_seo_default_og_image_chk
  check (seo_default_og_image is null or seo_default_og_image ~ '^https://');

comment on column public.sites.seo_default_og_image is
  'Sprint 5b — Absolute HTTPS URL fallback OG image when dynamic OG disabled or render fails.';
