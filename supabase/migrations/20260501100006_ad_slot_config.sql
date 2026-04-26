-- Migration: ad_slot_config
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

COMMENT ON TABLE public.ad_slot_config IS
  'Per-slot per-site waterfall configuration. Replaces dispersed config in ad_placeholders + kill_switches.';

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
