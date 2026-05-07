ALTER TABLE public.blog_tags
  ADD COLUMN IF NOT EXISTS name_translations jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.blog_tags.name_translations IS
  'Per-locale display names. Keys = locale codes (e.g. "en", "pt-BR"). Values = translated name strings. The "name" column is the primary/fallback name (default locale).';
