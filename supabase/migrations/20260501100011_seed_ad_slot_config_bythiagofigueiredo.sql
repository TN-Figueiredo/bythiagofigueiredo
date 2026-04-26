-- Migration: seed_ad_slot_config_bythiagofigueiredo
INSERT INTO public.ad_slot_config (
  site_id, slot_key, label, zone,
  aspect_ratio, iab_size,
  house_enabled, cpa_enabled, google_enabled, template_enabled,
  mobile_behavior, accepted_types,
  max_per_session, max_per_day, cooldown_ms
)
SELECT
  s.id,
  v.slot_key,
  v.label,
  v.zone,
  v.aspect_ratio,
  v.iab_size,
  v.house_enabled,
  v.cpa_enabled,
  v.google_enabled,
  v.template_enabled,
  v.mobile_behavior,
  v.accepted_types,
  v.max_per_session,
  v.max_per_day,
  v.cooldown_ms
FROM public.sites s
CROSS JOIN (VALUES
  (
    'banner_top', 'Banner — Topo', 'banner', '8:1', '728x90',
    true, true, false, true, 'keep',
    ARRAY['house', 'cpa']::TEXT[], 1, 3, 3600000
  ),
  (
    'rail_left', 'Rail esquerdo', 'rail', '1:4', '160x600',
    true, false, false, true, 'hide',
    ARRAY['house']::TEXT[], 1, 3, 3600000
  ),
  (
    'rail_right', 'Rail direito', 'rail', '6:5', '300x250',
    false, true, false, true, 'stack',
    ARRAY['cpa']::TEXT[], 3, 6, 900000
  ),
  (
    'inline_mid', 'Inline — Meio', 'inline', '6:5', '300x250',
    false, true, false, true, 'keep',
    ARRAY['cpa']::TEXT[], 2, 4, 1800000
  ),
  (
    'block_bottom', 'Block — Inferior', 'block', '4:1', '970x250',
    true, true, false, true, 'keep',
    ARRAY['house', 'cpa']::TEXT[], 1, 2, 7200000
  )
) AS v(
  slot_key, label, zone, aspect_ratio, iab_size,
  house_enabled, cpa_enabled, google_enabled, template_enabled, mobile_behavior,
  accepted_types, max_per_session, max_per_day, cooldown_ms
)
WHERE s.slug = 'bythiagofigueiredo'
ON CONFLICT (site_id, slot_key) DO NOTHING;
