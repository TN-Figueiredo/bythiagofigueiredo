-- Add category and cover_image_url to content_pipeline
ALTER TABLE public.content_pipeline
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS cover_image_url text;

ALTER TABLE public.content_pipeline
  DROP CONSTRAINT IF EXISTS content_pipeline_category_check;

ALTER TABLE public.content_pipeline
  ADD CONSTRAINT content_pipeline_category_check
  CHECK (category IS NULL OR category IN ('stories', 'building', 'money', 'bts'));
