-- Migration: kill_switches_ad_engine_1_0
UPDATE public.kill_switches
  SET id = 'ads_slot_banner_top'
  WHERE id = 'ads_slot_article_top'
    AND NOT EXISTS (
      SELECT 1 FROM public.kill_switches WHERE id = 'ads_slot_banner_top'
    );

UPDATE public.kill_switches
  SET id = 'ads_slot_inline_mid'
  WHERE id = 'ads_slot_article_between_paras'
    AND NOT EXISTS (
      SELECT 1 FROM public.kill_switches WHERE id = 'ads_slot_inline_mid'
    );

UPDATE public.kill_switches
  SET id = 'ads_slot_rail_right'
  WHERE id = 'ads_slot_sidebar_right'
    AND NOT EXISTS (
      SELECT 1 FROM public.kill_switches WHERE id = 'ads_slot_rail_right'
    );

UPDATE public.kill_switches
  SET id = 'ads_slot_block_bottom'
  WHERE id = 'ads_slot_below_fold'
    AND NOT EXISTS (
      SELECT 1 FROM public.kill_switches WHERE id = 'ads_slot_block_bottom'
    );

INSERT INTO public.kill_switches (id, enabled, reason) VALUES
  ('ads_slot_banner_top',   true,  'Per-slot: banner_top'),
  ('ads_slot_rail_left',    true,  'Per-slot: rail_left'),
  ('ads_slot_rail_right',   true,  'Per-slot: rail_right'),
  ('ads_slot_inline_mid',   true,  'Per-slot: inline_mid'),
  ('ads_slot_block_bottom', true,  'Per-slot: block_bottom')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kill_switches (id, enabled, reason) VALUES
  ('ads_google_enabled', false, 'Google AdSense integration — enable after configuring publisher ID')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kill_switches (id, enabled, reason) VALUES
  ('ads_network_enabled', false, 'Master switch for third-party ad networks (AdSense, future: Amazon, Ezoic)')
ON CONFLICT (id) DO NOTHING;
