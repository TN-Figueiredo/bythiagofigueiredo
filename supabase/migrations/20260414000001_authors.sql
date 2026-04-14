-- Shared updated_at trigger helper (used by all tables in this sprint)
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create table public.authors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null unique,
  name text not null,
  slug text not null unique,
  bio_md text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index authors_user_id_idx on public.authors (user_id);

create trigger authors_set_updated_at
before update on public.authors
for each row execute function public.tg_set_updated_at();
