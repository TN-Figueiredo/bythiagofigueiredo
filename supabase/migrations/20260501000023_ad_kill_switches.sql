-- Migration: Ad Engine Kill Switches
-- Source: @tn-figueiredo/ad-engine@0.2.0 migrations/005_ad_kill_switches.sql

-- Create kill_switches table (not yet in this project)
CREATE TABLE IF NOT EXISTS public.kill_switches (
  id         TEXT PRIMARY KEY,
  enabled    BOOLEAN NOT NULL DEFAULT true,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.kill_switches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kill_switches_all_service_role"
  ON public.kill_switches FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "kill_switches_select_authenticated"
  ON public.kill_switches FOR SELECT TO authenticated USING (true);

-- Ad engine kill switches: master + per-type + per-slot
INSERT INTO public.kill_switches (id, enabled, reason)
VALUES
  ('kill_ads',                        true,  'Master switch for ad engine'),
  ('ads_house_enabled',               true,  'House ads (cross-promotion)'),
  ('ads_cpa_enabled',                 false, 'CPA/paid ads (not yet launched)'),
  ('ads_placeholder_enabled',         true,  'Placeholder ads (empty slot fillers)'),
  ('ads_slot_article_top',            true,  'Per-slot: article_top'),
  ('ads_slot_article_between_paras',  true,  'Per-slot: article_between_paras'),
  ('ads_slot_sidebar_right',          true,  'Per-slot: sidebar_right'),
  ('ads_slot_below_fold',             true,  'Per-slot: below_fold')
ON CONFLICT (id) DO NOTHING;
