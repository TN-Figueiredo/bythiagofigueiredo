-- Social Composer v6: templates, metrics, link-in-bio, caption variables,
-- pipeline step rename, Bluesky JWT columns.
-- Spec: docs/superpowers/specs/2026-05-17-social-composer-stories-templates-design.md

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. NEW TABLE: social_templates
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.social_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID REFERENCES public.sites(id) ON DELETE CASCADE,  -- NULL = global default
  name          TEXT NOT NULL,
  aspect_ratio  TEXT NOT NULL CHECK (aspect_ratio IN ('9:16', '1:1', '16:9')),
  composition   JSONB NOT NULL,
  thumbnail_url TEXT,
  is_default    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Only one default per site per aspect ratio
CREATE UNIQUE INDEX IF NOT EXISTS social_templates_default_unique
  ON public.social_templates (
    COALESCE(site_id, '00000000-0000-0000-0000-000000000000'),
    aspect_ratio
  )
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_social_templates_site
  ON public.social_templates(site_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. NEW TABLE: post_metrics
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.post_metrics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_post_metrics_snapshot UNIQUE (post_id, platform, fetched_at)
);

CREATE INDEX IF NOT EXISTS idx_post_metrics_post
  ON public.post_metrics(post_id);

CREATE INDEX IF NOT EXISTS idx_post_metrics_fetched
  ON public.post_metrics(fetched_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. NEW TABLE: link_in_bio_entries
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.link_in_bio_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  link_id     UUID NOT NULL REFERENCES public.tracked_links(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_link_in_bio_site
  ON public.link_in_bio_entries(site_id, position);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ALTER social_posts: caption variables + template FK + queued status
-- ─────────────────────────────────────────────────────────────────────────────

-- Caption variable system (spec Section 2)
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS caption_template TEXT;

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS caption_overrides JSONB DEFAULT '{}';

-- Link-in-bio tracking
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS link_in_bio_updated BOOLEAN DEFAULT false;

-- Migrate template_id TEXT -> UUID FK to social_templates.
-- Step 1: Null out any non-UUID values so the cast succeeds.
UPDATE public.social_posts
  SET template_id = NULL
  WHERE template_id IS NOT NULL
    AND template_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Step 2: ALTER COLUMN type.
ALTER TABLE public.social_posts
  ALTER COLUMN template_id TYPE UUID USING template_id::uuid;

-- Step 3: Add FK (may already exist from a prior run; drop first).
ALTER TABLE public.social_posts
  DROP CONSTRAINT IF EXISTS fk_social_posts_template;

ALTER TABLE public.social_posts
  ADD CONSTRAINT fk_social_posts_template
    FOREIGN KEY (template_id) REFERENCES public.social_templates(id) ON DELETE SET NULL;

-- Add 'queued' to status CHECK (spec Section 6.9)
ALTER TABLE public.social_posts
  DROP CONSTRAINT IF EXISTS social_posts_status_check;

ALTER TABLE public.social_posts
  ADD CONSTRAINT social_posts_status_check
    CHECK (status IN ('draft', 'queued', 'scheduled', 'publishing', 'completed', 'partial_failure', 'failed', 'cancelled'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ALTER social_deliveries: add format column (idempotent — may already exist)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.social_deliveries
  ADD COLUMN IF NOT EXISTS format TEXT
    CHECK (format IN ('link_share', 'image_post', 'story', 'reel', 'link_card', 'video_share'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ALTER sites: add social_defaults JSONB
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS social_defaults JSONB DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ALTER social_connections: Bluesky JWT columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS bluesky_did TEXT;

ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS bluesky_access_jwt_enc TEXT;

ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS bluesky_refresh_jwt_enc TEXT;

ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS bluesky_jwt_expires_at TIMESTAMPTZ;

-- Rate limiting (spec 3.6): rolling 24h counter per connection
ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS rate_window_start TIMESTAMPTZ;

ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS rate_window_count INTEGER DEFAULT 0;

-- Circuit breaker (spec 3.5): skip deliveries after consecutive failures
ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS circuit_open_until TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Pipeline step rename: og_scrape -> platform_prepare
-- ─────────────────────────────────────────────────────────────────────────────

-- Migrate existing pipeline_steps JSONB data
UPDATE public.social_posts
  SET pipeline_steps = (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'step' = 'og_scrape'
        THEN jsonb_set(elem, '{step}', '"platform_prepare"')
        ELSE elem
      END
      ORDER BY ordinality
    ), '[]')
    FROM jsonb_array_elements(pipeline_steps) WITH ORDINALITY AS e(elem, ordinality)
  )
  WHERE pipeline_steps::text LIKE '%og_scrape%';

-- Update the RPC validation function to accept the new step name
CREATE OR REPLACE FUNCTION public.update_pipeline_step(
  p_post_id   UUID,
  p_step_name TEXT,
  p_patch     JSONB
) RETURNS VOID AS $$
DECLARE
  idx INT;
BEGIN
  IF p_step_name NOT IN ('post_created', 'short_link', 'platform_prepare', 'deliver') THEN
    RAISE EXCEPTION 'update_pipeline_step: invalid step name "%"', p_step_name
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_patch->>'step' IS NULL OR p_patch->>'status' IS NULL OR p_patch->>'at' IS NULL THEN
    RAISE EXCEPTION 'update_pipeline_step: p_patch must contain "step", "status", and "at" fields'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT ordinality - 1 INTO idx
  FROM social_posts,
       jsonb_array_elements(pipeline_steps) WITH ORDINALITY AS e(elem, ordinality)
  WHERE id = p_post_id AND elem->>'step' = p_step_name;

  IF idx IS NOT NULL THEN
    UPDATE social_posts
    SET pipeline_steps = jsonb_set(pipeline_steps, ARRAY[idx::TEXT], p_patch)
    WHERE id = p_post_id;
  ELSE
    UPDATE social_posts
    SET pipeline_steps = pipeline_steps || jsonb_build_array(p_patch)
    WHERE id = p_post_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. updated_at triggers for new tables
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_social_templates_updated_at ON public.social_templates;
CREATE TRIGGER trg_social_templates_updated_at
  BEFORE UPDATE ON public.social_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.social_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Link-in-bio auto-prune trigger (max 20 per site)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prune_link_in_bio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  entry_count INT;
BEGIN
  SELECT count(*) INTO entry_count
  FROM link_in_bio_entries
  WHERE site_id = NEW.site_id;

  IF entry_count > 20 THEN
    DELETE FROM link_in_bio_entries
    WHERE id IN (
      SELECT id FROM link_in_bio_entries
      WHERE site_id = NEW.site_id
      ORDER BY position DESC, created_at ASC
      LIMIT (entry_count - 20)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_in_bio_prune ON public.link_in_bio_entries;
CREATE TRIGGER trg_link_in_bio_prune
  AFTER INSERT ON public.link_in_bio_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.prune_link_in_bio();

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. RLS policies for new tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.social_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_in_bio_entries ENABLE ROW LEVEL SECURITY;

-- social_templates: global defaults (site_id IS NULL) readable by all authenticated,
-- site-scoped readable via site_visible, write via is_staff
DROP POLICY IF EXISTS "social_templates_select" ON public.social_templates;
CREATE POLICY "social_templates_select"
  ON public.social_templates
  FOR SELECT
  TO authenticated
  USING (
    site_id IS NULL
    OR public.site_visible(site_id)
  );

DROP POLICY IF EXISTS "social_templates_insert" ON public.social_templates;
CREATE POLICY "social_templates_insert"
  ON public.social_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "social_templates_update" ON public.social_templates;
CREATE POLICY "social_templates_update"
  ON public.social_templates
  FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "social_templates_delete" ON public.social_templates;
CREATE POLICY "social_templates_delete"
  ON public.social_templates
  FOR DELETE
  TO authenticated
  USING (public.is_staff());

-- post_metrics: read via join to social_posts
DROP POLICY IF EXISTS "post_metrics_select" ON public.post_metrics;
CREATE POLICY "post_metrics_select"
  ON public.post_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.social_posts p
      WHERE p.id = post_id
        AND public.can_view_site(p.site_id)
    )
  );

-- link_in_bio_entries: public read (displayed on /go/ig), write via is_staff
DROP POLICY IF EXISTS "link_in_bio_select" ON public.link_in_bio_entries;
CREATE POLICY "link_in_bio_select"
  ON public.link_in_bio_entries
  FOR SELECT
  TO authenticated, anon
  USING (public.site_visible(site_id));

DROP POLICY IF EXISTS "link_in_bio_insert" ON public.link_in_bio_entries;
CREATE POLICY "link_in_bio_insert"
  ON public.link_in_bio_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "link_in_bio_delete" ON public.link_in_bio_entries;
CREATE POLICY "link_in_bio_delete"
  ON public.link_in_bio_entries
  FOR DELETE
  TO authenticated
  USING (public.is_staff());

COMMIT;
