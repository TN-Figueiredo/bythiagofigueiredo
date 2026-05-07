-- =============================================================================
-- Unified Media System — media_assets + media_asset_usage
-- Sprint 5g — 2026-05-06
--
-- APPENDIX to: docs/superpowers/specs/2026-05-06-unified-media-system-design.md
--
-- This is a REFERENCE migration draft, not yet placed in supabase/migrations/.
-- When ready to deploy, copy to supabase/migrations/YYYYMMDDHHMMSS_media_assets.sql.
-- =============================================================================

-- ─── Extension ───────────────────────────────────────────────────────────────
-- pg_trgm already enabled in squashed schema (20260507000001_schema.sql line 25).
-- Included here for standalone execution safety.
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ─── Enum ────────────────────────────────────────────────────────────────────

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


-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.media_assets (
    id            uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id       uuid NOT NULL,
    blob_url      text NOT NULL,
    blob_pathname text NOT NULL,
    filename      text NOT NULL,
    alt_text      text,
    width         integer,
    height        integer,
    mime_type     text NOT NULL,
    file_size     integer NOT NULL,
    content_hash  text NOT NULL,
    folder        text DEFAULT 'general'::text NOT NULL,
    tags          text[] DEFAULT '{}'::text[] NOT NULL,
    uploaded_by   uuid,
    created_at    timestamptz DEFAULT now() NOT NULL,
    updated_at    timestamptz DEFAULT now() NOT NULL,
    deleted_at    timestamptz,

    CONSTRAINT media_assets_pkey PRIMARY KEY (id),
    CONSTRAINT media_assets_blob_url_https CHECK (blob_url ~ '^https://'),
    CONSTRAINT media_assets_mime_check CHECK (mime_type ~ '^(image|video|application)/.+$'),
    CONSTRAINT media_assets_file_size_check CHECK (file_size > 0 AND file_size <= 10485760),
    CONSTRAINT media_assets_content_hash_check CHECK (content_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT media_assets_folder_check CHECK (folder = ANY (ARRAY[
      'general'::text, 'authors'::text, 'blog'::text,
      'newsletters'::text, 'branding'::text, 'og'::text,
      'ads'::text, 'links'::text
    ])),
    CONSTRAINT media_assets_dimensions_check CHECK (
      (width IS NULL AND height IS NULL)
      OR (width > 0 AND height > 0)
    )
);


CREATE TABLE IF NOT EXISTS public.media_asset_usage (
    id            uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id      uuid NOT NULL,
    resource_type public.media_usage_resource NOT NULL,
    resource_id   uuid NOT NULL,
    field_name    text NOT NULL,
    created_at    timestamptz DEFAULT now() NOT NULL,

    CONSTRAINT media_asset_usage_pkey PRIMARY KEY (id),
    CONSTRAINT media_asset_usage_unique UNIQUE (asset_id, resource_type, resource_id, field_name)
);


-- ─── Foreign Keys ────────────────────────────────────────────────────────────

ALTER TABLE public.media_assets
    ADD CONSTRAINT media_assets_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

ALTER TABLE public.media_assets
    ADD CONSTRAINT media_assets_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.media_asset_usage
    ADD CONSTRAINT media_asset_usage_asset_id_fkey
    FOREIGN KEY (asset_id) REFERENCES public.media_assets(id) ON DELETE CASCADE;


-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- Gallery browse: site + folder + newest first, excluding soft-deleted
CREATE INDEX idx_media_assets_browse
    ON public.media_assets USING btree (site_id, folder, created_at DESC)
    WHERE deleted_at IS NULL;

-- Dedup: prevent duplicate uploads within a site (same content hash)
CREATE UNIQUE INDEX media_assets_site_hash_unique
    ON public.media_assets USING btree (site_id, content_hash)
    WHERE deleted_at IS NULL;

-- Search by tags (GIN for array containment queries)
CREATE INDEX idx_media_assets_tags
    ON public.media_assets USING gin (tags)
    WHERE deleted_at IS NULL;

-- Filename text search for gallery search bar
CREATE INDEX idx_media_assets_filename_trgm
    ON public.media_assets USING gin (filename gin_trgm_ops);

-- Orphan detection: find assets with no usages
CREATE INDEX idx_media_asset_usage_asset
    ON public.media_asset_usage USING btree (asset_id);

-- Reverse lookup: which assets does this resource use?
CREATE INDEX idx_media_asset_usage_resource
    ON public.media_asset_usage USING btree (resource_type, resource_id);

-- Soft-delete candidates: find assets deleted more than N days ago
CREATE INDEX idx_media_assets_deleted
    ON public.media_assets USING btree (deleted_at)
    WHERE deleted_at IS NOT NULL;


-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_asset_usage ENABLE ROW LEVEL SECURITY;

-- Public read: non-deleted assets for visible sites (for <img> on public pages)
DROP POLICY IF EXISTS "media_assets_public_read" ON public.media_assets;
CREATE POLICY "media_assets_public_read"
    ON public.media_assets FOR SELECT
    USING (deleted_at IS NULL AND public.site_visible(site_id));

-- Staff read all: editors/admins see everything including soft-deleted (gallery)
DROP POLICY IF EXISTS "media_assets_staff_read_all" ON public.media_assets;
CREATE POLICY "media_assets_staff_read_all"
    ON public.media_assets FOR SELECT TO authenticated
    USING (public.can_view_site(site_id));

-- Staff write: editors/admins can insert, update, soft-delete
DROP POLICY IF EXISTS "media_assets_staff_write" ON public.media_assets;
CREATE POLICY "media_assets_staff_write"
    ON public.media_assets TO authenticated
    USING (public.can_edit_site(site_id))
    WITH CHECK (public.can_edit_site(site_id));

-- Usage: staff can manage usage records for their sites
DROP POLICY IF EXISTS "media_asset_usage_staff_rw" ON public.media_asset_usage;
CREATE POLICY "media_asset_usage_staff_rw"
    ON public.media_asset_usage TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.media_assets a
      WHERE a.id = media_asset_usage.asset_id
        AND public.can_edit_site(a.site_id)
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.media_assets a
      WHERE a.id = media_asset_usage.asset_id
        AND public.can_edit_site(a.site_id)
    ));

-- Usage: public read for joins on public pages
DROP POLICY IF EXISTS "media_asset_usage_public_read" ON public.media_asset_usage;
CREATE POLICY "media_asset_usage_public_read"
    ON public.media_asset_usage FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.media_assets a
      WHERE a.id = media_asset_usage.asset_id
        AND a.deleted_at IS NULL
        AND public.site_visible(a.site_id)
    ));


-- ─── Trigger ─────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS media_assets_set_updated_at ON public.media_assets;
CREATE TRIGGER media_assets_set_updated_at
    BEFORE UPDATE ON public.media_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_set_updated_at();


-- ─── LGPD: Phase 1 cleanup extension ────────────────────────────────────────
-- The existing lgpd_phase1_cleanup RPC must be updated to include:
--
--   UPDATE media_assets SET uploaded_by = NULL WHERE uploaded_by = p_user_id;
--
-- This severs the PII link (who uploaded it) while keeping the asset for
-- published content. Follows the same pattern as audit_log.actor_user_id
-- nullification already in the RPC.
-- The FK (uploaded_by → auth.users ON DELETE SET NULL) also handles Phase 3
-- automatically when auth.admin.deleteUser() runs.
