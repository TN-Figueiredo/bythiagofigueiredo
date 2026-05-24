-- =============================================================================
-- playlist_snapshots improvements: cleanup RPC, safer restore, dedup pre_destructive
-- =============================================================================

-- 1. Cleanup RPC: efficiently delete excess auto-snapshots per playlist in one query
CREATE OR REPLACE FUNCTION public.cleanup_excess_auto_snapshots(
  p_max_per_playlist INT DEFAULT 100
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY playlist_id
             ORDER BY created_at DESC
           ) AS rn
    FROM playlist_snapshots
    WHERE type = 'auto'
  ),
  excess AS (
    DELETE FROM playlist_snapshots
    WHERE id IN (SELECT id FROM ranked WHERE rn > p_max_per_playlist)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM excess;

  RETURN v_deleted;
END;
$$;

-- 2. Improve restore: skip items whose content references were deleted since snapshot
CREATE OR REPLACE FUNCTION public.restore_playlist_snapshot(
  p_playlist_id UUID,
  p_snapshot_id UUID,
  p_mode TEXT DEFAULT 'full'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot RECORD;
BEGIN
  IF p_mode NOT IN ('full', 'edges_only', 'positions_only') THEN
    RAISE EXCEPTION 'Invalid restore mode: %', p_mode;
  END IF;

  SELECT * INTO v_snapshot
    FROM playlist_snapshots
   WHERE id = p_snapshot_id
     AND playlist_id = p_playlist_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snapshot not found or does not belong to playlist';
  END IF;

  IF NOT can_edit_site(v_snapshot.site_id) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_mode = 'full' THEN
    DELETE FROM playlist_edges WHERE playlist_id = p_playlist_id;
    DELETE FROM playlist_items WHERE playlist_id = p_playlist_id;

    INSERT INTO playlist_items (
      id, playlist_id, blog_post_id, newsletter_edition_id,
      pipeline_id, sort_order, position_x, position_y
    )
    SELECT
      (item->>'id')::uuid,
      p_playlist_id,
      (item->>'blog_post_id')::uuid,
      (item->>'newsletter_edition_id')::uuid,
      (item->>'pipeline_id')::uuid,
      (item->>'sort_order')::int,
      (item->>'position_x')::float,
      (item->>'position_y')::float
    FROM jsonb_array_elements(v_snapshot.graph_data->'items') AS item
    WHERE (
      (item->>'blog_post_id' IS NULL OR EXISTS (SELECT 1 FROM blog_posts WHERE id = (item->>'blog_post_id')::uuid))
      AND (item->>'newsletter_edition_id' IS NULL OR EXISTS (SELECT 1 FROM newsletter_editions WHERE id = (item->>'newsletter_edition_id')::uuid))
      AND (item->>'pipeline_id' IS NULL OR EXISTS (SELECT 1 FROM pipelines WHERE id = (item->>'pipeline_id')::uuid))
    );

    INSERT INTO playlist_edges (
      id, playlist_id, source_item_id, target_item_id, edge_type, label
    )
    SELECT
      (edge->>'id')::uuid,
      p_playlist_id,
      (edge->>'source_item_id')::uuid,
      (edge->>'target_item_id')::uuid,
      edge->>'edge_type',
      edge->>'label'
    FROM jsonb_array_elements(v_snapshot.graph_data->'edges') AS edge
    WHERE (edge->>'source_item_id')::uuid IN (
      SELECT id FROM playlist_items WHERE playlist_id = p_playlist_id
    )
    AND (edge->>'target_item_id')::uuid IN (
      SELECT id FROM playlist_items WHERE playlist_id = p_playlist_id
    )
    ON CONFLICT DO NOTHING;

  ELSIF p_mode = 'edges_only' THEN
    DELETE FROM playlist_edges WHERE playlist_id = p_playlist_id;

    INSERT INTO playlist_edges (
      id, playlist_id, source_item_id, target_item_id, edge_type, label
    )
    SELECT
      (edge->>'id')::uuid,
      p_playlist_id,
      (edge->>'source_item_id')::uuid,
      (edge->>'target_item_id')::uuid,
      edge->>'edge_type',
      edge->>'label'
    FROM jsonb_array_elements(v_snapshot.graph_data->'edges') AS edge
    WHERE (edge->>'source_item_id')::uuid IN (
      SELECT id FROM playlist_items WHERE playlist_id = p_playlist_id
    )
    AND (edge->>'target_item_id')::uuid IN (
      SELECT id FROM playlist_items WHERE playlist_id = p_playlist_id
    );

  ELSIF p_mode = 'positions_only' THEN
    UPDATE playlist_items pi
    SET
      position_x = (item->>'position_x')::float,
      position_y = (item->>'position_y')::float,
      sort_order = (item->>'sort_order')::int
    FROM jsonb_array_elements(v_snapshot.graph_data->'items') AS item
    WHERE pi.playlist_id = p_playlist_id
      AND pi.id = (item->>'id')::uuid;
  END IF;
END;
$$;

-- 3. Restrict cleanup RPC to service_role only (cron calls with service key)
REVOKE EXECUTE ON FUNCTION public.cleanup_excess_auto_snapshots(INT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_excess_auto_snapshots(INT) TO service_role;

-- 4. Dedup index for pre_destructive (prevents snapshot storms on rapid deletions)
DROP INDEX IF EXISTS idx_snapshots_dedup_pre_destructive;
CREATE UNIQUE INDEX idx_snapshots_dedup_pre_destructive
  ON public.playlist_snapshots (playlist_id, content_hash)
  WHERE type = 'pre_destructive';
