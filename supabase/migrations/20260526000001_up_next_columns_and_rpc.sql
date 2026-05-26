-- =============================================================================
-- MIGRATION: Up Next command center columns + assign_week_slot RPC
-- =============================================================================

ALTER TABLE content_pipeline ADD COLUMN IF NOT EXISTS
  duration_target integer;

ALTER TABLE content_pipeline ADD COLUMN IF NOT EXISTS
  youtube_channel_id uuid REFERENCES youtube_channels(id) ON DELETE SET NULL;

ALTER TABLE content_pipeline ADD COLUMN IF NOT EXISTS
  scheduled_at timestamptz;

DROP FUNCTION IF EXISTS assign_week_slot(uuid, date, text);
CREATE OR REPLACE FUNCTION assign_week_slot(
  p_item_id uuid,
  p_slot_day date,
  p_slot_hour text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  IF NOT is_staff() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  UPDATE content_pipeline
  SET scheduled_at = p_slot_day + COALESCE(p_slot_hour::time, '00:00'::time),
      updated_at = NOW()
  WHERE id = p_item_id
    AND site_id = (current_setting('app.site_id'))::uuid
  RETURNING json_build_object('id', id, 'scheduled_at', scheduled_at) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public';
