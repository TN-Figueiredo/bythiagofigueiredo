CREATE TABLE youtube_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  channel_id  UUID NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  text        TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 5000),
  is_bot      BOOLEAN NOT NULL DEFAULT false,
  source      TEXT CHECK (source IS NULL OR source IN ('manual', 'cowork', 'cron')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_youtube_notes_channel ON youtube_notes (site_id, channel_id, created_at DESC);

ALTER TABLE youtube_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "youtube_notes_select" ON youtube_notes;
CREATE POLICY "youtube_notes_select" ON youtube_notes FOR SELECT USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "youtube_notes_insert" ON youtube_notes;
CREATE POLICY "youtube_notes_insert" ON youtube_notes FOR INSERT WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "youtube_notes_delete" ON youtube_notes;
CREATE POLICY "youtube_notes_delete" ON youtube_notes FOR DELETE USING (public.can_edit_site(site_id));
