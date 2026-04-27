-- Migration: Ad Engine Idempotency Guards
-- Retroactively applies DROP-before-CREATE guards to all ad-engine
-- policies, triggers, constraints, indexes, and FKs that were created
-- without idempotency in earlier migrations (019–100008).
--
-- REPAIR BLOCK: migrations 100000–100006 were recorded as applied but
-- their DDL never committed. Re-apply all missing DDL with IF NOT EXISTS
-- before the idempotency guards run.
--
-- Convention: CLAUDE.md §"Idempotência em migrations de RLS"

-- ============================================================
-- 0. REPAIR: re-create objects from phantom-applied migrations
-- ============================================================

-- From 100000: authors columns
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE;
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS avatar_color TEXT;
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE public.authors ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- From 100001: app_id columns + ad_media table
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS app_id TEXT NOT NULL DEFAULT 'bythiagofigueiredo';
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_app_id ON public.ad_campaigns(app_id);
ALTER TABLE public.ad_placeholders ADD COLUMN IF NOT EXISTS app_id TEXT NOT NULL DEFAULT 'bythiagofigueiredo';
CREATE INDEX IF NOT EXISTS idx_ad_placeholders_app_id ON public.ad_placeholders(app_id);
ALTER TABLE public.ad_slot_metrics ADD COLUMN IF NOT EXISTS app_id TEXT NOT NULL DEFAULT 'bythiagofigueiredo';

CREATE TABLE IF NOT EXISTS public.ad_media (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id      TEXT        NOT NULL DEFAULT 'bythiagofigueiredo',
  url         TEXT,
  filename    TEXT,
  size_bytes  INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ad_media_app_id ON public.ad_media(app_id);
ALTER TABLE public.ad_media ENABLE ROW LEVEL SECURITY;

-- From 100003: ad_inquiries table
DO $$ BEGIN
  CREATE TABLE public.ad_inquiries (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id             TEXT        NOT NULL DEFAULT 'bythiagofigueiredo',
    name               TEXT        NOT NULL CHECK (length(name) BETWEEN 2 AND 200),
    email              CITEXT      NOT NULL CHECK (length(email) BETWEEN 5 AND 320),
    company            TEXT        CHECK (company IS NULL OR length(company) <= 200),
    website            TEXT        CHECK (website IS NULL OR length(website) <= 500),
    message            TEXT        NOT NULL CHECK (length(message) BETWEEN 10 AND 5000),
    budget             TEXT        CHECK (budget IS NULL OR budget IN ('under_500', '500_2000', '2000_5000', 'above_5000', 'not_sure')),
    preferred_slots    TEXT[]      DEFAULT '{}',
    status             TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'negotiating', 'converted', 'archived')),
    admin_notes        TEXT,
    ip                 INET,
    user_agent         TEXT,
    consent_processing BOOLEAN     NOT NULL DEFAULT true,
    consent_version    TEXT        NOT NULL,
    submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    contacted_at       TIMESTAMPTZ,
    converted_at       TIMESTAMPTZ
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
ALTER TABLE public.ad_inquiries ENABLE ROW LEVEL SECURITY;

-- From 100005: adsense columns on organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS adsense_publisher_id TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS adsense_refresh_token_enc TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS adsense_connected_at TIMESTAMPTZ;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS adsense_last_sync_at TIMESTAMPTZ;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS adsense_sync_status TEXT NOT NULL DEFAULT 'disconnected';

-- From 100015: ad_media column renames (url→public_url, filename→file_name)
DO $$ BEGIN
  ALTER TABLE public.ad_media RENAME COLUMN url TO public_url;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.ad_media RENAME COLUMN filename TO file_name;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;
ALTER TABLE public.ad_media ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.ad_media ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE public.ad_media ADD COLUMN IF NOT EXISTS public_url TEXT;
ALTER TABLE public.ad_media ADD COLUMN IF NOT EXISTS file_name TEXT;

-- ============================================================

BEGIN;

-- ============================================================
-- 1. POLICIES (drop + recreate)
-- ============================================================

-- From 20260501000019_ad_engine_foundation.sql
DROP POLICY IF EXISTS "ad_events_insert_authenticated" ON public.ad_events;
CREATE POLICY "ad_events_insert_authenticated"
  ON public.ad_events FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ad_events_all_service_role" ON public.ad_events;
CREATE POLICY "ad_events_all_service_role"
  ON public.ad_events FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_app_presence_all_service_role" ON public.user_app_presence;
CREATE POLICY "user_app_presence_all_service_role"
  ON public.user_app_presence FOR ALL TO service_role USING (true) WITH CHECK (true);

-- From 20260501000020_ad_campaigns_wizard.sql
DROP POLICY IF EXISTS "service_role_all" ON public.ad_campaigns;
CREATE POLICY "service_role_all"
  ON public.ad_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all" ON public.ad_slot_creatives;
CREATE POLICY "service_role_all"
  ON public.ad_slot_creatives FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all" ON public.ad_slot_metrics;
CREATE POLICY "service_role_all"
  ON public.ad_slot_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ad_campaigns_select_auth" ON public.ad_campaigns;
