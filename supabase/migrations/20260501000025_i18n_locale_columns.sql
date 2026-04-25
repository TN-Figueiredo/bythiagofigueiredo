-- i18n locale prefix routing: add locale + link_group_id to blog_posts and campaigns
-- Additive only — no breaking changes.

-- 1. blog_posts: locale column (defaults to 'en')
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en';

-- 2. blog_posts: link_group_id for cross-locale equivalence
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS link_group_id uuid NULL;

-- 3. One post per locale per link group
DROP INDEX IF EXISTS blog_posts_link_group_locale;
CREATE UNIQUE INDEX blog_posts_link_group_locale
  ON public.blog_posts(link_group_id, locale)
  WHERE link_group_id IS NOT NULL;

-- 4. Backfill locale from existing translations
UPDATE public.blog_posts bp
SET locale = COALESCE(
  (SELECT bt.locale FROM public.blog_translations bt WHERE bt.post_id = bp.id LIMIT 1),
  'en'
);

-- 5. campaigns: same pattern
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en';

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS link_group_id uuid NULL;

DROP INDEX IF EXISTS campaigns_link_group_locale;
CREATE UNIQUE INDEX campaigns_link_group_locale
  ON public.campaigns(link_group_id, locale)
  WHERE link_group_id IS NOT NULL;

UPDATE public.campaigns c
SET locale = COALESCE(
  (SELECT ct.locale FROM public.campaign_translations ct WHERE ct.campaign_id = c.id LIMIT 1),
  'en'
);

-- 6. Flip site default locale from pt-BR to en
UPDATE public.sites
SET default_locale = 'en'
WHERE slug = 'bythiagofigueiredo' AND default_locale = 'pt-BR';
