-- ─── link_source_type ENUM ───
DO $$ BEGIN
  CREATE TYPE link_source_type AS ENUM (
    'manual',
    'campaign',
    'newsletter',
    'blog',
    'social',
    'print'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── tracked_links ───
CREATE TABLE IF NOT EXISTS tracked_links (
  id                  uuid            NOT NULL DEFAULT gen_random_uuid(),
  site_id             uuid            NOT NULL REFERENCES sites(id),
  code                text            NOT NULL,
  slug                text,
  destination_url     text            NOT NULL,
  title               text,
  tags                text[]          NOT NULL DEFAULT '{}',
  source_type         link_source_type NOT NULL DEFAULT 'manual',
  source_id           uuid,
  utm_source          text,
  utm_medium          text,
  utm_campaign        text,
  utm_term            text,
  utm_content         text,
  has_qr              boolean         NOT NULL DEFAULT false,
  qr_storage_path     text,
  qr_config           jsonb,
  redirect_type       smallint        NOT NULL DEFAULT 302 CHECK (redirect_type IN (301, 302)),
  expired_url         text,
  click_limit         int,
  password_hash       text,
  active              boolean         NOT NULL DEFAULT true,
  is_internal         boolean         NOT NULL DEFAULT false,
  expires_at          timestamptz,
  deleted_at          timestamptz,
  total_clicks        int             NOT NULL DEFAULT 0,
  unique_visitors     int             NOT NULL DEFAULT 0,
  last_clicked_at     timestamptz,
  created_by          uuid            REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz     NOT NULL DEFAULT now(),
  updated_at          timestamptz     NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at),
  UNIQUE (site_id, code),
  UNIQUE (site_id, slug)
) PARTITION BY RANGE (created_at);

ALTER TABLE tracked_links ENABLE ROW LEVEL SECURITY;

-- Unique index on just id — required so that FKs from other tables
-- (e.g. newsletter_sends.link_id) can reference tracked_links(id)
-- without including the partition key. PostgreSQL partitioned tables
-- require the partition key in the PK, but a separate UNIQUE index on
-- id alone is allowed and satisfies FK references.
CREATE UNIQUE INDEX IF NOT EXISTS tracked_links_id_unique ON tracked_links (id);

-- ─── link_clicks ───
CREATE TABLE IF NOT EXISTS link_clicks (
  id                  uuid            NOT NULL DEFAULT gen_random_uuid(),
  link_id             uuid            NOT NULL,
  site_id             uuid            NOT NULL REFERENCES sites(id),
  visitor_id          text,
  is_unique           boolean         NOT NULL DEFAULT false,
  is_bot              boolean         NOT NULL DEFAULT false,
  utm_source          text,
  utm_medium          text,
  utm_campaign        text,
  utm_term            text,
  utm_content         text,
  device_type         text            CHECK (device_type IS NULL OR device_type IN ('mobile','desktop','tablet','other')),
  browser             text,
  os                  text,
  user_agent          text,
  country             text,
  region              text,
  city                text,
  ip                  text,
  referrer_url        text,
  referrer_domain     text,
  referrer_source     text           CHECK (referrer_source IS NULL OR referrer_source IN ('direct','search','social','email','referral','other')),
  language            text,
  converted_at        timestamptz,
  conversion_type     text,
  conversion_value    numeric(12,4),
  conversion_id       text,
  clicked_at          timestamptz     NOT NULL DEFAULT now(),
  PRIMARY KEY (id, clicked_at)
) PARTITION BY RANGE (clicked_at);

ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

-- ─── link_daily_metrics ───
CREATE TABLE IF NOT EXISTS link_daily_metrics (
  id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id             uuid            NOT NULL,
  site_id             uuid            NOT NULL REFERENCES sites(id),
  date                date            NOT NULL,
  weekday             smallint        NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  clicks              int             NOT NULL DEFAULT 0,
  unique_visitors     int             NOT NULL DEFAULT 0,
  conversions         int             NOT NULL DEFAULT 0,
  bot_clicks          int             NOT NULL DEFAULT 0,
  conversion_value    numeric(14,4)   NOT NULL DEFAULT 0,
  mobile_clicks       int             NOT NULL DEFAULT 0,
  desktop_clicks      int             NOT NULL DEFAULT 0,
  tablet_clicks       int             NOT NULL DEFAULT 0,
  ref_direct          int             NOT NULL DEFAULT 0,
  ref_search          int             NOT NULL DEFAULT 0,
  ref_social          int             NOT NULL DEFAULT 0,
  ref_email           int             NOT NULL DEFAULT 0,
  ref_referral        int             NOT NULL DEFAULT 0,
  ref_other           int             NOT NULL DEFAULT 0,
  countries           jsonb           NOT NULL DEFAULT '{}',
  cities              jsonb           NOT NULL DEFAULT '{}',
  hourly_clicks       jsonb           NOT NULL DEFAULT '{}',
  UNIQUE (link_id, date)
);

ALTER TABLE link_daily_metrics ENABLE ROW LEVEL SECURITY;

-- ─── link_annotations ───
CREATE TABLE IF NOT EXISTS link_annotations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id         uuid        NOT NULL,
  site_id         uuid        NOT NULL REFERENCES sites(id),
  label           text        NOT NULL,
  icon            text,
  color           text,
  annotated_at    timestamptz NOT NULL DEFAULT now(),
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE link_annotations ENABLE ROW LEVEL SECURITY;

-- ─── link_goals ───
CREATE TABLE IF NOT EXISTS link_goals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id         uuid        NOT NULL,
  site_id         uuid        NOT NULL REFERENCES sites(id),
  metric          text        NOT NULL CHECK (metric IN ('clicks','unique_visitors','conversions','conversion_value')),
  target_value    numeric(14,4) NOT NULL,
  deadline        date,
  reached_at      timestamptz,
  notify_channels jsonb       NOT NULL DEFAULT '[]',
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE link_goals ENABLE ROW LEVEL SECURITY;

-- ─── link_alerts ───
CREATE TABLE IF NOT EXISTS link_alerts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id             uuid        NOT NULL,
  site_id             uuid        NOT NULL REFERENCES sites(id),
  alert_type          text        NOT NULL CHECK (alert_type IN ('threshold','anomaly','goal_reached','expiry')),
  metric              text        NOT NULL CHECK (metric IN ('clicks','unique_visitors','conversions','conversion_value','bounce_rate')),
  condition           jsonb       NOT NULL DEFAULT '{}',
  active              boolean     NOT NULL DEFAULT true,
  last_triggered_at   timestamptz,
  notify_channels     jsonb       NOT NULL DEFAULT '[]',
  created_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE link_alerts ENABLE ROW LEVEL SECURITY;
