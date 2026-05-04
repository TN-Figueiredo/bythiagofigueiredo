-- Phase 1: Create table + trigger + RLS
CREATE TABLE author_about_translations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id      uuid NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  locale         text NOT NULL,
  headline       text,
  subtitle       text,
  about_md       text,
  about_compiled text,
  photo_caption  text,
  photo_location text,
  about_cta_links jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT author_about_tx_author_locale_uniq UNIQUE (author_id, locale),
  CONSTRAINT author_about_tx_cta_valid CHECK (
    about_cta_links IS NULL OR (
      about_cta_links ? 'links'
      AND jsonb_typeof(about_cta_links -> 'links') = 'array'
    )
  )
);

DROP TRIGGER IF EXISTS author_about_tx_set_updated_at ON author_about_translations;
CREATE TRIGGER author_about_tx_set_updated_at
  BEFORE UPDATE ON author_about_translations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE author_about_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "about_tx_public_read" ON author_about_translations;
CREATE POLICY "about_tx_public_read" ON author_about_translations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM authors a
      WHERE a.id = author_about_translations.author_id
      AND public.site_visible(a.site_id)
    )
  );

DROP POLICY IF EXISTS "about_tx_staff_write" ON author_about_translations;
CREATE POLICY "about_tx_staff_write" ON author_about_translations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM authors a
      WHERE a.id = author_about_translations.author_id
      AND public.can_edit_site(a.site_id)
    )
  );

-- Phase 2: Migrate existing data to pt-BR
INSERT INTO author_about_translations
  (author_id, locale, headline, subtitle, about_md, about_compiled,
   photo_caption, photo_location, about_cta_links)
SELECT
  id, 'pt-BR', headline, subtitle, about_md, about_compiled,
  photo_caption, photo_location, about_cta_links
FROM authors
WHERE headline IS NOT NULL
   OR subtitle IS NOT NULL
   OR about_md IS NOT NULL
   OR about_compiled IS NOT NULL
   OR photo_caption IS NOT NULL
   OR photo_location IS NOT NULL
   OR about_cta_links IS NOT NULL;

-- Phase 3: Drop migrated columns from authors
ALTER TABLE authors DROP CONSTRAINT IF EXISTS authors_about_cta_links_valid;

ALTER TABLE authors
  DROP COLUMN IF EXISTS headline,
  DROP COLUMN IF EXISTS subtitle,
  DROP COLUMN IF EXISTS about_md,
  DROP COLUMN IF EXISTS about_compiled,
  DROP COLUMN IF EXISTS photo_caption,
  DROP COLUMN IF EXISTS photo_location,
  DROP COLUMN IF EXISTS about_cta_links;
