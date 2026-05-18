-- =============================================================================
-- Links Engine A++ Data Migration
-- Normalizes existing UTM data via triggers, adds batch_extend_link_expiry RPC
-- =============================================================================

-- 1. Backup original UTM values before normalization (rollback safety)
ALTER TABLE tracked_links ADD COLUMN IF NOT EXISTS _utm_backup jsonb;
UPDATE tracked_links SET _utm_backup = jsonb_build_object(
  'utm_source', utm_source, 'utm_medium', utm_medium,
  'utm_campaign', utm_campaign, 'utm_term', utm_term,
  'utm_content', utm_content
) WHERE utm_source IS NOT NULL OR utm_medium IS NOT NULL
   OR utm_campaign IS NOT NULL OR utm_term IS NOT NULL
   OR utm_content IS NOT NULL;

-- 2. Normalize existing data (triggers fire on UPDATE)
UPDATE tracked_links SET utm_source = utm_source
WHERE utm_source IS NOT NULL OR utm_medium IS NOT NULL
   OR utm_campaign IS NOT NULL OR utm_term IS NOT NULL
   OR utm_content IS NOT NULL;

UPDATE link_utm_presets SET utm_source = utm_source
WHERE utm_source IS NOT NULL OR utm_medium IS NOT NULL
   OR utm_campaign IS NOT NULL OR utm_term IS NOT NULL
   OR utm_content IS NOT NULL;

-- NOTE: link_clicks (partitioned, append-only) is NOT backfilled.

-- 3. Batch operations RPC (with authorization guard)
CREATE OR REPLACE FUNCTION public.batch_extend_link_expiry(
  p_site_id uuid, p_campaign text DEFAULT NULL,
  p_tags text[] DEFAULT NULL, p_hours integer DEFAULT 24
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.can_edit_site(p_site_id) THEN
    RAISE EXCEPTION 'forbidden: caller cannot edit site %', p_site_id;
  END IF;

  UPDATE tracked_links
  SET expires_at = COALESCE(expires_at, now()) + (p_hours || ' hours')::interval,
      updated_at = now()
  WHERE site_id = p_site_id AND deleted_at IS NULL AND active = true
    AND expires_at IS NOT NULL
    AND (p_campaign IS NULL OR utm_campaign = p_campaign)
    AND (p_tags IS NULL OR tags && p_tags);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

-- 4. Drop _utm_backup after 2 weeks (separate future migration)
-- npm run db:new drop_utm_backup
-- ALTER TABLE tracked_links DROP COLUMN IF EXISTS _utm_backup;
