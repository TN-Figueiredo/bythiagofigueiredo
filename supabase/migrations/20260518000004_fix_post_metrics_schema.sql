-- =============================================================================
-- MIGRATION: fix_post_metrics_schema
-- Aligns post_metrics columns with what metrics-poller.ts actually writes.
-- The v6 migration created post_metrics with (id, post_id, platform,
-- fetched_at, data, created_at) but the poller emits:
-- (post_id, delivery_id, provider, impressions, reach, likes, comments,
--  shares, link_clicks, polled_at, raw).
-- This migration adds the missing columns, drops the stale placeholder
-- unique constraint, and adds a proper one on (delivery_id, polled_at).
-- Also adds the missing UPDATE policy for link_in_bio_entries.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add columns expected by the poller (all idempotent via ADD COLUMN IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────────────────────

-- delivery reference (FK to social_deliveries)
ALTER TABLE public.post_metrics
  ADD COLUMN IF NOT EXISTS delivery_id UUID
    REFERENCES public.social_deliveries(id) ON DELETE CASCADE;

-- provider / platform (the poller calls it "provider"; keep "platform" for compat)
ALTER TABLE public.post_metrics
  ADD COLUMN IF NOT EXISTS provider TEXT;

-- engagement counters
ALTER TABLE public.post_metrics
  ADD COLUMN IF NOT EXISTS impressions INTEGER;

ALTER TABLE public.post_metrics
  ADD COLUMN IF NOT EXISTS reach INTEGER;

ALTER TABLE public.post_metrics
  ADD COLUMN IF NOT EXISTS likes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.post_metrics
  ADD COLUMN IF NOT EXISTS comments INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.post_metrics
  ADD COLUMN IF NOT EXISTS shares INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.post_metrics
  ADD COLUMN IF NOT EXISTS link_clicks INTEGER;

-- poll timestamp (replaces the generic fetched_at)
ALTER TABLE public.post_metrics
  ADD COLUMN IF NOT EXISTS polled_at TIMESTAMPTZ;

-- raw API response (replaces the generic data JSONB)
ALTER TABLE public.post_metrics
  ADD COLUMN IF NOT EXISTS raw JSONB;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Replace the stale unique constraint with the correct one
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the placeholder constraint from the v6 migration
ALTER TABLE public.post_metrics
  DROP CONSTRAINT IF EXISTS uq_post_metrics_snapshot;

-- New constraint: one metric snapshot per delivery per poll time
ALTER TABLE public.post_metrics
  ADD CONSTRAINT uq_post_metrics_delivery_polled
    UNIQUE (delivery_id, polled_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Index for the new delivery_id column
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_post_metrics_delivery
  ON public.post_metrics(delivery_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS: allow service-role / staff to INSERT into post_metrics
--    (the cron job uses getSupabaseServiceClient which bypasses RLS, but an
--    explicit policy is good practice for future direct writes by staff)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "post_metrics_insert" ON public.post_metrics;
CREATE POLICY "post_metrics_insert"
  ON public.post_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.social_posts p
      WHERE p.id = post_id
        AND public.can_edit_site(p.site_id)
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Missing UPDATE policy for link_in_bio_entries
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "link_in_bio_update" ON public.link_in_bio_entries;
CREATE POLICY "link_in_bio_update"
  ON public.link_in_bio_entries
  FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

COMMIT;
