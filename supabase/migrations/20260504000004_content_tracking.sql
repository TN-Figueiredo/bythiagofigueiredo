-- content_events — raw tracking event stream
CREATE TABLE IF NOT EXISTS content_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES sites(id),
  session_id    text NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('blog','campaign','newsletter_archive')),
  resource_id   uuid NOT NULL,
  event_type    text NOT NULL CHECK (event_type IN ('view','read_progress','read_complete')),
  anonymous_id  text NOT NULL,
  locale        text,
  referrer_src  text CHECK (referrer_src IS NULL OR referrer_src IN ('direct','google','newsletter','social','other')),
  read_depth    smallint CHECK (read_depth IS NULL OR (read_depth >= 0 AND read_depth <= 100)),
  time_on_page  smallint CHECK (time_on_page IS NULL OR (time_on_page >= 0 AND time_on_page <= 3600)),
  has_consent   boolean NOT NULL DEFAULT false,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_events_resource ON content_events(resource_type, resource_id, created_at);
CREATE INDEX idx_content_events_site_date ON content_events(site_id, created_at);
CREATE INDEX idx_content_events_anon ON content_events(anonymous_id, resource_id);

-- RLS
ALTER TABLE content_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_events_anon_insert" ON content_events;
CREATE POLICY "content_events_anon_insert" ON content_events
  FOR INSERT TO anon WITH CHECK (public.site_visible(site_id));

DROP POLICY IF EXISTS "content_events_staff_read" ON content_events;
CREATE POLICY "content_events_staff_read" ON content_events
  FOR SELECT TO authenticated USING (public.is_staff());

-- content_metrics — daily aggregation
CREATE TABLE IF NOT EXISTS content_metrics (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             uuid NOT NULL REFERENCES sites(id),
  resource_type       text NOT NULL,
  resource_id         uuid NOT NULL,
  date                date NOT NULL,
  views               int NOT NULL DEFAULT 0,
  unique_views        int NOT NULL DEFAULT 0,
  reads_complete      int NOT NULL DEFAULT 0,
  avg_read_depth      smallint NOT NULL DEFAULT 0,
  avg_time_sec        smallint NOT NULL DEFAULT 0,
  referrer_direct     int NOT NULL DEFAULT 0,
  referrer_google     int NOT NULL DEFAULT 0,
  referrer_newsletter int NOT NULL DEFAULT 0,
  referrer_social     int NOT NULL DEFAULT 0,
  referrer_other      int NOT NULL DEFAULT 0,
  UNIQUE(resource_type, resource_id, date)
);

CREATE INDEX idx_content_metrics_site ON content_metrics(site_id, date);
CREATE INDEX idx_content_metrics_resource ON content_metrics(resource_type, resource_id, date);

-- RLS
ALTER TABLE content_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_metrics_staff_read" ON content_metrics;
CREATE POLICY "content_metrics_staff_read" ON content_metrics
  FOR SELECT TO authenticated USING (public.is_staff());

-- aggregate_content_events — daily aggregation RPC
CREATE OR REPLACE FUNCTION public.aggregate_content_events(p_date date DEFAULT current_date - 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aggregated int;
  v_updated int;
BEGIN
  INSERT INTO content_metrics (
    site_id, resource_type, resource_id, date,
    views, unique_views, reads_complete,
    avg_read_depth, avg_time_sec,
    referrer_direct, referrer_google, referrer_newsletter, referrer_social, referrer_other
  )
  SELECT
    site_id, resource_type, resource_id, p_date,
    count(*) FILTER (WHERE event_type = 'view'),
    count(DISTINCT anonymous_id) FILTER (WHERE event_type = 'view'),
    count(*) FILTER (WHERE event_type = 'read_complete'),
    coalesce(avg(read_depth) FILTER (WHERE event_type = 'read_progress' AND read_depth IS NOT NULL), 0)::smallint,
    coalesce(avg(time_on_page) FILTER (WHERE event_type = 'read_progress' AND time_on_page IS NOT NULL), 0)::smallint,
    count(*) FILTER (WHERE referrer_src = 'direct' AND event_type = 'view'),
    count(*) FILTER (WHERE referrer_src = 'google' AND event_type = 'view'),
    count(*) FILTER (WHERE referrer_src = 'newsletter' AND event_type = 'view'),
    count(*) FILTER (WHERE referrer_src = 'social' AND event_type = 'view'),
    count(*) FILTER (WHERE referrer_src = 'other' AND event_type = 'view')
  FROM content_events
  WHERE created_at >= p_date::timestamptz
    AND created_at < (p_date + interval '1 day')::timestamptz
    AND (user_agent IS NULL OR user_agent NOT SIMILAR TO '%(Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot|Bytespider|GPTBot|ClaudeBot|anthropic-ai|CCBot|PerplexityBot)%')
  GROUP BY site_id, resource_type, resource_id
  ON CONFLICT (resource_type, resource_id, date) DO UPDATE SET
    views = EXCLUDED.views,
    unique_views = EXCLUDED.unique_views,
    reads_complete = EXCLUDED.reads_complete,
    avg_read_depth = EXCLUDED.avg_read_depth,
    avg_time_sec = EXCLUDED.avg_time_sec,
    referrer_direct = EXCLUDED.referrer_direct,
    referrer_google = EXCLUDED.referrer_google,
    referrer_newsletter = EXCLUDED.referrer_newsletter,
    referrer_social = EXCLUDED.referrer_social,
    referrer_other = EXCLUDED.referrer_other;

  GET DIAGNOSTICS v_aggregated = ROW_COUNT;

  UPDATE blog_posts bp SET
    view_count = coalesce(agg.total_views, 0),
    read_complete_count = coalesce(agg.total_reads, 0)
  FROM (
    SELECT resource_id,
           sum(views) AS total_views,
           sum(reads_complete) AS total_reads
    FROM content_metrics
    WHERE resource_type = 'blog'
    GROUP BY resource_id
  ) agg
  WHERE bp.id = agg.resource_id
    AND (bp.view_count IS DISTINCT FROM coalesce(agg.total_views, 0)
      OR bp.read_complete_count IS DISTINCT FROM coalesce(agg.total_reads, 0));

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'date', p_date,
    'metrics_upserted', v_aggregated,
    'posts_updated', v_updated
  );
END;
$$;

-- purge_content_events — 90-day retention
CREATE OR REPLACE FUNCTION public.purge_content_events(p_older_than_days int DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM content_events
  WHERE created_at < now() - (p_older_than_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('purged', v_deleted);
END;
$$;
