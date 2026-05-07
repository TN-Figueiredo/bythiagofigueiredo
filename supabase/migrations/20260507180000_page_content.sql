create table if not exists public.page_content (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  page text not null,
  locale text not null,
  content jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint page_content_unique unique (site_id, page, locale)
);

alter table public.page_content enable row level security;

drop policy if exists "page_content_public_read" on public.page_content;
create policy "page_content_public_read" on public.page_content
  for select using (public.site_visible(site_id));

drop policy if exists "page_content_admin_write" on public.page_content;
create policy "page_content_admin_write" on public.page_content
  for all to authenticated using (public.is_org_admin(site_id))
  with check (public.is_org_admin(site_id));
