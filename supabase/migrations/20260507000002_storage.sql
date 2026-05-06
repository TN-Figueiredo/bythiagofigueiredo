-- =============================================================================
-- 0002_storage.sql — Storage buckets + object policies.
-- Extracted from 6 original migrations. Not captured by `db dump --schema public`.
-- =============================================================================

-- ─── 1. Buckets ───

INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-files', 'campaign-files', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('content-files', 'content-files', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('lgpd-exports', 'lgpd-exports', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'newsletter-assets', 'newsletter-assets', true,
  5242880, ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'author-avatars', 'author-avatars', true,
  2097152, ARRAY['image/jpeg','image/png','image/webp']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'link-assets', 'link-assets', true,
  1048576, ARRAY['image/svg+xml','image/png']
) ON CONFLICT (id) DO NOTHING;

-- ─── 2. Storage policies ───

-- campaign-files: staff all
DROP POLICY IF EXISTS "campaign-files staff all" ON storage.objects;
CREATE POLICY "campaign-files staff all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'campaign-files' AND public.is_staff())
  WITH CHECK (bucket_id = 'campaign-files' AND public.is_staff());

-- content-files: staff all
DROP POLICY IF EXISTS "content-files staff all" ON storage.objects;
CREATE POLICY "content-files staff all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'content-files' AND public.is_staff())
  WITH CHECK (bucket_id = 'content-files' AND public.is_staff());

-- lgpd-exports: own select + service insert/delete
DROP POLICY IF EXISTS "lgpd_exports_own_select" ON storage.objects;
CREATE POLICY "lgpd_exports_own_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lgpd-exports' AND name LIKE auth.uid()::text || '/%');

DROP POLICY IF EXISTS "lgpd_exports_service_insert" ON storage.objects;
CREATE POLICY "lgpd_exports_service_insert" ON storage.objects FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'lgpd-exports');

DROP POLICY IF EXISTS "lgpd_exports_service_delete" ON storage.objects;
CREATE POLICY "lgpd_exports_service_delete" ON storage.objects FOR DELETE TO service_role
  USING (bucket_id = 'lgpd-exports');

-- newsletter-assets: staff upload, public read, staff delete
DROP POLICY IF EXISTS "staff_upload_newsletter_assets" ON storage.objects;
CREATE POLICY "staff_upload_newsletter_assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'newsletter-assets' AND public.is_member_staff());

DROP POLICY IF EXISTS "public_read_newsletter_assets" ON storage.objects;
CREATE POLICY "public_read_newsletter_assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'newsletter-assets');

DROP POLICY IF EXISTS "staff_delete_newsletter_assets" ON storage.objects;
CREATE POLICY "staff_delete_newsletter_assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'newsletter-assets' AND public.is_member_staff());

-- author-avatars: staff write, public read
DROP POLICY IF EXISTS "author-avatars staff write" ON storage.objects;
CREATE POLICY "author-avatars staff write"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'author-avatars' AND public.is_staff())
  WITH CHECK (bucket_id = 'author-avatars' AND public.is_staff());

DROP POLICY IF EXISTS "author-avatars public read" ON storage.objects;
CREATE POLICY "author-avatars public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'author-avatars');

-- link-assets: public read, service insert/update/delete
DROP POLICY IF EXISTS "link_assets_public_read" ON storage.objects;
CREATE POLICY "link_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'link-assets');

DROP POLICY IF EXISTS "link_assets_service_insert" ON storage.objects;
CREATE POLICY "link_assets_service_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'link-assets');

DROP POLICY IF EXISTS "link_assets_service_update" ON storage.objects;
CREATE POLICY "link_assets_service_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'link-assets');

DROP POLICY IF EXISTS "link_assets_service_delete" ON storage.objects;
CREATE POLICY "link_assets_service_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'link-assets');
