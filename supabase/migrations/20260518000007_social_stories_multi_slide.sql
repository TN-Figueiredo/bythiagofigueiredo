-- Multi-slide story support for Instagram Stories v2

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS story_slides jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_locale text DEFAULT NULL;

COMMENT ON COLUMN public.social_posts.story_slides IS 'Array of CardComposition objects for multi-slide stories, max 10. NULL = single-image post.';
COMMENT ON COLUMN public.social_posts.source_locale IS 'Locale used for auto-generation (e.g. pt-BR, en). NULL if created from scratch.';

ALTER TABLE public.social_templates
  ADD COLUMN IF NOT EXISTS slides jsonb DEFAULT NULL;

COMMENT ON COLUMN public.social_templates.slides IS 'Array of CardComposition objects for multi-slide templates. NULL = single-slide. When present, composition stores slide 0 (cover).';

ALTER TABLE public.post_metrics
  ADD COLUMN IF NOT EXISTS slide_index integer DEFAULT NULL;

COMMENT ON COLUMN public.post_metrics.slide_index IS '0-based index for per-slide metrics. NULL = aggregate metrics for entire post.';

ALTER TABLE public.post_metrics
  DROP CONSTRAINT IF EXISTS uq_post_metrics_delivery_polled;

CREATE UNIQUE INDEX IF NOT EXISTS uq_post_metrics_slide
  ON public.post_metrics (delivery_id, polled_at, COALESCE(slide_index, -1));
