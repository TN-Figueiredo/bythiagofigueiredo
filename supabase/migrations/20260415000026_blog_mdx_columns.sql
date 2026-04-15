-- Rename plain markdown column to MDX-flavored name; plain markdown is valid MDX.
-- Add pre-compiled output + TOC + reading time columns.
-- content_compiled starts NULL — public pages fall back to runtime compile.

alter table public.blog_translations
  rename column content_md to content_mdx;

alter table public.blog_translations
  add column content_compiled text,
  add column content_toc jsonb not null default '[]',
  add column reading_time_min int not null default 0;

comment on column public.blog_translations.content_compiled is
  'Compiled JS module source from @mdx-js/mdx (NULL = needs compile; runtime fallback applies)';
