-- Migration: seed 5 archive:* slots in ad_placeholders, ad_slot_config, kill_switches

-- 1. ad_placeholders
INSERT INTO public.ad_placeholders (slot_id, is_enabled, headline, body, cta_text, cta_url, brand_color, app_id)
VALUES
  ('archive:top:doorman',       false, 'Anuncie aqui', 'Alcance nossos leitores.',  'Saiba mais', '/anuncie', '#f97316', 'bythiagofigueiredo'),
  ('archive:break:anchor',      true,  'Anuncie aqui', 'Alcance nossos leitores.',  'Saiba mais', '/anuncie', '#f97316', 'bythiagofigueiredo'),
  ('archive:grid:bookmark',     true,  'Anuncie aqui', 'Alcance nossos leitores.',  'Saiba mais', '/anuncie', '#f97316', 'bythiagofigueiredo'),
  ('archive:footer:marginalia', true,  'Anuncie aqui', 'Alcance nossos leitores.',  'Saiba mais', '/anuncie', '#f97316', 'bythiagofigueiredo'),
  ('archive:footer:bowtie',     true,  'Anuncie aqui', 'Alcance nossos leitores.',  'Saiba mais', '/anuncie', '#FF8240', 'bythiagofigueiredo')
ON CONFLICT (slot_id) DO NOTHING;

-- 2. ad_slot_config (requires site_id lookup)
DO $$ DECLARE v_site_id uuid;
BEGIN
  SELECT id INTO v_site_id FROM public.sites WHERE slug = 'bythiagofigueiredo' LIMIT 1;
  IF v_site_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.ad_slot_config (
    site_id, slot_key, label, zone, iab_size, mobile_behavior,
    accepted_types, aspect_ratio,
    house_enabled, cpa_enabled, google_enabled, template_enabled,
    max_per_session, max_per_day, cooldown_ms
  )
  VALUES
    (v_site_id, 'archive:top:doorman',       'Banner — Topo Archive',  'banner', '728x90',    'hide',  '{house,cpa}', '8:1',  true, true,  false, true, 1, 3, 3600000),
    (v_site_id, 'archive:break:anchor',      'Âncora Horizontal',      'inline', NULL,        'stack', '{cpa}',       '16:3', false, true, false, true, 2, 4, 1800000),
    (v_site_id, 'archive:grid:bookmark',     'Card no Grid',           'inline', NULL,        'keep',  '{house,cpa}', '3:4',  true, true,  false, true, 3, 6, 900000),
    (v_site_id, 'archive:footer:marginalia', 'Marginalia — Rodapé',    'block',  NULL,        'keep',  '{house,cpa}', '16:3', true, true,  false, true, 1, 2, 3600000),
    (v_site_id, 'archive:footer:bowtie',     'Newsletter CTA',         'block',  NULL,        'keep',  '{house}',     '16:3', true, false, false, true, 1, 1, 7200000)
  ON CONFLICT (site_id, slot_key) DO NOTHING;
END $$;

-- 3. kill_switches
INSERT INTO public.kill_switches (id, enabled, reason) VALUES
  ('ads_slot_archive_top_doorman',       true, 'archive:top:doorman'),
  ('ads_slot_archive_break_anchor',      true, 'archive:break:anchor'),
  ('ads_slot_archive_grid_bookmark',     true, 'archive:grid:bookmark'),
  ('ads_slot_archive_footer_marginalia', true, 'archive:footer:marginalia'),
  ('ads_slot_archive_footer_bowtie',     true, 'archive:footer:bowtie')
ON CONFLICT DO NOTHING;
