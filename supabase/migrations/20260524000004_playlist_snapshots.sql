-- playlist_snapshots: persistent version history for playlist canvas
CREATE TABLE public.playlist_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id   UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  site_id       UUID NOT NULL REFERENCES sites(id),
  type          TEXT NOT NULL CHECK (type IN ('auto','manual','pre_destructive','session_start')),
  label         TEXT,
  graph_data    JSONB NOT NULL,
  stats         JSONB NOT NULL DEFAULT '{}',
  content_hash  TEXT NOT NULL,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ
);

-- Primary lookup: list snapshots for a playlist, newest first
CREATE INDEX idx_snapshots_playlist
  ON public.playlist_snapshots (playlist_id, created_at DESC);

-- Cron cleanup: find expired snapshots efficiently
CREATE INDEX idx_snapshots_expires
  ON public.playlist_snapshots (expires_at)
  WHERE expires_at IS NOT NULL;

-- Deduplication: prevent storing identical consecutive auto-snapshots
CREATE UNIQUE INDEX idx_snapshots_dedup
  ON public.playlist_snapshots (playlist_id, content_hash)
  WHERE type = 'auto';

-- RLS
ALTER TABLE public.playlist_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_manage_snapshots ON public.playlist_snapshots;
CREATE POLICY staff_manage_snapshots ON public.playlist_snapshots
  FOR ALL
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- Restore RPC
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
    FROM jsonb_array_elements(v_snapshot.graph_data->'items') AS item;

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
