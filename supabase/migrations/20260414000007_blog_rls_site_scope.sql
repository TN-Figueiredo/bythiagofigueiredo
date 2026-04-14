-- Scope public read of blog_posts (and blog_translations, which joins through posts)
-- by an optional per-request site context GUC `app.site_id`.
--
-- Three-branch visibility rule (see CLAUDE.md § Database / RLS notes):
--   1. site_id IS NULL                         → global/cross-site content, always visible
--   2. app.site_id unset or empty              → no site filter (admin / cross-site tooling)
--   3. site_id = app.site_id (uuid)            → row belongs to the requesting site
--
-- The Next middleware sets `app.site_id` per-request via
--   select set_config('app.site_id', '<uuid>', true)
-- For tests and server middleware we expose a tiny RPC `public.set_app_site_id`
-- that wraps set_config with transaction-local=false so the setting persists
-- across PostgREST-pooled statements on the same connection.

drop policy if exists blog_posts_public_read_published on public.blog_posts;

create policy blog_posts_public_read_published on public.blog_posts
  for select
  using (
    status = 'published'
    and published_at is not null
    and published_at <= now()
    and (
      site_id is null
      or coalesce(nullif(current_setting('app.site_id', true), ''), '') = ''
      or site_id = nullif(current_setting('app.site_id', true), '')::uuid
    )
  );

drop policy if exists blog_translations_public_read on public.blog_translations;

create policy blog_translations_public_read on public.blog_translations
  for select
  using (exists (
    select 1 from public.blog_posts p
    where p.id = blog_translations.post_id
      and p.status = 'published'
      and p.published_at is not null
      and p.published_at <= now()
      and (
        p.site_id is null
        or coalesce(nullif(current_setting('app.site_id', true), ''), '') = ''
        or p.site_id = nullif(current_setting('app.site_id', true), '')::uuid
      )
  ));

-- Helper RPC: set the per-request site context.
-- Intended for the Next middleware and for RLS test harnesses.
-- Pass '' (empty string) to clear the setting.
create or replace function public.set_app_site_id(p_site_id text)
returns void
language plpgsql
volatile
as $$
begin
  perform set_config('app.site_id', coalesce(p_site_id, ''), false);
end;
$$;

grant execute on function public.set_app_site_id(text) to anon, authenticated, service_role;
