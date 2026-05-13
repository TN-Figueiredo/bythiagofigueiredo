-- Migration: reference_groups
-- Adds ref_group and sort_order columns to reference_content for grouped navigation.

BEGIN;

-- 1. Add columns
ALTER TABLE public.reference_content
  ADD COLUMN IF NOT EXISTS ref_group text NOT NULL DEFAULT 'pessoal'
    CHECK (ref_group IN ('pessoal','estrategia','craft','producao','api','memoria')),
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 2. Index for efficient grouped queries (idempotent)
DROP INDEX IF EXISTS public.idx_reference_content_group_sort;
CREATE INDEX idx_reference_content_group_sort
  ON public.reference_content (site_id, ref_group, sort_order, key);

-- 3. Backfill all 30 active keys with correct group and sort_order
UPDATE public.reference_content
SET
  ref_group = CASE key
    -- pessoal
    WHEN 'personal-profile'              THEN 'pessoal'
    WHEN 'content-calendar-taxonomy'     THEN 'pessoal'
    WHEN 'featured-convention'           THEN 'pessoal'
    -- estrategia
    WHEN 'ideator-channel-profiles'      THEN 'estrategia'
    WHEN 'ideator-content-angles'        THEN 'estrategia'
    WHEN 'ideator-formats-frameworks'    THEN 'estrategia'
    WHEN 'ideator-generation-techniques' THEN 'estrategia'
    WHEN 'ideator-monetization-research' THEN 'estrategia'
    WHEN 'ideator-scoring-rubrics'       THEN 'estrategia'
    -- craft
    WHEN 'writer-voice-guide'            THEN 'craft'
    WHEN 'writer-article-craft'          THEN 'craft'
    WHEN 'writer-newsletter-craft'       THEN 'craft'
    WHEN 'writer-social-craft'           THEN 'craft'
    WHEN 'producer-editing-patterns'     THEN 'craft'
    WHEN 'producer-sound-design'         THEN 'craft'
    WHEN 'producer-visual-style'         THEN 'craft'
    WHEN 'product-eval-scoring'          THEN 'craft'
    -- producao
    WHEN 'producer-seo-metadata'         THEN 'producao'
    WHEN 'producer-launch-strategy'      THEN 'producao'
    WHEN 'perf-review-benchmarks'        THEN 'producao'
    WHEN 'perf-review-feedback-templates' THEN 'producao'
    WHEN 'perf-review-analytics-guide'   THEN 'producao'
    -- api
    WHEN 'product-eval-catalog'          THEN 'api'
    WHEN 'product-eval-experience'       THEN 'api'
    WHEN 'product-eval-reference'        THEN 'api'
    -- memoria
    WHEN 'ideator-memory'                THEN 'memoria'
    WHEN 'writer-memory'                 THEN 'memoria'
    WHEN 'producer-memory'              THEN 'memoria'
    WHEN 'product-eval-memory'           THEN 'memoria'
    WHEN 'perf-review-memory'            THEN 'memoria'
    ELSE ref_group
  END,
  sort_order = CASE key
    -- pessoal
    WHEN 'personal-profile'              THEN 10
    WHEN 'content-calendar-taxonomy'     THEN 20
    WHEN 'featured-convention'           THEN 30
    -- estrategia
    WHEN 'ideator-channel-profiles'      THEN 10
    WHEN 'ideator-content-angles'        THEN 20
    WHEN 'ideator-formats-frameworks'    THEN 30
    WHEN 'ideator-generation-techniques' THEN 40
    WHEN 'ideator-monetization-research' THEN 50
    WHEN 'ideator-scoring-rubrics'       THEN 60
    -- craft
    WHEN 'writer-voice-guide'            THEN 10
    WHEN 'writer-article-craft'          THEN 20
    WHEN 'writer-newsletter-craft'       THEN 30
    WHEN 'writer-social-craft'           THEN 40
    WHEN 'producer-editing-patterns'     THEN 50
    WHEN 'producer-sound-design'         THEN 60
    WHEN 'producer-visual-style'         THEN 70
    WHEN 'product-eval-scoring'          THEN 80
    -- producao
    WHEN 'producer-seo-metadata'         THEN 10
    WHEN 'producer-launch-strategy'      THEN 20
    WHEN 'perf-review-benchmarks'        THEN 30
    WHEN 'perf-review-feedback-templates' THEN 40
    WHEN 'perf-review-analytics-guide'   THEN 50
    -- api
    WHEN 'product-eval-catalog'          THEN 10
    WHEN 'product-eval-experience'       THEN 20
    WHEN 'product-eval-reference'        THEN 30
    -- memoria
    WHEN 'ideator-memory'                THEN 10
    WHEN 'writer-memory'                 THEN 20
    WHEN 'producer-memory'              THEN 30
    WHEN 'product-eval-memory'           THEN 40
    WHEN 'perf-review-memory'            THEN 50
    ELSE sort_order
  END
WHERE key IN (
  'personal-profile',
  'content-calendar-taxonomy',
  'featured-convention',
  'ideator-channel-profiles',
  'ideator-content-angles',
  'ideator-formats-frameworks',
  'ideator-generation-techniques',
  'ideator-monetization-research',
  'ideator-scoring-rubrics',
  'writer-voice-guide',
  'writer-article-craft',
  'writer-newsletter-craft',
  'writer-social-craft',
  'producer-editing-patterns',
  'producer-sound-design',
  'producer-visual-style',
  'product-eval-scoring',
  'producer-seo-metadata',
  'producer-launch-strategy',
  'perf-review-benchmarks',
  'perf-review-feedback-templates',
  'perf-review-analytics-guide',
  'product-eval-catalog',
  'product-eval-experience',
  'product-eval-reference',
  'ideator-memory',
  'writer-memory',
  'producer-memory',
  'product-eval-memory',
  'perf-review-memory'
);

COMMIT;
