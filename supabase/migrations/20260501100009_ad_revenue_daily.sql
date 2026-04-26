-- Migration: ad_revenue_daily
CREATE TABLE IF NOT EXISTS public.ad_revenue_daily (
  site_id        UUID    NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  slot_key       TEXT    NOT NULL,
  date           DATE    NOT NULL,
  source         TEXT    NOT NULL
    CHECK (source IN ('adsense', 'house', 'cpa')),
  impressions    INT     NOT NULL DEFAULT 0,
  clicks         INT     NOT NULL DEFAULT 0,
  earnings_cents INT     NOT NULL DEFAULT 0,
  currency       TEXT    NOT NULL DEFAULT 'USD',
  page_views     INT     NOT NULL DEFAULT 0,
  fill_rate      NUMERIC(5, 2),
  raw_data       JSONB,
  synced_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, slot_key, date, source)
);

COMMENT ON TABLE public.ad_revenue_daily IS
  'Daily revenue metrics aggregated per slot and source. Google data imported via AdSense Management API cron (T-1). House/CPA computed from ad_events.';
COMMENT ON COLUMN public.ad_revenue_daily.fill_rate IS
  'Percentage of page views where the slot was filled (0.00 to 100.00). NULL until page_views > 0.';
COMMENT ON COLUMN public.ad_revenue_daily.raw_data IS
  'Raw provider API response payload. Stored for debug and revenue reconciliation.';

ALTER TABLE public.ad_revenue_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_revenue_daily_all_service_role" ON public.ad_revenue_daily;
CREATE POLICY "ad_revenue_daily_all_service_role"
  ON public.ad_revenue_daily FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ad_revenue_daily_select_auth" ON public.ad_revenue_daily;
CREATE POLICY "ad_revenue_daily_select_auth"
  ON public.ad_revenue_daily FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_ad_revenue_daily_site_date
  ON public.ad_revenue_daily (site_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_ad_revenue_daily_source
  ON public.ad_revenue_daily (site_id, source, date DESC);
