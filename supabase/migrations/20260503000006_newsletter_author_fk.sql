-- Newsletter author FK: seed default author for bythiagofigueiredo + link newsletter_types
-- Follows idempotent patterns: ON CONFLICT DO NOTHING, ADD COLUMN IF NOT EXISTS, WHERE IS NULL guard.

-- 1. Insert default author for bythiagofigueiredo site (idempotent)
--    Uses real data from the current hardcoded IDENTITY_PROFILES + i18n strings.
--    ON CONFLICT on (site_id, slug) unique constraint ensures idempotency.
INSERT INTO public.authors (site_id, name, display_name, slug, bio, bio_md, avatar_url, is_default, sort_order)
SELECT
  s.id,
  'Thiago Figueiredo',
  'Thiago Figueiredo',
  'thiago',
  'I''ve built software for six years. Since 2024, only for myself: six apps cooking, a YouTube channel, a blog that became the center of everything.',
  'I''ve built software for six years. Since 2024, only for myself: six apps cooking, a YouTube channel, a blog that became the center of everything.',
  NULL,
  true,
  0
FROM public.sites s
WHERE s.slug = 'bythiagofigueiredo'
ON CONFLICT (site_id, slug) DO NOTHING;

-- 2. Add author_id FK to newsletter_types
ALTER TABLE public.newsletter_types
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES public.authors(id) ON DELETE SET NULL;

-- 3. Backfill: link all existing newsletter_types to the default author of the same site
--    Only touches rows where author_id IS NULL AND same site_id, safe to re-run.
UPDATE public.newsletter_types nt
SET author_id = a.id
FROM public.authors a
JOIN public.sites s ON a.site_id = s.id
WHERE s.slug = 'bythiagofigueiredo'
  AND a.is_default = true
  AND nt.site_id = s.id
  AND nt.author_id IS NULL;
