-- =============================================================
-- Linktree Analytics: events tracking + daily metrics aggregation
-- =============================================================

-- 1. Partitioned events table
CREATE TABLE IF NOT EXISTS public.linktree_events (
  id            uuid DEFAULT gen_random_uuid() NOT NULL,
  site_id       uuid NOT NULL,
  event_type    text NOT NULL,
  link_key      text,
  visitor_id    text,
  is_unique     boolean DEFAULT false NOT NULL,
  is_bot        boolean DEFAULT false NOT NULL,
  device_type   text,
  browser       text,
  os            text,
  country       text,
  region        text,
  city          text,
  referrer_url  text,
  referrer_domain text,
  referrer_source text,
  ip            text,
  user_agent    text,
  language      text,
  created_at    timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT linktree_events_pkey PRIMARY KEY (id, created_at),
  CONSTRAINT linktree_events_site_fk FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT linktree_events_event_type_check CHECK (event_type IN ('pageview', 'link_click')),
  CONSTRAINT linktree_events_device_type_check CHECK (device_type IN ('mobile', 'desktop', 'tablet', 'bot', 'other')),
  CONSTRAINT linktree_events_referrer_source_check CHECK (referrer_source IN ('direct', 'search', 'social', 'email', 'referral', 'other'))
) PARTITION BY RANGE (created_at);

-- Monthly partitions (current + 2 ahead)
CREATE TABLE IF NOT EXISTS public.linktree_events_2026_05
  PARTITION OF public.linktree_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS public.linktree_events_2026_06
  PARTITION OF public.linktree_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS public.linktree_events_2026_07
  PARTITION OF public.linktree_events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE IF NOT EXISTS public.linktree_events_default
  PARTITION OF public.linktree_events DEFAULT;

-- 2. Indexes on events
CREATE INDEX IF NOT EXISTS idx_linktree_events_site_time
  ON public.linktree_events (site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_linktree_events_visitor_dedup
  ON public.linktree_events (site_id, visitor_id, created_at)
  WHERE visitor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_linktree_events_type_time
  ON public.linktree_events (event_type, created_at DESC);

-- 3. Daily metrics aggregation table
CREATE TABLE IF NOT EXISTS public.linktree_daily_metrics (
  id                uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  site_id           uuid NOT NULL REFERENCES sites(id),
  date              date NOT NULL,
  weekday           smallint NOT NULL,
  pageviews         integer DEFAULT 0 NOT NULL,
  unique_visitors   integer DEFAULT 0 NOT NULL,
  link_clicks       integer DEFAULT 0 NOT NULL,
  bot_views         integer DEFAULT 0 NOT NULL,
  mobile_views      integer DEFAULT 0 NOT NULL,
  desktop_views     integer DEFAULT 0 NOT NULL,
  tablet_views      integer DEFAULT 0 NOT NULL,
  ref_direct        integer DEFAULT 0 NOT NULL,
  ref_search        integer DEFAULT 0 NOT NULL,
  ref_social        integer DEFAULT 0 NOT NULL,
  ref_email         integer DEFAULT 0 NOT NULL,
  ref_referral      integer DEFAULT 0 NOT NULL,
  ref_other         integer DEFAULT 0 NOT NULL,
  countries         jsonb DEFAULT '{}' NOT NULL,
  hourly_views      jsonb DEFAULT '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]' NOT NULL,
  link_clicks_by_key jsonb DEFAULT '{}' NOT NULL,
  CONSTRAINT linktree_daily_metrics_site_date_key UNIQUE (site_id, date),
  CONSTRAINT linktree_daily_metrics_weekday_check CHECK (weekday >= 0 AND weekday <= 6)
);

CREATE INDEX IF NOT EXISTS idx_linktree_daily_site_date
  ON public.linktree_daily_metrics (site_id, date DESC);

-- 4. RLS
ALTER TABLE public.linktree_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linktree_daily_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS linktree_events_anon_insert ON public.linktree_events;
CREATE POLICY linktree_events_anon_insert ON public.linktree_events
  FOR INSERT TO anon WITH CHECK (public.site_visible(site_id));

DROP POLICY IF EXISTS linktree_events_staff_read ON public.linktree_events;
CREATE POLICY linktree_events_staff_read ON public.linktree_events
  FOR SELECT TO authenticated USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS linktree_events_service_insert ON public.linktree_events;
CREATE POLICY linktree_events_service_insert ON public.linktree_events
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS linktree_daily_metrics_staff_read ON public.linktree_daily_metrics;
CREATE POLICY linktree_daily_metrics_staff_read ON public.linktree_daily_metrics
  FOR SELECT TO authenticated USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS linktree_daily_metrics_service_write ON public.linktree_daily_metrics;
CREATE POLICY linktree_daily_metrics_service_write ON public.linktree_daily_metrics
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Watermark row for linktree aggregation
INSERT INTO public.link_aggregation_watermark (id, last_processed_at)
VALUES ('linktree', now())
ON CONFLICT (id) DO NOTHING;

-- 6. Partition management function for linktree_events
CREATE OR REPLACE FUNCTION public.create_linktree_events_partition(
  p_partition_name text,
  p_start_date text,
  p_end_date text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = p_partition_name AND n.nspname = 'public'
  ) THEN
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.linktree_events FOR VALUES FROM (%L) TO (%L)',
      p_partition_name, p_start_date, p_end_date
    );
    RETURN 'created';
  END IF;
  RETURN 'exists';
