-- RLS for campaigns + campaign_translations.
--
-- Public read is scoped by site via public.site_visible() (mirror of blog
-- policy from 20260414000008_rls_site_helper.sql). Staff (is_staff()) bypass
-- via OR across separate SELECT policies — same pattern as blog.
alter table campaigns enable row level security;
alter table campaign_translations enable row level security;

-- campaigns
create policy "campaigns public read published"
  on campaigns for select
  to anon, authenticated
  using (
    status = 'published'
    and published_at <= now()
    and public.site_visible(site_id)
  );

create policy "campaigns staff read all"
  on campaigns for select
  to authenticated
  using (public.is_staff());

create policy "campaigns staff write"
  on campaigns for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- campaign_translations mirror
create policy "campaign_translations public read published"
  on campaign_translations for select
  to anon, authenticated
  using (exists (
    select 1 from campaigns c
    where c.id = campaign_translations.campaign_id
      and c.status = 'published'
      and c.published_at <= now()
      and public.site_visible(c.site_id)
  ));

create policy "campaign_translations staff read all"
  on campaign_translations for select
  to authenticated
  using (public.is_staff());

create policy "campaign_translations staff write"
  on campaign_translations for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());
