-- RLS policies for organizations, organization_members, sites.
-- organizations + sites are publicly readable (names + domains are not secrets).
-- organization_members is private (contains user_id which is PII linkage).

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.sites enable row level security;

drop policy if exists "orgs public read" on public.organizations;
create policy "orgs public read"
  on public.organizations for select to anon, authenticated using (true);

drop policy if exists "orgs staff write" on public.organizations;
create policy "orgs staff write"
  on public.organizations for all to authenticated
  using (public.is_org_staff(id)) with check (public.is_org_staff(id));

drop policy if exists "members self read" on public.organization_members;
create policy "members self read"
  on public.organization_members for select to authenticated
  using (user_id = auth.uid() or public.is_org_staff(org_id));

drop policy if exists "members admin write" on public.organization_members;
create policy "members admin write"
  on public.organization_members for all to authenticated
  using (public.org_role(org_id) in ('owner','admin'))
  with check (public.org_role(org_id) in ('owner','admin'));

drop policy if exists "sites public read" on public.sites;
create policy "sites public read"
  on public.sites for select to anon, authenticated using (true);

drop policy if exists "sites staff write" on public.sites;
create policy "sites staff write"
  on public.sites for all to authenticated
  using (public.can_admin_site(id)) with check (public.can_admin_site(id));
