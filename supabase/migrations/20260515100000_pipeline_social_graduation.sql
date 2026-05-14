-- Pipeline <> Social Graduation: bridge content pipeline to social distribution.
-- Adds social_config + social_post_id to content_pipeline.
-- Adds source_pipeline_id + pipeline_snapshot + graduated_at to social_posts.
-- Extends origin CHECK to include 'pipeline'.
-- See: docs/superpowers/specs/2026-05-14-pipeline-social-unification-design.md

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. content_pipeline: social distribution config (edited in Publication tab)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.content_pipeline
  ADD COLUMN IF NOT EXISTS social_config JSONB;

COMMENT ON COLUMN public.content_pipeline.social_config IS
  'Social distribution config edited in Publication tab. Shape: SocialConfig from lib/social/types.ts. NULL = not configured.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. content_pipeline: FK to graduated social post
--    (social_posts table already exists from 20260513100000_social_hub.sql)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.content_pipeline
  ADD COLUMN IF NOT EXISTS social_post_id UUID
    REFERENCES public.social_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_social_post
  ON public.content_pipeline(social_post_id)
  WHERE social_post_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. social_posts: pipeline provenance columns
-- ─────────────────────────────────────────────────────────────────────────────

-- FK back to the pipeline item that generated this social post
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS source_pipeline_id UUID
    REFERENCES public.content_pipeline(id) ON DELETE SET NULL;

-- Complete snapshot of all pipeline sections at graduation time (read-only context)
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS pipeline_snapshot JSONB;

-- Timestamp when the graduation happened
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS graduated_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. social_posts: indexes for pipeline provenance
-- ─────────────────────────────────────────────────────────────────────────────

-- Reverse lookup: given a pipeline item, find its social post
CREATE INDEX IF NOT EXISTS idx_social_posts_source_pipeline
  ON public.social_posts(source_pipeline_id)
  WHERE source_pipeline_id IS NOT NULL;

-- Unique partial index: at most 1 active social post per pipeline item.
-- Prevents duplicate graduations while pipeline is in progress.
-- Mirrors idx_social_posts_active_per_content from 20260514100000.
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_posts_active_per_pipeline
  ON public.social_posts(site_id, source_pipeline_id)
  WHERE status IN ('draft', 'scheduled', 'publishing')
    AND source_pipeline_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Extend origin CHECK constraint to include 'pipeline'
--    Original constraint added inline in 20260514100000_social_posts_redesign.sql:
--      CHECK (origin IN ('manual','auto','publish_modal'))
--    PostgreSQL auto-names it social_posts_origin_check.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.social_posts
  DROP CONSTRAINT IF EXISTS social_posts_origin_check;

ALTER TABLE public.social_posts
  ADD CONSTRAINT social_posts_origin_check
    CHECK (origin IN ('manual', 'auto', 'publish_modal', 'pipeline'));

COMMIT;
