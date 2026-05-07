-- =============================================================================
-- 20260507000006_media_orphan_rpcs.sql
-- Sprint 5g hardening — RPCs for orphan detection used by cron + health.
-- =============================================================================

-- Count orphan media_assets (no usage references, not soft-deleted)
CREATE OR REPLACE FUNCTION public.count_orphan_media_assets(p_site_id uuid)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM media_assets ma
  WHERE ma.site_id = p_site_id
    AND ma.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM media_asset_usage mau WHERE mau.asset_id = ma.id
    );
$$;

-- Find orphan asset IDs older than grace period (for cron soft-delete)
CREATE OR REPLACE FUNCTION public.find_orphan_media_assets(p_grace_days int DEFAULT 7)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ma.id
  FROM media_assets ma
  WHERE ma.deleted_at IS NULL
    AND ma.created_at < (now() - (p_grace_days || ' days')::interval)
    AND NOT EXISTS (
      SELECT 1 FROM media_asset_usage mau WHERE mau.asset_id = ma.id
    );
$$;

-- Split write policy: staff can INSERT + UPDATE but NOT hard-DELETE
DROP POLICY IF EXISTS "media_assets_staff_write" ON public.media_assets;

CREATE POLICY "media_assets_staff_insert"
  ON public.media_assets FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_site(site_id));

CREATE POLICY "media_assets_staff_update"
  ON public.media_assets FOR UPDATE
  TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));
