-- Public bucket for author avatar images.
-- Public so that avatar URLs render on the site without signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'author-avatars',
  'author-avatars',
  true,
  2097152,  -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Staff can upload/update/delete avatars.
DROP POLICY IF EXISTS "author-avatars staff write" ON storage.objects;
CREATE POLICY "author-avatars staff write"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'author-avatars' AND public.is_staff())
  WITH CHECK (bucket_id = 'author-avatars' AND public.is_staff());

-- Anyone can read (public bucket, needed for <img> on public pages).
DROP POLICY IF EXISTS "author-avatars public read" ON storage.objects;
CREATE POLICY "author-avatars public read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'author-avatars');
