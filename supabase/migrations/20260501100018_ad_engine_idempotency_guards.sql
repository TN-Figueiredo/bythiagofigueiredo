-- Migration: Ad Engine Idempotency Guards
-- Retroactively applies DROP-before-CREATE guards to all ad-engine
-- policies, triggers, constraints, indexes, and FKs that were created
-- without idempotency in earlier migrations (019–100008).
--
-- This is a no-op on a fresh DB where all prior migrations ran cleanly.
-- It ensures partial applies or re-runs do not fail with "already exists".
--
-- Convention: CLAUDE.md §"Idempotência em migrations de RLS"

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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 4. CONSTRAINTS (idempotent via exception handler)
-- ============================================================

-- From 20260501000027_ad_campaigns_brand_locale_interaction.sql
DO $$ BEGIN
  ALTER TABLE public.ad_slot_creatives
    ADD CONSTRAINT ad_slot_creatives_campaign_slot_locale_unique
      UNIQUE (campaign_id, slot_key, locale);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ad_slot_creatives
    ADD CONSTRAINT ad_slot_creatives_interaction_check
      CHECK (interaction IN ('link', 'form'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- From 20260501100004_ad_inquiries_notes_constraint.sql
DO $$ BEGIN
  ALTER TABLE public.ad_inquiries
    ADD CONSTRAINT ad_inquiries_admin_notes_length
      CHECK (admin_notes IS NULL OR length(admin_notes) <= 5000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- From 20260501100005_ad_engine_org_adsense_columns.sql
DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_adsense_publisher_id_format
      CHECK (adsense_publisher_id IS NULL OR adsense_publisher_id ~ '^ca-pub-[0-9]+$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_adsense_sync_status_check
      CHECK (adsense_sync_status IN ('ok', 'error', 'pending', 'disconnected'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- From 20260501100008_ad_slot_creatives_image_metadata.sql
DO $$ BEGIN
  ALTER TABLE public.ad_slot_creatives
    ADD CONSTRAINT ad_slot_creatives_image_dimensions_positive
      CHECK (
        (image_width IS NULL AND image_height IS NULL)
        OR (image_width > 0 AND image_height > 0)
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5. INDEXES (IF NOT EXISTS)
-- ============================================================

-- From 20260501100003_ad_inquiries.sql (original used bare CREATE INDEX)
CREATE INDEX IF NOT EXISTS idx_ad_inquiries_app_id    ON public.ad_inquiries(app_id);
CREATE INDEX IF NOT EXISTS idx_ad_inquiries_status    ON public.ad_inquiries(app_id, status);
CREATE INDEX IF NOT EXISTS idx_ad_inquiries_submitted ON public.ad_inquiries(app_id, submitted_at DESC);

COMMIT;
