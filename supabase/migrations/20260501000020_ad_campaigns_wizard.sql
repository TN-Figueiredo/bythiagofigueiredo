-- Migration: Ad Campaigns + Slot Creatives
-- Source: @tn-figueiredo/ad-engine@0.2.0 migrations/002_ad_campaigns_wizard.sql

-- 1. ad_campaigns
CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT        NOT NULL,
  advertiser            TEXT,
  format                TEXT        NOT NULL DEFAULT 'image',
  audience              JSONB       DEFAULT '[]',
  limits                JSONB       DEFAULT '{}',
  priority              INT         DEFAULT 0,
  schedule_start        TIMESTAMPTZ,
  schedule_end          TIMESTAMPTZ,
  pricing_model         TEXT        NOT NULL DEFAULT 'cpm',
  pricing_value         NUMERIC     DEFAULT 0,
  status                TEXT        NOT NULL DEFAULT 'draft',
  impressions_delivered INTEGER     DEFAULT 0,
  clicks_delivered      INTEGER     DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ad_slot_creatives
CREATE TABLE IF NOT EXISTS public.ad_slot_creatives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  slot_key        TEXT NOT NULL,
  title           TEXT,
  body            TEXT,
  cta_text        TEXT,
  cta_url         TEXT,
  image_url       TEXT,
  dismiss_seconds INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ad_slot_metrics
CREATE TABLE IF NOT EXISTS public.ad_slot_metrics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  slot_key    TEXT NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  impressions INTEGER DEFAULT 0,
  clicks      INTEGER DEFAULT 0,
  UNIQUE (campaign_id, slot_key, date)
);

-- 4. FK from ad_events.ad_id to ad_campaigns (deferred from migration 019)
ALTER TABLE public.ad_events
  ADD CONSTRAINT ad_events_ad_id_fkey
    FOREIGN KEY (ad_id) REFERENCES public.ad_campaigns(id) ON DELETE SET NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status        ON public.ad_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_ad_slot_creatives_campaign  ON public.ad_slot_creatives(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_slot_metrics_campaign    ON public.ad_slot_metrics(campaign_id, date);

-- 6. RLS
ALTER TABLE public.ad_campaigns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_slot_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_slot_metrics   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.ad_campaigns      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.ad_slot_creatives FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.ad_slot_metrics   FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "ad_campaigns_select_auth"      ON public.ad_campaigns      FOR SELECT TO authenticated USING (true);
CREATE POLICY "ad_slot_creatives_select_auth" ON public.ad_slot_creatives FOR SELECT TO authenticated USING (true);

-- 7. updated_at trigger
CREATE TRIGGER update_ad_campaigns_updated_at
  BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
