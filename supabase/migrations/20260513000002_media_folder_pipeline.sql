-- Add 'pipeline' to media_assets folder CHECK constraint
ALTER TABLE public.media_assets
  DROP CONSTRAINT IF EXISTS media_assets_folder_check;

ALTER TABLE public.media_assets
  ADD CONSTRAINT media_assets_folder_check
  CHECK (folder IN (
    'general', 'authors', 'blog', 'pipeline', 'newsletters',
    'branding', 'og', 'ads', 'links'
  ));
