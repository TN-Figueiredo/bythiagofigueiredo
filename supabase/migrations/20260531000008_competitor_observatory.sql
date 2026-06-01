-- P5: Competitor Observatory v0
CREATE TABLE IF NOT EXISTS competitor_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  channel_name text NOT NULL DEFAULT '',
  thumbnail_url text,
  subscriber_count integer,
  added_at timestamptz DEFAULT now(),
  last_synced_at timestamptz,
  UNIQUE (site_id, channel_id)
);

CREATE TABLE IF NOT EXISTS competitor_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_channel_id uuid NOT NULL REFERENCES competitor_channels(id) ON DELETE CASCADE,
  video_id text NOT NULL UNIQUE,
  title text,
  description_hash text,
  thumbnail_url text,
  view_count bigint DEFAULT 0,
  published_at timestamptz,
  last_checked_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competitor_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES competitor_videos(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  change_type text NOT NULL CHECK (change_type IN ('title', 'description', 'thumbnail')),
  old_title text,
  new_title text,
  old_thumbnail_url text,
  new_thumbnail_url text,
  view_count_at_change bigint,
  detected_at timestamptz DEFAULT now(),
  bookmarked boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_competitor_channels_site ON competitor_channels (site_id);
CREATE INDEX IF NOT EXISTS idx_competitor_videos_channel ON competitor_videos (competitor_channel_id, last_checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_changes_site ON competitor_changes (site_id, detected_at DESC);

-- RLS
ALTER TABLE competitor_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "competitor_channels_select" ON competitor_channels;
CREATE POLICY "competitor_channels_select" ON competitor_channels FOR SELECT USING (public.can_view_site(site_id));
DROP POLICY IF EXISTS "competitor_channels_insert" ON competitor_channels;
CREATE POLICY "competitor_channels_insert" ON competitor_channels FOR INSERT WITH CHECK (public.can_edit_site(site_id));
DROP POLICY IF EXISTS "competitor_channels_delete" ON competitor_channels;
CREATE POLICY "competitor_channels_delete" ON competitor_channels FOR DELETE USING (public.can_edit_site(site_id));

ALTER TABLE competitor_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "competitor_videos_select" ON competitor_videos;
CREATE POLICY "competitor_videos_select" ON competitor_videos FOR SELECT
  USING (EXISTS (SELECT 1 FROM competitor_channels cc WHERE cc.id = competitor_channel_id AND public.can_view_site(cc.site_id)));

ALTER TABLE competitor_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "competitor_changes_select" ON competitor_changes;
CREATE POLICY "competitor_changes_select" ON competitor_changes FOR SELECT USING (public.can_view_site(site_id));
DROP POLICY IF EXISTS "competitor_changes_update" ON competitor_changes;
CREATE POLICY "competitor_changes_update" ON competitor_changes FOR UPDATE USING (public.can_edit_site(site_id));
