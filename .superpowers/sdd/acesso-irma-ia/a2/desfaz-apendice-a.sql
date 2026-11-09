-- Fica de propósito (Phil M3): can_view_observatorio e is_member_editor NÃO são apagadas aqui. Sem policy que as use, só respondem sobre quem chama; não são resto esquecido.

-- funções (corpos de prod; md5 na seção 3, P1)
create or replace function public.can_view_site(p_site_id uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
  SELECT public.is_super_admin()
  OR EXISTS (SELECT 1 FROM sites s WHERE s.id = p_site_id AND public.is_org_admin(s.org_id))
  OR EXISTS (SELECT 1 FROM site_memberships WHERE site_id = p_site_id AND user_id = auth.uid());
$$;
create or replace function public.user_accessible_sites() returns table(site_id uuid, site_name text, site_slug text, primary_domain text, org_id uuid, org_name text, user_role text, is_master_ring boolean) language sql stable security definer set search_path to 'public' as $$
  SELECT s.id, s.name, s.slug, s.primary_domain, s.org_id, o.name,
    CASE
      WHEN public.is_super_admin() THEN 'super_admin'
      WHEN public.is_org_admin(s.org_id) THEN 'org_admin'
      ELSE (SELECT role FROM site_memberships WHERE site_id = s.id AND user_id = auth.uid())
    END AS user_role,
    (o.parent_org_id IS NULL) AS is_master_ring
  FROM sites s JOIN organizations o ON o.id = s.org_id
  WHERE public.can_view_site(s.id)
  ORDER BY (CASE WHEN o.parent_org_id IS NULL THEN 0 ELSE 1 END), o.name, s.name;
$$;

-- blog_posts (roles authenticated)
drop policy if exists blog_posts_delete on public.blog_posts;
create policy blog_posts_delete on public.blog_posts for delete to authenticated using (is_super_admin() OR is_org_admin((select sites.org_id from sites where sites.id = blog_posts.site_id)) OR (can_edit_site(site_id) AND (status <> 'published'::post_status)) OR ((owner_user_id = auth.uid()) AND (status = ANY (ARRAY['draft'::post_status, 'pending_review'::post_status]))));
drop policy if exists blog_posts_insert on public.blog_posts;
create policy blog_posts_insert on public.blog_posts for insert to authenticated with check (can_edit_site(site_id) OR ((owner_user_id = auth.uid()) AND (EXISTS (select 1 from site_memberships where site_memberships.site_id = blog_posts.site_id AND site_memberships.user_id = auth.uid() AND site_memberships.role = 'reporter'::text)) AND (status = ANY (ARRAY['draft'::post_status, 'pending_review'::post_status]))));
drop policy if exists blog_posts_select on public.blog_posts;
create policy blog_posts_select on public.blog_posts for select to authenticated using (can_edit_site(site_id) OR ((owner_user_id = auth.uid()) AND (EXISTS (select 1 from site_memberships where site_memberships.site_id = blog_posts.site_id AND site_memberships.user_id = auth.uid() AND site_memberships.role = 'reporter'::text))) OR ((status = 'published'::post_status) AND site_visible(site_id)));
drop policy if exists blog_posts_update on public.blog_posts;
create policy blog_posts_update on public.blog_posts for update to authenticated using (can_edit_site(site_id) OR ((owner_user_id = auth.uid()) AND (status = ANY (ARRAY['draft'::post_status, 'pending_review'::post_status])))) with check (can_edit_site(site_id) OR ((owner_user_id = auth.uid()) AND (status = ANY (ARRAY['draft'::post_status, 'pending_review'::post_status]))));

-- roles public
drop policy if exists competitor_agenda_runs_select on public.competitor_agenda_runs;
create policy competitor_agenda_runs_select on public.competitor_agenda_runs for select using (is_member_staff());
drop policy if exists staff_manage_types on public.newsletter_types;
create policy staff_manage_types on public.newsletter_types for all using (is_member_staff()) with check (is_member_staff());
drop policy if exists obs_db_size_daily_select on public.obs_db_size_daily;
create policy obs_db_size_daily_select on public.obs_db_size_daily for select using (is_member_staff());

-- storage.objects (roles authenticated)
drop policy if exists staff_delete_newsletter_assets on storage.objects;
create policy staff_delete_newsletter_assets on storage.objects for delete to authenticated using ((bucket_id = 'newsletter-assets'::text) AND is_member_staff());
drop policy if exists staff_upload_newsletter_assets on storage.objects;
create policy staff_upload_newsletter_assets on storage.objects for insert to authenticated with check ((bucket_id = 'newsletter-assets'::text) AND is_member_staff());
drop policy if exists staff_read_types on public.newsletter_types;
