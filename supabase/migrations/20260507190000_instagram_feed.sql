-- Instagram Feed Integration
-- Mirrors YouTube-mirror pattern: accounts, posts, feed_slots, sync_log

-- ── Tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.instagram_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  locale          text NOT NULL DEFAULT 'pt',
  handle          text NOT NULL,
  ig_user_id      text,
  access_token    text,
  token_expires_at timestamptz,
  sync_enabled    boolean NOT NULL DEFAULT true,
  display_slots   int NOT NULL DEFAULT 6,
  layout_type     text NOT NULL DEFAULT 'grid',
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT instagram_accounts_display_slots_check
    CHECK (display_slots >= 1 AND display_slots <= 12),
  CONSTRAINT instagram_accounts_layout_type_check
    CHECK (layout_type IN ('grid', 'scatter')),
  CONSTRAINT instagram_accounts_locale_check
    CHECK (locale IN ('pt', 'en')),
  CONSTRAINT instagram_accounts_site_locale_key
    UNIQUE (site_id, locale)
);

CREATE TABLE IF NOT EXISTS public.instagram_posts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  ig_media_id      text NOT NULL,
  media_type       text NOT NULL,
  media_url        text,
  thumbnail_url    text,
  cached_image_url text,
  caption          text,
  permalink        text NOT NULL,
  like_count       int NOT NULL DEFAULT 0,
  comments_count   int NOT NULL DEFAULT 0,
  ig_timestamp     timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT instagram_posts_media_type_check
    CHECK (media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL_ALBUM')),
  CONSTRAINT instagram_posts_ig_media_id_key
    UNIQUE (ig_media_id)
);

CREATE INDEX idx_instagram_posts_account_ts
  ON public.instagram_posts (account_id, ig_timestamp DESC);

CREATE TABLE IF NOT EXISTS public.instagram_feed_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  position    int NOT NULL,
  post_id     uuid REFERENCES public.instagram_posts(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT instagram_feed_slots_position_check
    CHECK (position >= 1 AND position <= 12),
  CONSTRAINT instagram_feed_slots_account_position_key
    UNIQUE (account_id, position)
);

CREATE TABLE IF NOT EXISTS public.instagram_sync_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  account_id     uuid REFERENCES public.instagram_accounts(id) ON DELETE SET NULL,
  mode           text NOT NULL,
  status         text NOT NULL,
  posts_found    int NOT NULL DEFAULT 0,
  posts_inserted int NOT NULL DEFAULT 0,
  posts_updated  int NOT NULL DEFAULT 0,
  media_cached   int NOT NULL DEFAULT 0,
  error_message  text,
  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT instagram_sync_log_mode_check
    CHECK (mode IN ('daily', 'manual', 'token_refresh')),
  CONSTRAINT instagram_sync_log_status_check
    CHECK (status IN ('started', 'completed', 'failed'))
);

CREATE INDEX idx_instagram_sync_log_recent
  ON public.instagram_sync_log (site_id, created_at DESC);

-- ── RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_accounts_staff_read ON public.instagram_accounts;
CREATE POLICY instagram_accounts_staff_read
  ON public.instagram_accounts FOR SELECT TO authenticated
  USING (public.can_edit_site(site_id));

DROP POLICY IF EXISTS instagram_accounts_staff_write ON public.instagram_accounts;
CREATE POLICY instagram_accounts_staff_write
  ON public.instagram_accounts TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_posts_public_read ON public.instagram_posts;
CREATE POLICY instagram_posts_public_read
  ON public.instagram_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.site_visible(a.site_id)
    )
  );

DROP POLICY IF EXISTS instagram_posts_staff_write ON public.instagram_posts;
CREATE POLICY instagram_posts_staff_write
  ON public.instagram_posts TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.can_edit_site(a.site_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.can_edit_site(a.site_id)
    )
  );

ALTER TABLE public.instagram_feed_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_feed_slots_public_read ON public.instagram_feed_slots;
CREATE POLICY instagram_feed_slots_public_read
  ON public.instagram_feed_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.site_visible(a.site_id)
    )
  );

DROP POLICY IF EXISTS instagram_feed_slots_staff_write ON public.instagram_feed_slots;
CREATE POLICY instagram_feed_slots_staff_write
  ON public.instagram_feed_slots TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.can_edit_site(a.site_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.can_edit_site(a.site_id)
    )
  );

ALTER TABLE public.instagram_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_sync_log_staff_read ON public.instagram_sync_log;
CREATE POLICY instagram_sync_log_staff_read
  ON public.instagram_sync_log FOR SELECT TO authenticated
  USING (public.can_edit_site(site_id));

-- ── Triggers (auto-update updated_at) ─────────────────────────────

CREATE TRIGGER set_instagram_accounts_updated_at
  BEFORE UPDATE ON public.instagram_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER set_instagram_posts_updated_at
  BEFORE UPDATE ON public.instagram_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER set_instagram_feed_slots_updated_at
  BEFORE UPDATE ON public.instagram_feed_slots
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ── Public view (hides access_token from public reads) ────────────

CREATE OR REPLACE VIEW public.instagram_accounts_public AS
SELECT
  id, site_id, locale, handle, ig_user_id,
  sync_enabled, display_slots, layout_type,
  last_synced_at, token_expires_at,
  created_at, updated_at
FROM public.instagram_accounts;
