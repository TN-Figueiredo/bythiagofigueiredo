-- Trigram index for admin title search (ilike '%term%').
create extension if not exists pg_trgm;

create index blog_translations_title_trgm
  on public.blog_translations
  using gin (title gin_trgm_ops);
