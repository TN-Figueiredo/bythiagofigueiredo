-- Add short locale-specific bio column to author_about_translations
-- Used in blog post author cards (not the full About page content)
alter table public.author_about_translations
  add column if not exists bio text;

comment on column public.author_about_translations.bio
  is 'Short locale-specific bio for author cards (1-2 sentences). Distinct from about_md which is the full About page.';