CREATE POLICY "ad_campaigns_select_auth"
  ON public.ad_campaigns FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ad_slot_creatives_select_auth" ON public.ad_slot_creatives;
CREATE POLICY "ad_slot_creatives_select_auth"
  ON public.ad_slot_creatives FOR SELECT TO authenticated USING (true);

-- From 20260501000021_ad_placeholders.sql
DROP POLICY IF EXISTS "ad_placeholders_select_authenticated" ON public.ad_placeholders;
CREATE POLICY "ad_placeholders_select_authenticated"
  ON public.ad_placeholders FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ad_placeholders_all_service_role" ON public.ad_placeholders;
CREATE POLICY "ad_placeholders_all_service_role"
  ON public.ad_placeholders FOR ALL TO service_role USING (true);

-- From 20260501000023_ad_kill_switches.sql
DROP POLICY IF EXISTS "kill_switches_all_service_role" ON public.kill_switches;
CREATE POLICY "kill_switches_all_service_role"
  ON public.kill_switches FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "kill_switches_select_authenticated" ON public.kill_switches;
CREATE POLICY "kill_switches_select_authenticated"
  ON public.kill_switches FOR SELECT TO authenticated USING (true);

-- From 20260501100001_ad_app_id_and_media.sql
DROP POLICY IF EXISTS "service_role_all" ON public.ad_media;
CREATE POLICY "service_role_all"
  ON public.ad_media FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ad_media_select_auth" ON public.ad_media;
CREATE POLICY "ad_media_select_auth"
  ON public.ad_media FOR SELECT TO authenticated USING (true);

-- From 20260501100003_ad_inquiries.sql
DROP POLICY IF EXISTS "service_role_all" ON public.ad_inquiries;
CREATE POLICY "service_role_all"
  ON public.ad_inquiries FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ad_inquiries_select_auth" ON public.ad_inquiries;
CREATE POLICY "ad_inquiries_select_auth"
  ON public.ad_inquiries FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ad_inquiries_insert_anon" ON public.ad_inquiries;
CREATE POLICY "ad_inquiries_insert_anon"
  ON public.ad_inquiries FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "ad_inquiries_insert_auth" ON public.ad_inquiries;
CREATE POLICY "ad_inquiries_insert_auth"
  ON public.ad_inquiries FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 2. TRIGGER (drop + recreate)
-- ============================================================

-- From 20260501000020_ad_campaigns_wizard.sql
DROP TRIGGER IF EXISTS update_ad_campaigns_updated_at ON public.ad_campaigns;
CREATE TRIGGER update_ad_campaigns_updated_at
  BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. FOREIGN KEY (idempotent via exception handler)
-- ============================================================

-- From 20260501000020_ad_campaigns_wizard.sql
DO $$ BEGIN
  ALTER TABLE public.ad_events
    ADD CONSTRAINT ad_events_ad_id_fkey
      FOREIGN KEY (ad_id) REFERENCES public.ad_campaigns(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- ============================================================
-- 4. CONSTRAINTS (idempotent via exception handler)
-- ============================================================

-- From 20260501000027_ad_campaigns_brand_locale_interaction.sql
DO $$ BEGIN
  ALTER TABLE public.ad_slot_creatives
    ADD CONSTRAINT ad_slot_creatives_campaign_slot_locale_unique
      UNIQUE (campaign_id, slot_key, locale);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ad_slot_creatives
    ADD CONSTRAINT ad_slot_creatives_interaction_check
      CHECK (interaction IN ('link', 'form'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- From 20260501100004_ad_inquiries_notes_constraint.sql
DO $$ BEGIN
  ALTER TABLE public.ad_inquiries
    ADD CONSTRAINT ad_inquiries_admin_notes_length
      CHECK (admin_notes IS NULL OR length(admin_notes) <= 5000);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- From 20260501100005_ad_engine_org_adsense_columns.sql
DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_adsense_publisher_id_format
      CHECK (adsense_publisher_id IS NULL OR adsense_publisher_id ~ '^ca-pub-[0-9]+$');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_adsense_sync_status_check
      CHECK (adsense_sync_status IN ('ok', 'error', 'pending', 'disconnected'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- From 20260501100008_ad_slot_creatives_image_metadata.sql
DO $$ BEGIN
  ALTER TABLE public.ad_slot_creatives
    ADD CONSTRAINT ad_slot_creatives_image_dimensions_positive
      CHECK (
        (image_width IS NULL AND image_height IS NULL)
        OR (image_width > 0 AND image_height > 0)
      );
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- ============================================================
-- 5. INDEXES (IF NOT EXISTS)
-- ============================================================

-- From 20260501100003_ad_inquiries.sql (original used bare CREATE INDEX)
CREATE INDEX IF NOT EXISTS idx_ad_inquiries_app_id    ON public.ad_inquiries(app_id);
CREATE INDEX IF NOT EXISTS idx_ad_inquiries_status    ON public.ad_inquiries(app_id, status);
CREATE INDEX IF NOT EXISTS idx_ad_inquiries_submitted ON public.ad_inquiries(app_id, submitted_at DESC);

COMMIT;
