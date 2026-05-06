-- Sprint 5f: link tracker schema fixes
-- 1. FK constraints for non-partitioned child tables → tracked_links
-- 2. Fix hourly_clicks default (was '{}', should be 24-element array)
-- 3. link-assets storage bucket for QR SVGs / PNGs

-- ─── 1. Foreign key constraints ───
-- link_clicks is partitioned — PG does not support FK on partitioned tables, skip.

ALTER TABLE link_annotations
  ADD CONSTRAINT fk_link_annotations_link
  FOREIGN KEY (link_id) REFERENCES tracked_links(id) ON DELETE CASCADE;

ALTER TABLE link_goals
  ADD CONSTRAINT fk_link_goals_link
  FOREIGN KEY (link_id) REFERENCES tracked_links(id) ON DELETE CASCADE;

ALTER TABLE link_alerts
  ADD CONSTRAINT fk_link_alerts_link
  FOREIGN KEY (link_id) REFERENCES tracked_links(id) ON DELETE CASCADE;

ALTER TABLE link_daily_metrics
  ADD CONSTRAINT fk_link_daily_metrics_link
  FOREIGN KEY (link_id) REFERENCES tracked_links(id) ON DELETE CASCADE;

-- ─── 2. Fix hourly_clicks default ───
-- Should be a 24-element array (one per hour), not empty object.
ALTER TABLE link_daily_metrics
  ALTER COLUMN hourly_clicks SET DEFAULT '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]'::jsonb;

-- ─── 3. link-assets storage bucket ───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'link-assets',
  'link-assets',
  true,
  1048576,  -- 1 MB
  ARRAY['image/svg+xml', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "link_assets_public_read" ON storage.objects;
CREATE POLICY "link_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'link-assets');

-- Service role insert
DROP POLICY IF EXISTS "link_assets_service_insert" ON storage.objects;
CREATE POLICY "link_assets_service_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'link-assets');

-- Service role update
DROP POLICY IF EXISTS "link_assets_service_update" ON storage.objects;
CREATE POLICY "link_assets_service_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'link-assets');

-- Service role delete
DROP POLICY IF EXISTS "link_assets_service_delete" ON storage.objects;
CREATE POLICY "link_assets_service_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'link-assets');
