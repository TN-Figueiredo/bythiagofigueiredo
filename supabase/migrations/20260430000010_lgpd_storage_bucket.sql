INSERT INTO storage.buckets (id, name, public)
VALUES ('lgpd-exports', 'lgpd-exports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "lgpd_exports_own_select" ON storage.objects;
CREATE POLICY "lgpd_exports_own_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lgpd-exports' AND name LIKE auth.uid()::text || '/%');

DROP POLICY IF EXISTS "lgpd_exports_service_insert" ON storage.objects;
CREATE POLICY "lgpd_exports_service_insert" ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'lgpd-exports');

DROP POLICY IF EXISTS "lgpd_exports_service_delete" ON storage.objects;
CREATE POLICY "lgpd_exports_service_delete" ON storage.objects FOR DELETE TO service_role
USING (bucket_id = 'lgpd-exports');
