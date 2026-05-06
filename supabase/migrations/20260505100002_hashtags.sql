-- Hashtags: freeform tags separate from blog_tags (categories)

CREATE TABLE IF NOT EXISTS hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, slug)
);

CREATE TABLE IF NOT EXISTS post_hashtags (
  post_id uuid NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  hashtag_id uuid NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, hashtag_id)
);

CREATE INDEX IF NOT EXISTS hashtags_slug_idx ON hashtags(slug);
CREATE INDEX IF NOT EXISTS post_hashtags_hashtag_idx ON post_hashtags(hashtag_id);

-- RLS
ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_hashtags ENABLE ROW LEVEL SECURITY;

-- hashtags: public read via site_visible, staff write
DROP POLICY IF EXISTS "hashtags_public_read" ON hashtags;
CREATE POLICY "hashtags_public_read" ON hashtags
  FOR SELECT USING (public.site_visible(site_id));

DROP POLICY IF EXISTS "hashtags_staff_write" ON hashtags;
CREATE POLICY "hashtags_staff_write" ON hashtags
  FOR ALL USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- post_hashtags: public read via post's site_id, staff write
DROP POLICY IF EXISTS "post_hashtags_public_read" ON post_hashtags;
CREATE POLICY "post_hashtags_public_read" ON post_hashtags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM blog_posts bp
      WHERE bp.id = post_id AND public.site_visible(bp.site_id)
    )
  );

DROP POLICY IF EXISTS "post_hashtags_staff_write" ON post_hashtags;
CREATE POLICY "post_hashtags_staff_write" ON post_hashtags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM blog_posts bp
      WHERE bp.id = post_id AND public.can_edit_site(bp.site_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM blog_posts bp
      WHERE bp.id = post_id AND public.can_edit_site(bp.site_id)
    )
  );
