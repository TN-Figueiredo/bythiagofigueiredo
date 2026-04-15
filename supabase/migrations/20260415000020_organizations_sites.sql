-- Multi-ring (conglomerate) foundation: organizations own sites and members.
-- parent_org_id NULL = master ring (bythiagofigueiredo). Child rings cascade up
-- (master ring staff can administer child ring sites) — see can_admin_site() in
-- 20260415000021_ring_rls_helpers.sql.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  parent_org_id uuid references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_org_id is null or parent_org_id <> id)
);

create index on public.organizations (parent_org_id) where parent_org_id is not null;

create trigger tg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.tg_set_updated_at();

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','editor','author')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index on public.organization_members (user_id);

create trigger tg_organization_members_updated_at
  before update on public.organization_members
  for each row execute function public.tg_set_updated_at();

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  slug text not null,
  domains text[] not null default '{}',
  default_locale text not null default 'pt-BR',
  supported_locales text[] not null default '{pt-BR}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);

create index on public.sites (org_id);
create index on public.sites using gin (domains);

create trigger tg_sites_updated_at
  before update on public.sites
  for each row execute function public.tg_set_updated_at();
