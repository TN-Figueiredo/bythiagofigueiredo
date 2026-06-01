-- P6: Thumbnail Intelligence v0 — Library + Longevity
CREATE TABLE IF NOT EXISTS thumbnail_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  source_test_id uuid REFERENCES ab_tests(id) ON DELETE SET NULL,
  source_variant_id uuid REFERENCES ab_test_variants(id) ON DELETE SET NULL,
  source_type text NOT NULL DEFAULT 'test_winner' CHECK (source_type IN ('test_winner', 'manual_upload', 'competitor_bookmark')),
  blob_url text NOT NULL,
  title text,
  tags text[] DEFAULT '{}',
  video_title text,
  youtube_video_id text,
  ctr_at_win numeric(6,4),
  lift_at_win numeric(6,2),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS thumbnail_longevity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL REFERENCES thumbnail_library(id) ON DELETE CASCADE,
  checkpoint_days integer NOT NULL CHECK (checkpoint_days IN (7, 30, 60, 90)),
  ctr_at_checkpoint numeric(6,4),
  ctr_at_win numeric(6,4),
  change_percent numeric(6,2),
  status text NOT NULL CHECK (status IN ('holding', 'fading', 'growing')),
  checked_at timestamptz DEFAULT now(),
  UNIQUE (library_id, checkpoint_days)
);

CREATE INDEX IF NOT EXISTS idx_thumbnail_library_site ON thumbnail_library (site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_thumbnail_longevity_library ON thumbnail_longevity (library_id);

-- RLS
ALTER TABLE thumbnail_library ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "thumbnail_library_select" ON thumbnail_library;
CREATE POLICY "thumbnail_library_select" ON thumbnail_library FOR SELECT USING (public.can_view_site(site_id));
DROP POLICY IF EXISTS "thumbnail_library_insert" ON thumbnail_library;
CREATE POLICY "thumbnail_library_insert" ON thumbnail_library FOR INSERT WITH CHECK (public.can_edit_site(site_id));
DROP POLICY IF EXISTS "thumbnail_library_update" ON thumbnail_library;
CREATE POLICY "thumbnail_library_update" ON thumbnail_library FOR UPDATE USING (public.can_edit_site(site_id));
DROP POLICY IF EXISTS "thumbnail_library_delete" ON thumbnail_library;
CREATE POLICY "thumbnail_library_delete" ON thumbnail_library FOR DELETE USING (public.can_edit_site(site_id));

ALTER TABLE thumbnail_longevity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "thumbnail_longevity_select" ON thumbnail_longevity;
CREATE POLICY "thumbnail_longevity_select" ON thumbnail_longevity FOR SELECT
  USING (EXISTS (SELECT 1 FROM thumbnail_library tl WHERE tl.id = library_id AND public.can_view_site(tl.site_id)));
