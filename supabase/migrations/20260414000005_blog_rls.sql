-- Enable RLS and define policies for blog_posts, blog_translations, authors.
-- Helpers live in public schema (see 20260414000004_rls_helpers.sql) — policies
-- reference public.is_staff() accordingly.

alter table public.authors            enable row level security;
alter table public.blog_posts         enable row level security;
alter table public.blog_translations  enable row level security;

-- authors
create policy authors_public_read on public.authors
  for select
  using (true);

create policy authors_staff_write on public.authors
  for all
  using (public.is_staff())
  with check (public.is_staff());

-- blog_posts
create policy blog_posts_public_read_published on public.blog_posts
  for select
  using (status = 'published' and published_at is not null and published_at <= now());

create policy blog_posts_staff_read_all on public.blog_posts
  for select
  using (public.is_staff());

create policy blog_posts_staff_write on public.blog_posts
  for all
  using (public.is_staff())
  with check (public.is_staff());

-- blog_translations (gate read by parent post visibility)
create policy blog_translations_public_read on public.blog_translations
  for select
  using (exists (
    select 1 from public.blog_posts p
    where p.id = blog_translations.post_id
      and p.status = 'published'
      and p.published_at is not null
      and p.published_at <= now()
  ));

create policy blog_translations_staff_read_all on public.blog_translations
  for select
  using (public.is_staff());

create policy blog_translations_staff_write on public.blog_translations
  for all
  using (public.is_staff())
  with check (public.is_staff());
