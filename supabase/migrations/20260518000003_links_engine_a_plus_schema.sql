-- Links Engine A++ Schema Migration
-- Adds: lifecycle columns, UTM normalization, health check, click ID support

-- 1. New columns on tracked_links
ALTER TABLE tracked_links
  ADD COLUMN IF NOT EXISTS custom_params jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS launched_at timestamptz,
  ADD COLUMN IF NOT EXISTS activates_at timestamptz,
  ADD COLUMN IF NOT EXISTS utm_id text,
  ADD COLUMN IF NOT EXISTS health_status text DEFAULT 'unchecked' NOT NULL,
  ADD COLUMN IF NOT EXISTS health_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS pass_click_ids boolean DEFAULT true NOT NULL;

-- 2. Constraints
ALTER TABLE tracked_links DROP CONSTRAINT IF EXISTS chk_activation_before_expiry;
ALTER TABLE tracked_links
  ADD CONSTRAINT chk_activation_before_expiry
    CHECK (activates_at IS NULL OR expires_at IS NULL OR activates_at < expires_at);

ALTER TABLE tracked_links DROP CONSTRAINT IF EXISTS chk_health_status_values;
ALTER TABLE tracked_links
  ADD CONSTRAINT chk_health_status_values
    CHECK (health_status IN ('unchecked', 'healthy', 'unhealthy', 'timeout', 'dns_error'));

ALTER TABLE tracked_links DROP CONSTRAINT IF EXISTS tracked_links_redirect_type_check;
ALTER TABLE tracked_links ADD CONSTRAINT tracked_links_redirect_type_check
  CHECK (redirect_type IN (301, 302, 307, 308));

ALTER TABLE tracked_links ALTER COLUMN redirect_type SET DEFAULT 307;

ALTER TABLE link_settings DROP CONSTRAINT IF EXISTS link_settings_default_redirect_type_check;
ALTER TABLE link_settings ADD CONSTRAINT link_settings_default_redirect_type_check
  CHECK (default_redirect_type IN (301, 302, 307, 308));

-- 3. New columns on link_clicks (partitioned — parent propagates to partitions)
ALTER TABLE link_clicks
  ADD COLUMN IF NOT EXISTS ad_click_ids jsonb,
  ADD COLUMN IF NOT EXISTS utm_id text;

-- 4. New column on link_utm_presets
ALTER TABLE link_utm_presets
  ADD COLUMN IF NOT EXISTS utm_id text;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_tracked_links_launched_at
  ON tracked_links (launched_at) WHERE launched_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracked_links_activates_at
  ON tracked_links (activates_at) WHERE activates_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracked_links_health_check_candidates
  ON tracked_links (health_checked_at NULLS FIRST)
  WHERE active = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_link_clicks_ad_click_ids_not_null
  ON link_clicks (clicked_at) WHERE ad_click_ids IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracked_links_launched_null
  ON tracked_links (id) WHERE launched_at IS NULL;

-- 6. UTM normalization function
CREATE OR REPLACE FUNCTION public.normalize_utm_value(
  field_name text, raw_value text
) RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE v text;
BEGIN
  IF raw_value IS NULL THEN RETURN NULL; END IF;
  v := raw_value;
  IF field_name = 'utm_term' THEN
    v := lower(trim(v));
    RETURN NULLIF(v, '');
  END IF;
  v := normalize(v, NFKD);
  v := regexp_replace(v, E'[\\u0300-\\u036F]', '', 'g');
  v := lower(trim(v));
  v := regexp_replace(v, '\s+', '-', 'g');
  v := regexp_replace(v, '[^a-z0-9._\-]', '', 'g');
  v := regexp_replace(v, '-{2,}', '-', 'g');
  v := regexp_replace(v, '^-+|-+$', '', 'g');
  RETURN NULLIF(v, '');
END; $$;

-- 7. UTM normalization trigger for tracked_links
CREATE OR REPLACE FUNCTION public.trg_normalize_tracked_links_utm() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Short-circuit on UPDATE when no UTM field changed (critical for performance:
  -- increment_link_clicks RPC does UPDATE on total_clicks which fires this trigger
  -- on every single click — without this guard, 6 unnecessary normalizations per click)
  IF TG_OP = 'UPDATE' AND
     NEW.utm_source   IS NOT DISTINCT FROM OLD.utm_source AND
     NEW.utm_medium   IS NOT DISTINCT FROM OLD.utm_medium AND
     NEW.utm_campaign IS NOT DISTINCT FROM OLD.utm_campaign AND
     NEW.utm_term     IS NOT DISTINCT FROM OLD.utm_term AND
     NEW.utm_content  IS NOT DISTINCT FROM OLD.utm_content AND
     NEW.utm_id       IS NOT DISTINCT FROM OLD.utm_id THEN
    RETURN NEW;
  END IF;

  NEW.utm_source   := public.normalize_utm_value('utm_source',   NEW.utm_source);
  NEW.utm_medium   := public.normalize_utm_value('utm_medium',   NEW.utm_medium);
  NEW.utm_campaign := public.normalize_utm_value('utm_campaign', NEW.utm_campaign);
  NEW.utm_term     := public.normalize_utm_value('utm_term',     NEW.utm_term);
  NEW.utm_content  := public.normalize_utm_value('utm_content',  NEW.utm_content);
  NEW.utm_id       := public.normalize_utm_value('utm_id',       NEW.utm_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS normalize_utm_before_upsert ON tracked_links;
CREATE TRIGGER normalize_utm_before_upsert
  BEFORE INSERT OR UPDATE ON tracked_links
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_tracked_links_utm();

-- 8. UTM normalization trigger for link_utm_presets
CREATE OR REPLACE FUNCTION public.trg_normalize_utm_presets() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.utm_source   := public.normalize_utm_value('utm_source',   NEW.utm_source);
  NEW.utm_medium   := public.normalize_utm_value('utm_medium',   NEW.utm_medium);
  NEW.utm_campaign := public.normalize_utm_value('utm_campaign', NEW.utm_campaign);
  NEW.utm_term     := public.normalize_utm_value('utm_term',     NEW.utm_term);
  NEW.utm_content  := public.normalize_utm_value('utm_content',  NEW.utm_content);
  NEW.utm_id       := public.normalize_utm_value('utm_id',       NEW.utm_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS normalize_utm_before_upsert ON link_utm_presets;
CREATE TRIGGER normalize_utm_before_upsert
  BEFORE INSERT OR UPDATE ON link_utm_presets
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_utm_presets();
