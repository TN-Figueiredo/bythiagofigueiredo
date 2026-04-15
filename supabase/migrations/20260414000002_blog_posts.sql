create type public.post_status as enum ('draft','scheduled','published','archived');

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid,
  author_id uuid not null references public.authors(id) on delete restrict,
  status public.post_status not null default 'draft',
  published_at timestamptz,
  scheduled_for timestamptz,
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index blog_posts_status_published_at_idx
  on public.blog_posts (status, published_at desc);
create index blog_posts_site_status_idx
  on public.blog_posts (site_id, status);
create index blog_posts_scheduled_idx
  on public.blog_posts (status, scheduled_for)
  where status = 'scheduled';

create trigger blog_posts_set_updated_at
before update on public.blog_posts
for each row execute function public.tg_set_updated_at();
