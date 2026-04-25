-- Migration: Ad Placeholders
-- Source: @tn-figueiredo/ad-engine@0.2.0 migrations/003_ad_placeholders.sql
-- Configurable fallback content for ad slots without active campaigns.

CREATE TABLE IF NOT EXISTS public.ad_placeholders (
  slot_id          TEXT    PRIMARY KEY,
  is_enabled       BOOLEAN NOT NULL DEFAULT true,
  headline         TEXT    NOT NULL DEFAULT 'Anuncie aqui',
  body             TEXT    NOT NULL DEFAULT 'Alcance nossos leitores.',
  cta_text         TEXT    NOT NULL DEFAULT 'Saiba mais',
  cta_url          TEXT    NOT NULL DEFAULT 'https://bythiagofigueiredo.com/anuncie',
  image_url        TEXT,
  dismiss_after_ms INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ad_placeholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_placeholders_select_authenticated"
  ON public.ad_placeholders FOR SELECT TO authenticated USING (true);
CREATE POLICY "ad_placeholders_all_service_role"
  ON public.ad_placeholders FOR ALL TO service_role USING (true);

-- Seed one placeholder per content-site slot
INSERT INTO public.ad_placeholders (slot_id) VALUES
  ('article_top'),
  ('article_between_paras'),
  ('sidebar_right'),
  ('below_fold')
ON CONFLICT (slot_id) DO NOTHING;
