-- supabase/migrations/20260417000000_seed_master_site.sql
-- Sprint 5b PR-A — Seed master ring organization + bythiagofigueiredo site row in production.
-- Idempotent: re-runs are no-ops thanks to ON CONFLICT clauses.
--
-- Context: production DB has been operating with empty `organizations` and `sites` tables;
-- the public homepage renders from hardcoded i18n JSON without DB. Sprint 5b SEO requires
-- middleware `getSiteByDomain('bythiagofigueiredo.com')` to resolve, which needs a site row.
-- This migration codifies the bootstrap so prod state matches the dev seed for org+site
-- (without copying users/posts — those land via /admin or future sprints).
--
-- Constraints respected:
-- - organizations_single_master partial unique index (added 20260420000001) → enforces
--   only ONE row with parent_org_id IS NULL. We insert exactly one master org.
-- - sites.primary_domain NOT NULL (since 20260420000064) → set explicitly.
-- - sites unique (org_id, slug) → ON CONFLICT DO NOTHING for idempotency.

do $$
declare
  v_org_id uuid;
  v_site_id uuid;
begin
  -- 1. Master ring organization (parent_org_id NULL, single per the constraint).
  insert into public.organizations (name, slug, parent_org_id)
  values ('Figueiredo Technology', 'figueiredo-tech', null)
  on conflict (slug) do update set name = excluded.name
  returning id into v_org_id;

  -- 2. Master site for bythiagofigueiredo.com.
  -- domains array includes both apex and www; primary_domain is the canonical apex (NOT NULL).
  -- supported_locales = {pt-BR, en} — Sprint 5b SEO emits hreflang for both.
  -- cms_enabled defaults true; primary_color/logo_url left null (set later via /admin).
  insert into public.sites (
    org_id, name, slug, domains, primary_domain,
    default_locale, supported_locales,
    contact_notification_email
  )
  values (
    v_org_id,
    'ByThiagoFigueiredo',
    'bythiagofigueiredo',
    array['bythiagofigueiredo.com', 'www.bythiagofigueiredo.com'],
    'bythiagofigueiredo.com',
    'pt-BR',
    array['pt-BR', 'en'],
    'thiago@bythiagofigueiredo.com'
  )
  on conflict (org_id, slug) do update set
    domains = excluded.domains,
    primary_domain = excluded.primary_domain,
    supported_locales = excluded.supported_locales,
    contact_notification_email = excluded.contact_notification_email
  returning id into v_site_id;

  raise notice 'Seeded master org % and site % (bythiagofigueiredo.com)', v_org_id, v_site_id;
end $$;
