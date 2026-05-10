ALTER TABLE public.content_pipeline
  ADD COLUMN IF NOT EXISTS sections jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.content_pipeline.sections IS
  'Structured section storage keyed by {type}_{lang|shared}. See spec: pipeline-detail-page-design.md';
