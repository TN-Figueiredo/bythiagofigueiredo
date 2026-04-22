-- 20260421000002_newsletter_editions_and_sends.sql
-- Newsletter sending tables: editions, sends, click_events, webhook_events, blog_cadence


-- ============================================================
-- 1. newsletter_editions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.newsletter_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  newsletter_type_id text NOT NULL REFERENCES public.newsletter_types(id) ON DELETE RESTRICT,
  paired_edition_id uuid REFERENCES public.newsletter_editions(id) ON DELETE SET NULL,
  source_blog_post_id uuid REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  subject text NOT NULL,
  preheader text,
  content_mdx text,
  content_html text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','ready','queued','scheduled','sending','sent','failed','cancelled')),
  segment text NOT NULL DEFAULT 'all'
    CHECK (segment IN ('all','high_engagement','re_engagement','new_subscribers')),
  queue_position int,
  slot_date date,
  scheduled_at timestamptz,
  sent_at timestamptz,
  send_count int NOT NULL DEFAULT 0,
  stats_delivered int NOT NULL DEFAULT 0,
  stats_opens int NOT NULL DEFAULT 0,
  stats_clicks int NOT NULL DEFAULT 0,
  stats_bounces int NOT NULL DEFAULT 0,
  stats_complaints int NOT NULL DEFAULT 0,
  stats_unsubs int NOT NULL DEFAULT 0,
  stats_stale boolean NOT NULL DEFAULT false,
  ab_variant text CHECK (ab_variant IN ('a','b')),
  ab_parent_id uuid REFERENCES public.newsletter_editions(id) ON DELETE SET NULL,
  ab_sample_pct int NOT NULL DEFAULT 10,
  ab_wait_hours int NOT NULL DEFAULT 4,
  ab_winner_decided_at timestamptz,
  test_sent_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletter_editions_site_type_status
  ON public.newsletter_editions (site_id, newsletter_type_id, status);
CREATE INDEX IF NOT EXISTS newsletter_editions_scheduled
  ON public.newsletter_editions (status, scheduled_at)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS newsletter_editions_slot
  ON public.newsletter_editions (newsletter_type_id, slot_date)
  WHERE slot_date IS NOT NULL;

CREATE TRIGGER newsletter_editions_set_updated_at
  BEFORE UPDATE ON public.newsletter_editions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.newsletter_editions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_editions_staff_read" ON public.newsletter_editions;
CREATE POLICY "newsletter_editions_staff_read"
  ON public.newsletter_editions FOR SELECT TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "newsletter_editions_staff_write" ON public.newsletter_editions;
CREATE POLICY "newsletter_editions_staff_write"
  ON public.newsletter_editions FOR ALL TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "newsletter_editions_public_read" ON public.newsletter_editions;
CREATE POLICY "newsletter_editions_public_read"
  ON public.newsletter_editions FOR SELECT TO anon
  USING (status = 'sent');

-- ============================================================
-- 2. newsletter_sends
-- ============================================================
CREATE TABLE IF NOT EXISTS public.newsletter_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.newsletter_editions(id) ON DELETE CASCADE,
  subscriber_email citext NOT NULL,
  resend_message_id text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sent','delivered','opened','clicked','bounced','complained')),
  delivered_at timestamptz,
  opened_at timestamptz,
  open_ip inet,
  open_user_agent text,
  clicked_at timestamptz,
  bounce_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition_id, subscriber_email)
);

CREATE INDEX IF NOT EXISTS newsletter_sends_edition_status
  ON public.newsletter_sends (edition_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_sends_resend_msg
  ON public.newsletter_sends (resend_message_id)
  WHERE resend_message_id IS NOT NULL;

ALTER TABLE public.newsletter_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_sends_staff_read" ON public.newsletter_sends;
CREATE POLICY "newsletter_sends_staff_read"
  ON public.newsletter_sends FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.newsletter_editions e
    WHERE e.id = edition_id AND public.can_view_site(e.site_id)
  ));

-- ============================================================
-- 3. newsletter_click_events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.newsletter_click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid NOT NULL REFERENCES public.newsletter_sends(id) ON DELETE CASCADE,
  url text NOT NULL,
  ip inet,
  user_agent text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletter_click_events_send
  ON public.newsletter_click_events (send_id);
CREATE INDEX IF NOT EXISTS newsletter_click_events_url
  ON public.newsletter_click_events (url);

ALTER TABLE public.newsletter_click_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_click_events_staff_read" ON public.newsletter_click_events;
CREATE POLICY "newsletter_click_events_staff_read"
  ON public.newsletter_click_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.newsletter_sends s
    JOIN public.newsletter_editions e ON e.id = s.edition_id
    WHERE s.id = send_id AND public.can_view_site(e.site_id)
  ));

-- ============================================================
-- 4. webhook_events (idempotency dedup)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  svix_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- No RLS needed — only accessed via service-role from webhook handler

-- ============================================================
-- 5. blog_cadence
-- ============================================================
CREATE TABLE IF NOT EXISTS public.blog_cadence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  locale text NOT NULL,
  cadence_days int NOT NULL DEFAULT 7,
  preferred_send_time time NOT NULL DEFAULT '09:00',
  cadence_start_date date,
  cadence_paused boolean NOT NULL DEFAULT false,
  last_published_at timestamptz,
  UNIQUE (site_id, locale)
);

ALTER TABLE public.blog_cadence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blog_cadence_staff_rw" ON public.blog_cadence;
CREATE POLICY "blog_cadence_staff_rw"
  ON public.blog_cadence FOR ALL TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

