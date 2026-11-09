-- MG19 · A2 · o login da irmã (reporter) vê só o Observatório
-- Idempotente. Sem drop de objeto, sem dado. Desfazer: .superpowers/sdd/acesso-irma-ia/a2/desfaz-apendice-a.sql
set lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.can_view_site_as(uuid,uuid)') is null
     or to_regprocedure('public.can_edit_site_as(uuid,uuid)') is null then
    raise exception 'MG19 depende da MG11 (can_view_site_as, can_edit_site_as)';
  end if;
end $$;

-- 1. O Observatório reaberto por nome: o corpo antigo de can_view_site (qualquer vínculo).
create or replace function public.can_view_observatorio(p_site_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_view_site_as(auth.uid(), p_site_id);
$$;
revoke all on function public.can_view_observatorio(uuid) from public, anon;
grant execute on function public.can_view_observatorio(uuid) to authenticated, service_role;

-- 2. Ver o CMS = editar. Quem "vê sem editar" é exatamente o reporter.
create or replace function public.can_view_site(p_site_id uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.can_edit_site(p_site_id);
$$;

-- 3. O seletor de site continua mostrando o site do reporter (ele só vê o Observatório).
create or replace function public.user_accessible_sites() returns table(site_id uuid, site_name text, site_slug text, primary_domain text, org_id uuid, org_name text, user_role text, is_master_ring boolean) language sql stable security definer set search_path to 'public' as $$
  SELECT s.id, s.name, s.slug, s.primary_domain, s.org_id, o.name,
    CASE
      WHEN public.is_super_admin() THEN 'super_admin'
      WHEN public.is_org_admin(s.org_id) THEN 'org_admin'
      ELSE (SELECT role FROM site_memberships WHERE site_id = s.id AND user_id = auth.uid())
    END AS user_role,
    (o.parent_org_id IS NULL) AS is_master_ring
  FROM sites s JOIN organizations o ON o.id = s.org_id
  WHERE public.can_view_observatorio(s.id)
  ORDER BY (CASE WHEN o.parent_org_id IS NULL THEN 0 ELSE 1 END), o.name, s.name;
$$;

-- 4. is_member_editor: como is_member_staff, sem o reporter.
create or replace function public.is_member_editor() returns boolean
language sql stable security definer set search_path to 'public' as $$
  SELECT public.is_super_admin()
  OR EXISTS (SELECT 1 FROM organization_members WHERE user_id = auth.uid() AND role = 'org_admin')
  OR EXISTS (SELECT 1 FROM site_memberships WHERE user_id = auth.uid() AND role = 'editor');
$$;
revoke all on function public.is_member_editor() from public, anon;
grant execute on function public.is_member_editor() to authenticated, service_role;

-- 5. Emenda C1: policies que o reporter atravessava sem passar por can_view_site.
-- blog_posts: sem o ramo do reporter e sem o ramo do dono.
drop policy if exists blog_posts_insert on public.blog_posts;
create policy blog_posts_insert on public.blog_posts for insert to authenticated
  with check (public.can_edit_site(site_id));
drop policy if exists blog_posts_select on public.blog_posts;
create policy blog_posts_select on public.blog_posts for select to authenticated
  using (public.can_edit_site(site_id) OR ((status = 'published'::post_status) AND public.site_visible(site_id)));
drop policy if exists blog_posts_update on public.blog_posts;
create policy blog_posts_update on public.blog_posts for update to authenticated
  using (public.can_edit_site(site_id)) with check (public.can_edit_site(site_id));
drop policy if exists blog_posts_delete on public.blog_posts;
create policy blog_posts_delete on public.blog_posts for delete to authenticated
  using (public.is_super_admin() OR public.is_org_admin((select sites.org_id from public.sites where sites.id = blog_posts.site_id)) OR (public.can_edit_site(site_id) AND (status <> 'published'::post_status)));

-- newsletter_types: leitura por can_view_site, escrita por can_edit_site.
drop policy if exists staff_manage_types on public.newsletter_types;
create policy staff_manage_types on public.newsletter_types for all
  using (public.can_edit_site(site_id)) with check (public.can_edit_site(site_id));
-- Marcador de intenção (Phil M1): hoje redundante com staff_manage_types (FOR ALL já cobre SELECT, e can_view_site = can_edit_site). Fica para que a
-- leitura não dependa da política de escrita no dia em que can_view_site voltar a divergir de can_edit_site.
drop policy if exists staff_read_types on public.newsletter_types;
create policy staff_read_types on public.newsletter_types for select
  using (public.can_view_site(site_id));

-- tabelas sem site_id: só editor. Roles authenticated (eram public): anon não executa is_member_editor, e avaliar a policy para anon daria erro de permissão em vez de 0 linhas.
drop policy if exists competitor_agenda_runs_select on public.competitor_agenda_runs;
create policy competitor_agenda_runs_select on public.competitor_agenda_runs for select to authenticated using (public.is_member_editor());
drop policy if exists obs_db_size_daily_select on public.obs_db_size_daily;
create policy obs_db_size_daily_select on public.obs_db_size_daily for select to authenticated using (public.is_member_editor());

-- storage.objects, bucket newsletter-assets.
drop policy if exists staff_delete_newsletter_assets on storage.objects;
create policy staff_delete_newsletter_assets on storage.objects for delete to authenticated
  using ((bucket_id = 'newsletter-assets'::text) AND public.is_member_editor());
drop policy if exists staff_upload_newsletter_assets on storage.objects;
create policy staff_upload_newsletter_assets on storage.objects for insert to authenticated
  with check ((bucket_id = 'newsletter-assets'::text) AND public.is_member_editor());

do $$
begin
  if has_function_privilege('anon', 'public.can_view_observatorio(uuid)', 'EXECUTE') then
    raise exception 'MG19: anon executa can_view_observatorio';
  end if;
  if has_function_privilege('anon', 'public.is_member_editor()', 'EXECUTE') then
    raise exception 'MG19: anon executa is_member_editor';
  end if;
end $$;