END;
$$;

-- 7. Additive upsert function for linktree_daily_metrics
CREATE OR REPLACE FUNCTION public.upsert_linktree_daily_metrics(
  p_rows jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r jsonb;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    INSERT INTO public.linktree_daily_metrics (
      site_id, date, weekday,
      pageviews, unique_visitors, link_clicks, bot_views,
      mobile_views, desktop_views, tablet_views,
      ref_direct, ref_search, ref_social, ref_email, ref_referral, ref_other,
      countries, hourly_views, link_clicks_by_key
    ) VALUES (
      (r->>'site_id')::uuid,
      (r->>'date')::date,
      (r->>'weekday')::smallint,
      (r->>'pageviews')::integer,
      (r->>'unique_visitors')::integer,
      (r->>'link_clicks')::integer,
      (r->>'bot_views')::integer,
      (r->>'mobile_views')::integer,
      (r->>'desktop_views')::integer,
      (r->>'tablet_views')::integer,
      (r->>'ref_direct')::integer,
      (r->>'ref_search')::integer,
      (r->>'ref_social')::integer,
      (r->>'ref_email')::integer,
      (r->>'ref_referral')::integer,
      (r->>'ref_other')::integer,
      (r->'countries')::jsonb,
      (r->'hourly_views')::jsonb,
      (r->'link_clicks_by_key')::jsonb
    )
    ON CONFLICT (site_id, date) DO UPDATE SET
      pageviews       = linktree_daily_metrics.pageviews       + EXCLUDED.pageviews,
      unique_visitors = EXCLUDED.unique_visitors,
      link_clicks     = linktree_daily_metrics.link_clicks     + EXCLUDED.link_clicks,
      bot_views       = linktree_daily_metrics.bot_views       + EXCLUDED.bot_views,
      mobile_views    = linktree_daily_metrics.mobile_views    + EXCLUDED.mobile_views,
      desktop_views   = linktree_daily_metrics.desktop_views   + EXCLUDED.desktop_views,
      tablet_views    = linktree_daily_metrics.tablet_views    + EXCLUDED.tablet_views,
      ref_direct      = linktree_daily_metrics.ref_direct      + EXCLUDED.ref_direct,
      ref_search      = linktree_daily_metrics.ref_search      + EXCLUDED.ref_search,
      ref_social      = linktree_daily_metrics.ref_social      + EXCLUDED.ref_social,
      ref_email       = linktree_daily_metrics.ref_email       + EXCLUDED.ref_email,
      ref_referral    = linktree_daily_metrics.ref_referral    + EXCLUDED.ref_referral,
      ref_other       = linktree_daily_metrics.ref_other       + EXCLUDED.ref_other,
      countries       = (
        SELECT COALESCE(jsonb_object_agg(key, val), '{}'::jsonb)
        FROM (
          SELECT key, SUM(val::integer) AS val
          FROM (
            SELECT key, value AS val FROM jsonb_each_text(linktree_daily_metrics.countries)
            UNION ALL
            SELECT key, value AS val FROM jsonb_each_text(EXCLUDED.countries)
          ) combined
          GROUP BY key
        ) merged
      ),
      hourly_views    = (
        SELECT jsonb_agg(
          COALESCE((linktree_daily_metrics.hourly_views->>idx)::integer, 0)
          + COALESCE((EXCLUDED.hourly_views->>idx)::integer, 0)
        )
        FROM generate_series(0, 23) AS idx
      ),
      link_clicks_by_key = (
        SELECT COALESCE(jsonb_object_agg(key, val), '{}'::jsonb)
        FROM (
          SELECT key, SUM(val::integer) AS val
          FROM (
            SELECT key, value AS val FROM jsonb_each_text(linktree_daily_metrics.link_clicks_by_key)
            UNION ALL
            SELECT key, value AS val FROM jsonb_each_text(EXCLUDED.link_clicks_by_key)
          ) combined
          GROUP BY key
        ) merged
      );
  END LOOP;
END;
$$;

-- 8. Extend create_monthly_partitions() to also manage linktree_events partitions
CREATE OR REPLACE FUNCTION public.create_monthly_partitions(p_months_ahead integer DEFAULT 3) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_month      date;
  v_start      date;
  v_end        date;
  v_suffix     text;
  v_tbl        text;
BEGIN
  FOR i IN 0..p_months_ahead LOOP
    v_month  := date_trunc('month', now()) + (i || ' months')::interval;
    v_start  := v_month;
    v_end    := v_month + interval '1 month';
    v_suffix := to_char(v_month, 'YYYY_MM');

    -- link_clicks partition (existing)
    v_tbl := 'link_clicks_' || v_suffix;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = v_tbl AND n.nspname = 'public'
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.link_clicks
           FOR VALUES FROM (%L) TO (%L)',
        v_tbl, v_start, v_end
      );
    END IF;

    -- linktree_events partition (NEW)
    v_tbl := 'linktree_events_' || v_suffix;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = v_tbl AND n.nspname = 'public'
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.linktree_events
           FOR VALUES FROM (%L) TO (%L)',
        v_tbl, v_start, v_end
      );
    END IF;
  END LOOP;
END;
$$;
