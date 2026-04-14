create table public.blog_translations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  locale text not null,
  title text not null,
  slug text not null,
  excerpt text,
  content_md text not null,
  cover_image_url text,
  meta_title text,
  meta_description text,
  og_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index blog_translations_post_locale_uniq
  on public.blog_translations (post_id, locale);

create index blog_translations_locale_slug_idx
  on public.blog_translations (locale, slug);

create trigger blog_translations_set_updated_at
before update on public.blog_translations
for each row execute function public.tg_set_updated_at();
