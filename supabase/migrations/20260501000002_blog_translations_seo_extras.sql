-- supabase/migrations/20260501000002_blog_translations_seo_extras.sql
-- Sprint 5b: SEO hardening — add seo_extras jsonb (FAQ/HowTo/Video + per-translation OG override).
-- Idempotent: safe to re-run.

alter table public.blog_translations
  add column if not exists seo_extras jsonb;

-- Structural CHECK only (defense-in-depth). Full validation in Zod (SeoExtrasSchema)
-- inside savePost server action — Sprint 5b PR-C.
alter table public.blog_translations
  drop constraint if exists blog_translations_seo_extras_shape_chk;

alter table public.blog_translations
  add constraint blog_translations_seo_extras_shape_chk
  check (
    seo_extras is null or (
      jsonb_typeof(seo_extras) = 'object'
      and (not (seo_extras ? 'faq')          or jsonb_typeof(seo_extras->'faq')          = 'array')
      and (not (seo_extras ? 'howTo')        or jsonb_typeof(seo_extras->'howTo')        = 'object')
      and (not (seo_extras ? 'video')        or jsonb_typeof(seo_extras->'video')        = 'object')
      and (not (seo_extras ? 'og_image_url') or jsonb_typeof(seo_extras->'og_image_url') = 'string')
    )
  );

comment on column public.blog_translations.seo_extras is
  'Sprint 5b — Structured-data extras (FAQ/HowTo/Video) + per-translation OG image override. Populated via MDX frontmatter on save, validated by Zod (SeoExtrasSchema) before insert.';
