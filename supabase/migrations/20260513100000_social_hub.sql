-- Social Hub: multi-platform social media management.
-- Tables: social_connections, social_posts, social_deliveries, youtube_quota_usage.
-- Supports YouTube, Facebook, Instagram, Bluesky.
-- Encrypted token storage, idempotent publishing, per-delivery retry tracking.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. social_connections  (OAuth connections per site × provider)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.social_connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL CHECK (provider IN ('youtube','facebook','instagram','bluesky')),
  account_id          TEXT NOT NULL,
  account_name        TEXT,
  access_token_enc    TEXT NOT NULL,
  refresh_token_enc   TEXT,
  page_token_enc      TEXT,
  token_expires_at    TIMESTAMPTZ,
  scopes              TEXT[],
  metadata            JSONB DEFAULT '{}',
  connected_at        TIMESTAMPTZ DEFAULT now(),
  revoked_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(site_id, provider, account_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. social_posts  (scheduled / published posts)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.social_posts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  created_by          UUID NOT NULL REFERENCES auth.users(id),
  type                TEXT NOT NULL CHECK (type IN ('link','video','image','text')),
  status              TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','publishing','completed','partial_failure','failed','cancelled')),
  scheduled_at        TIMESTAMPTZ,
  user_timezone       TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  published_at        TIMESTAMPTZ,
  content             JSONB NOT NULL,
  template_id         TEXT,
  idempotency_key     TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. social_deliveries  (per-platform delivery tracking)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.social_deliveries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id             UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  connection_id       UUID NOT NULL REFERENCES public.social_connections(id),
  provider            TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','publishing','published','failed','retrying','skipped')),
  platform_post_id    TEXT,
  platform_url        TEXT,
  content_override    JSONB,
  attempt             INT DEFAULT 0,
  max_attempts        INT DEFAULT 3,
  last_error          TEXT,
  error_type          TEXT CHECK (error_type IN ('permanent','transient','auth')),
  published_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. youtube_quota_usage  (daily quota tracking per site)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.youtube_quota_usage (
  date                DATE NOT NULL,
  site_id             UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  units_used          INT NOT NULL DEFAULT 0,
  operations          JSONB DEFAULT '[]',
  updated_at          TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (site_id, date)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_social_connections_site
  ON public.social_connections(site_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled
  ON public.social_posts(scheduled_at)
  WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_posts_site
  ON public.social_posts(site_id, status);

CREATE INDEX IF NOT EXISTS idx_social_deliveries_post
  ON public.social_deliveries(post_id);

CREATE INDEX IF NOT EXISTS idx_social_deliveries_status
  ON public.social_deliveries(status)
  WHERE status IN ('pending', 'publishing', 'retrying');

CREATE INDEX IF NOT EXISTS idx_youtube_quota_site_date
  ON public.youtube_quota_usage(site_id, date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Trigger function: shared updated_at for social tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.social_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_social_connections_updated_at ON public.social_connections;
CREATE TRIGGER trg_social_connections_updated_at
  BEFORE UPDATE ON public.social_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.social_updated_at();

DROP TRIGGER IF EXISTS trg_social_posts_updated_at ON public.social_posts;
CREATE TRIGGER trg_social_posts_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.social_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Enable Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.social_connections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_deliveries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_quota_usage ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RLS Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- social_connections: can_edit_site for both read and write (tokens are sensitive)

DROP POLICY IF EXISTS "social_connections_select" ON public.social_connections;
CREATE POLICY "social_connections_select"
  ON public.social_connections
  FOR SELECT
  TO authenticated
  USING (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "social_connections_insert" ON public.social_connections;
CREATE POLICY "social_connections_insert"
  ON public.social_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "social_connections_update" ON public.social_connections;
CREATE POLICY "social_connections_update"
  ON public.social_connections
  FOR UPDATE
  TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "social_connections_delete" ON public.social_connections;
CREATE POLICY "social_connections_delete"
  ON public.social_connections
  FOR DELETE
  TO authenticated
  USING (public.can_edit_site(site_id));

-- social_posts: can_view_site for read, can_edit_site for write

DROP POLICY IF EXISTS "social_posts_select" ON public.social_posts;
CREATE POLICY "social_posts_select"
  ON public.social_posts
  FOR SELECT
  TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "social_posts_insert" ON public.social_posts;
CREATE POLICY "social_posts_insert"
  ON public.social_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "social_posts_update" ON public.social_posts;
CREATE POLICY "social_posts_update"
  ON public.social_posts
  FOR UPDATE
  TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "social_posts_delete" ON public.social_posts;
CREATE POLICY "social_posts_delete"
  ON public.social_posts
  FOR DELETE
  TO authenticated
  USING (public.can_edit_site(site_id));

-- social_deliveries: read-only via join to social_posts (no user write — service role only)

DROP POLICY IF EXISTS "social_deliveries_select" ON public.social_deliveries;
CREATE POLICY "social_deliveries_select"
  ON public.social_deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.social_posts p
      WHERE p.id = post_id
        AND public.can_view_site(p.site_id)
    )
  );

-- youtube_quota_usage: read-only via can_view_site (no user write — service role only)

DROP POLICY IF EXISTS "youtube_quota_select" ON public.youtube_quota_usage;
CREATE POLICY "youtube_quota_select"
  ON public.youtube_quota_usage
  FOR SELECT
  TO authenticated
  USING (public.can_view_site(site_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Enable Supabase Realtime for live delivery status updates
-- ─────────────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.social_deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;

COMMIT;
