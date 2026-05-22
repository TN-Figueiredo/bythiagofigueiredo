-- =============================================================================
-- MIGRATION: pipeline_blog_unification
-- Unify blog_posts category CHECK to accept pipeline values,
-- migrate existing category data, and add materialized_rev columns.
-- =============================================================================

-- 1. Unify blog_posts category CHECK to accept pipeline values
ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_category_check;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_category_check
  CHECK (category = ANY (ARRAY[
    'stories'::text, 'building'::text, 'money'::text, 'bts'::text,
    -- Keep old values for backward compat during transition
    'tech'::text, 'vida'::text, 'viagem'::text, 'crescimento'::text, 'code'::text, 'negocio'::text
  ]));

-- 2. Migrate existing posts to new category values
UPDATE public.blog_posts SET category = 'building' WHERE category IN ('tech', 'code');
UPDATE public.blog_posts SET category = 'stories' WHERE category IN ('vida', 'viagem');
UPDATE public.blog_posts SET category = 'money' WHERE category = 'negocio';
UPDATE public.blog_posts SET category = 'bts' WHERE category = 'crescimento';

-- 3. Now tighten to only new values
ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_category_check;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_category_check
  CHECK (category = ANY (ARRAY['stories'::text, 'building'::text, 'money'::text, 'bts'::text]));

-- 4. Add materialized_rev tracking columns
ALTER TABLE public.content_pipeline
  ADD COLUMN IF NOT EXISTS materialized_rev_pt integer,
  ADD COLUMN IF NOT EXISTS materialized_rev_en integer;

COMMENT ON COLUMN public.content_pipeline.materialized_rev_pt IS
  'Draft rev at last materialization for PT locale. NULL = never materialized.';
COMMENT ON COLUMN public.content_pipeline.materialized_rev_en IS
  'Draft rev at last materialization for EN locale. NULL = never materialized.';

-- 5. Update pipeline_workflows label for "ready" stage
UPDATE public.pipeline_workflows
  SET label_pt = 'Entrega', label_en = 'Delivery'
  WHERE stage = 'ready' AND format = 'blog_post';
