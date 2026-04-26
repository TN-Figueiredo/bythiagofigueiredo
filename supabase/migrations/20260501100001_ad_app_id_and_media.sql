-- Add app_id to ad_campaigns, ad_placeholders, ad_slot_metrics
-- so @tn-figueiredo/ad-engine-admin queries (which filter by app_id) return data.
-- Also create ad_media table for the Biblioteca (media library) tab.

-- 1. ad_campaigns: add app_id
ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS app_id TEXT NOT NULL DEFAULT 'bythiagofigueiredo';

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_app_id ON public.ad_campaigns(app_id);

-- 2. ad_placeholders: add app_id
ALTER TABLE public.ad_placeholders
  ADD COLUMN IF NOT EXISTS app_id TEXT NOT NULL DEFAULT 'bythiagofigueiredo';

CREATE INDEX IF NOT EXISTS idx_ad_placeholders_app_id ON public.ad_placeholders(app_id);

-- 3. ad_slot_metrics: add app_id
ALTER TABLE public.ad_slot_metrics
  ADD COLUMN IF NOT EXISTS app_id TEXT NOT NULL DEFAULT 'bythiagofigueiredo';

-- 4. ad_media table
CREATE TABLE IF NOT EXISTS public.ad_media (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id      TEXT        NOT NULL DEFAULT 'bythiagofigueiredo',
  url         TEXT        NOT NULL,
  filename    TEXT        NOT NULL,
  size_bytes  INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_media_app_id ON public.ad_media(app_id);

ALTER TABLE public.ad_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.ad_media
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "ad_media_select_auth" ON public.ad_media
  FOR SELECT TO authenticated USING (true);
