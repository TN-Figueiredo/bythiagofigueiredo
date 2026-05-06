-- link_settings — one row per site, JSONB config
CREATE TABLE IF NOT EXISTS link_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) UNIQUE,
  default_redirect_type smallint NOT NULL DEFAULT 302 CHECK (default_redirect_type IN (301, 302)),
  default_code_length smallint NOT NULL DEFAULT 6 CHECK (default_code_length BETWEEN 4 AND 16),
  auto_qr boolean NOT NULL DEFAULT false,
  bot_filtering boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE link_settings ENABLE ROW LEVEL SECURITY;

-- RLS: staff can read/write their site's settings
DROP POLICY IF EXISTS "link_settings_staff_read" ON link_settings;
CREATE POLICY "link_settings_staff_read" ON link_settings
  FOR SELECT USING (public.can_view_site(site_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "link_settings_staff_write" ON link_settings;
CREATE POLICY "link_settings_staff_write" ON link_settings
  FOR ALL USING (public.can_edit_site(site_id) OR public.is_super_admin());

-- utm_presets — saved UTM combinations per site
CREATE TABLE IF NOT EXISTS link_utm_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE link_utm_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "link_utm_presets_staff_read" ON link_utm_presets;
CREATE POLICY "link_utm_presets_staff_read" ON link_utm_presets
  FOR SELECT USING (public.can_view_site(site_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "link_utm_presets_staff_write" ON link_utm_presets;
CREATE POLICY "link_utm_presets_staff_write" ON link_utm_presets
  FOR ALL USING (public.can_edit_site(site_id) OR public.is_super_admin());

-- qr_templates — saved QR styling per site
CREATE TABLE IF NOT EXISTS link_qr_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  thumbnail_path text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE link_qr_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "link_qr_templates_staff_read" ON link_qr_templates;
CREATE POLICY "link_qr_templates_staff_read" ON link_qr_templates
  FOR SELECT USING (public.can_view_site(site_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "link_qr_templates_staff_write" ON link_qr_templates;
CREATE POLICY "link_qr_templates_staff_write" ON link_qr_templates
  FOR ALL USING (public.can_edit_site(site_id) OR public.is_super_admin());
