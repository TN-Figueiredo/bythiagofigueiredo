-- Create newsletter-assets storage bucket for image uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'newsletter-assets',
  'newsletter-assets',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: staff can upload
DROP POLICY IF EXISTS "staff_upload_newsletter_assets" ON storage.objects;
CREATE POLICY "staff_upload_newsletter_assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'newsletter-assets' AND public.is_member_staff());

-- RLS: public can read (images are in newsletters)
DROP POLICY IF EXISTS "public_read_newsletter_assets" ON storage.objects;
CREATE POLICY "public_read_newsletter_assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'newsletter-assets');

-- RLS: staff can delete
DROP POLICY IF EXISTS "staff_delete_newsletter_assets" ON storage.objects;
CREATE POLICY "staff_delete_newsletter_assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'newsletter-assets' AND public.is_member_staff());
