-- =============================================================================
-- 20260507000005_media_assets.sql
-- Sprint 5g — Unified Media System: tables, indexes, RLS, trigger.
-- =============================================================================

-- §3.1 Extension (pg_trgm already exists in squashed schema; idempotent guard)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- §3.2 Enum
DO $$ BEGIN
  CREATE TYPE public.media_usage_resource AS ENUM (
    'blog_post',
    'blog_translation',
    'newsletter_type',
    'newsletter_edition',
    'campaign_translation',
    'author',
    'site',
    'ad_campaign',
    'ad_placeholder',
    'ad_slot_creative',
    'tracked_link'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- §3.3 media_assets
CREATE TABLE IF NOT EXISTS public.media_assets (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  blob_url     text        NOT NULL CHECK (blob_url ~ '^https://'),
  blob_pathname text       NOT NULL,
  filename     text        NOT NULL,
  alt_text     text,
  width        integer,
  height       integer,
  mime_type    text        NOT NULL CHECK (mime_type ~ '^(image|video|application)/.+$'),
  file_size    integer     NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  content_hash text        NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  folder       text        NOT NULL DEFAULT 'general'
                            CHECK (folder IN (
                              'general', 'authors', 'blog', 'newsletters',
                              'branding', 'og', 'ads', 'links'
                            )),
  tags         text[]      DEFAULT '{}',
  uploaded_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now() NOT NULL,
  updated_at   timestamptz DEFAULT now() NOT NULL,
  deleted_at   timestamptz
);

-- §3.4 media_asset_usage
CREATE TABLE IF NOT EXISTS public.media_asset_usage (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id       uuid        NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  resource_type  public.media_usage_resource NOT NULL,
  resource_id    uuid        NOT NULL,
  field_name     text        NOT NULL,
  created_at     timestamptz DEFAULT now() NOT NULL,
  UNIQUE (asset_id, resource_type, resource_id, field_name)
);

-- §3.5 Indexes
CREATE INDEX IF NOT EXISTS idx_media_assets_browse
  ON public.media_assets (site_id, folder, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS media_assets_site_hash_unique
  ON public.media_assets (site_id, content_hash)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_tags
  ON public.media_assets USING gin (tags)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_filename_trgm
  ON public.media_assets USING gin (filename gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_media_assets_deleted
  ON public.media_assets (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_asset_usage_asset
  ON public.media_asset_usage (asset_id);

CREATE INDEX IF NOT EXISTS idx_media_asset_usage_resource
  ON public.media_asset_usage (resource_type, resource_id);

-- §3.6 RLS — media_assets
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_assets_public_read" ON public.media_assets;
CREATE POLICY "media_assets_public_read"
  ON public.media_assets FOR SELECT
  USING (public.site_visible(site_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "media_assets_staff_read_all" ON public.media_assets;
CREATE POLICY "media_assets_staff_read_all"
  ON public.media_assets FOR SELECT
  TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "media_assets_staff_write" ON public.media_assets;
CREATE POLICY "media_assets_staff_write"
  ON public.media_assets
  TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- §3.6 RLS — media_asset_usage (delegates to parent asset's site scope)
ALTER TABLE public.media_asset_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_asset_usage_read" ON public.media_asset_usage;
CREATE POLICY "media_asset_usage_read"
  ON public.media_asset_usage FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.media_assets a
    WHERE a.id = asset_id AND public.can_view_site(a.site_id)
  ));

DROP POLICY IF EXISTS "media_asset_usage_write" ON public.media_asset_usage;
CREATE POLICY "media_asset_usage_write"
  ON public.media_asset_usage
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.media_assets a
    WHERE a.id = asset_id AND public.can_edit_site(a.site_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.media_assets a
    WHERE a.id = asset_id AND public.can_edit_site(a.site_id)
  ));

-- §3.7 Trigger — reuse existing tg_set_updated_at()
DROP TRIGGER IF EXISTS media_assets_set_updated_at ON public.media_assets;
CREATE TRIGGER media_assets_set_updated_at
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
