-- YouTube tables: categories, channels, videos, curated_comments, sync_log

-- ─── youtube_categories ───
CREATE TABLE IF NOT EXISTS youtube_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id),
  slug text NOT NULL,
  name_pt text NOT NULL,
  name_en text NOT NULL,
  description_pt text,
  description_en text,
  color text NOT NULL DEFAULT '#FF8240',
  sort_order int NOT NULL DEFAULT 0,
  match_keywords text[] NOT NULL DEFAULT '{}',
  auto_approve boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, slug)
);

ALTER TABLE youtube_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "youtube_categories_public_read" ON youtube_categories;
CREATE POLICY "youtube_categories_public_read" ON youtube_categories
  FOR SELECT USING (public.site_visible(site_id));

DROP POLICY IF EXISTS "youtube_categories_staff_write" ON youtube_categories;
CREATE POLICY "youtube_categories_staff_write" ON youtube_categories
  FOR ALL TO authenticated USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ─── youtube_channels ───
CREATE TABLE IF NOT EXISTS youtube_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id),
  channel_id text NOT NULL,
  locale text NOT NULL CHECK (locale IN ('pt', 'en')),
  handle text NOT NULL,
  name text NOT NULL,
  description text,
  uploads_playlist_id text NOT NULL,
  subscriber_count int NOT NULL DEFAULT 0,
  video_count int NOT NULL DEFAULT 0,
  thumbnail_url text,
  banner_url text,
  custom_url text,
  sync_enabled boolean NOT NULL DEFAULT true,
  sync_schedules jsonb NOT NULL DEFAULT '[]',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, channel_id),
  UNIQUE(site_id, locale)
);

ALTER TABLE youtube_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "youtube_channels_public_read" ON youtube_channels;
CREATE POLICY "youtube_channels_public_read" ON youtube_channels
  FOR SELECT USING (public.site_visible(site_id));

DROP POLICY IF EXISTS "youtube_channels_staff_write" ON youtube_channels;
CREATE POLICY "youtube_channels_staff_write" ON youtube_channels
  FOR ALL TO authenticated USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ─── youtube_videos ───
CREATE TABLE IF NOT EXISTS youtube_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id),
  channel_id uuid NOT NULL REFERENCES youtube_channels(id),
  youtube_video_id text NOT NULL,
  title text NOT NULL,
  title_translation text,
  description text,
  description_translation text,
  duration text NOT NULL DEFAULT '0:00',
  duration_seconds int NOT NULL DEFAULT 0,
  published_at timestamptz NOT NULL,
  thumbnail_url text,
  thumbnail_hq_url text,
  tags text[] NOT NULL DEFAULT '{}',
  view_count int NOT NULL DEFAULT 0,
  like_count int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  category_id uuid REFERENCES youtube_categories(id) ON DELETE SET NULL,
  auto_suggested_category_id uuid REFERENCES youtube_categories(id) ON DELETE SET NULL,
  is_featured boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  cms_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, youtube_video_id)
);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_published ON youtube_videos(site_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel ON youtube_videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_category ON youtube_videos(category_id);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_featured ON youtube_videos(site_id, is_featured) WHERE is_featured = true;

ALTER TABLE youtube_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "youtube_videos_public_read" ON youtube_videos;
CREATE POLICY "youtube_videos_public_read" ON youtube_videos
  FOR SELECT USING (public.site_visible(site_id) AND is_hidden = false);

DROP POLICY IF EXISTS "youtube_videos_staff_read_all" ON youtube_videos;
CREATE POLICY "youtube_videos_staff_read_all" ON youtube_videos
  FOR SELECT TO authenticated USING (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "youtube_videos_staff_write" ON youtube_videos;
CREATE POLICY "youtube_videos_staff_write" ON youtube_videos
  FOR ALL TO authenticated USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ─── youtube_curated_comments ───
CREATE TABLE IF NOT EXISTS youtube_curated_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id),
  video_id uuid NOT NULL REFERENCES youtube_videos(id) ON DELETE CASCADE,
  author_handle text NOT NULL,
  author_avatar_url text,
  text_pt text NOT NULL,
  text_en text NOT NULL,
  like_count int NOT NULL DEFAULT 0,
  display_order int NOT NULL DEFAULT 0,
  target_locale text CHECK (target_locale IS NULL OR target_locale IN ('pt', 'en')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curated_comments_locale ON youtube_curated_comments(site_id, target_locale);

ALTER TABLE youtube_curated_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "youtube_curated_comments_public_read" ON youtube_curated_comments;
CREATE POLICY "youtube_curated_comments_public_read" ON youtube_curated_comments
  FOR SELECT USING (public.site_visible(site_id));

DROP POLICY IF EXISTS "youtube_curated_comments_staff_write" ON youtube_curated_comments;
CREATE POLICY "youtube_curated_comments_staff_write" ON youtube_curated_comments
  FOR ALL TO authenticated USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ─── youtube_sync_log ───
CREATE TABLE IF NOT EXISTS youtube_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id),
  channel_id uuid REFERENCES youtube_channels(id),
  mode text NOT NULL CHECK (mode IN ('schedule', 'catchall', 'metrics', 'manual')),
  status text NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'skipped')),
  videos_found int NOT NULL DEFAULT 0,
  videos_inserted int NOT NULL DEFAULT 0,
  videos_updated int NOT NULL DEFAULT 0,
  error_message text,
  quota_used int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_recent ON youtube_sync_log(site_id, created_at DESC);

ALTER TABLE youtube_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "youtube_sync_log_staff_read" ON youtube_sync_log;
CREATE POLICY "youtube_sync_log_staff_read" ON youtube_sync_log
  FOR SELECT TO authenticated USING (public.can_edit_site(site_id));
