-- Migration: seed_ad_slot_config_bythiagofigueiredo
-- Safety: recreate table if migration 100006 DDL was lost (transaction rollback)
CREATE TABLE IF NOT EXISTS public.ad_slot_config (
  site_id              UUID    NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  slot_key             TEXT    NOT NULL,
  house_enabled        BOOLEAN NOT NULL DEFAULT true,
  cpa_enabled          BOOLEAN NOT NULL DEFAULT false,
  google_enabled       BOOLEAN NOT NULL DEFAULT false,
  template_enabled     BOOLEAN NOT NULL DEFAULT true,
  network_adapters_order TEXT[] NOT NULL DEFAULT '{adsense}',
  network_config       JSONB   NOT NULL DEFAULT '{}',
  aspect_ratio         TEXT    NOT NULL DEFAULT '16:9',
  iab_size             TEXT,
  mobile_behavior      TEXT    NOT NULL DEFAULT 'keep'
    CHECK (mobile_behavior IN ('keep', 'hide', 'stack')),
  max_per_session      INT     NOT NULL DEFAULT 1,
  max_per_day          INT     NOT NULL DEFAULT 3,
  cooldown_ms          INT     NOT NULL DEFAULT 3600000,
  label                TEXT    NOT NULL,
  zone                 TEXT    NOT NULL
    CHECK (zone IN ('banner', 'rail', 'inline', 'block')),
  accepted_types       TEXT[]  NOT NULL DEFAULT '{house,cpa}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, slot_key)
);

ALTER TABLE public.ad_slot_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_slot_config_all_service_role" ON public.ad_slot_config;
CREATE POLICY "ad_slot_config_all_service_role"
  ON public.ad_slot_config FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ad_slot_config_select_auth" ON public.ad_slot_config;
CREATE POLICY "ad_slot_config_select_auth"
  ON public.ad_slot_config FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "ad_slot_config_select_anon" ON public.ad_slot_config;
CREATE POLICY "ad_slot_config_select_anon"
  ON public.ad_slot_config FOR SELECT TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_ad_slot_config_site
  ON public.ad_slot_config (site_id);

DROP TRIGGER IF EXISTS update_ad_slot_config_updated_at ON public.ad_slot_config;
CREATE TRIGGER update_ad_slot_config_updated_at
  BEFORE UPDATE ON public.ad_slot_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
