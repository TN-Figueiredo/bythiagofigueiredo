-- Migration: 20260504000002_authors_about_extension.sql
-- Adds about-page fields to the authors table.

ALTER TABLE authors
  ADD COLUMN IF NOT EXISTS headline        text,
  ADD COLUMN IF NOT EXISTS subtitle        text,
  ADD COLUMN IF NOT EXISTS about_md        text,
  ADD COLUMN IF NOT EXISTS about_compiled  text,
  ADD COLUMN IF NOT EXISTS about_photo_url text,
  ADD COLUMN IF NOT EXISTS photo_caption   text,
  ADD COLUMN IF NOT EXISTS photo_location  text,
  ADD COLUMN IF NOT EXISTS about_cta_links jsonb;

-- CHECK: about_photo_url must be https when set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'authors_about_photo_url_https'
  ) THEN
    ALTER TABLE authors
      ADD CONSTRAINT authors_about_photo_url_https
      CHECK (about_photo_url IS NULL OR about_photo_url ~ '^https://');
  END IF;
END $$;

-- CHECK: about_cta_links structural validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'authors_about_cta_links_valid'
  ) THEN
    ALTER TABLE authors
      ADD CONSTRAINT authors_about_cta_links_valid
      CHECK (
        about_cta_links IS NULL
        OR (
          about_cta_links ? 'links'
          AND jsonb_typeof(about_cta_links -> 'links') = 'array'
        )
      );
  END IF;
END $$;
