-- Canonical site_visible helper; CLAUDE.md § Database RLS helpers documents the GUC contract.
--
-- site_visible(p_site_id) — centralizes the three-branch visibility rule used
-- by site-scoped read policies. Returns true when:
--   1. p_site_id is null                         → global content, visible everywhere
--   2. app.site_id is unset or empty             → no site context (admin/cross-site tooling)
--   3. p_site_id = app.site_id::uuid             → row belongs to the requesting site
--
-- Fails CLOSED (returns false) if app.site_id holds a non-uuid value — a
-- misbehaving middleware must never crash reads; it just stops seeing site-scoped rows.
create or replace function public.site_visible(p_site_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  v_raw text := nullif(current_setting('app.site_id', true), '');
  v_ctx uuid;
begin
  if p_site_id is null then
    return true;
  end if;
  if v_raw is null then
    return true;
  end if;
  begin
    v_ctx := v_raw::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return p_site_id = v_ctx;
end
$$;

grant execute on function public.site_visible(uuid) to anon, authenticated, service_role;

-- Re-apply both policies using the helper.
drop policy if exists blog_posts_public_read_published on public.blog_posts;
create policy blog_posts_public_read_published on public.blog_posts
  for select
  using (
    status = 'published'
    and published_at is not null
    and published_at <= now()
    and public.site_visible(site_id)
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
      and public.site_visible(p.site_id)
  ));
