-- Migration: ad_engine_org_adsense_columns
-- Adds Google AdSense OAuth columns to organizations.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS adsense_publisher_id        TEXT,
  ADD COLUMN IF NOT EXISTS adsense_refresh_token_enc   TEXT,
  ADD COLUMN IF NOT EXISTS adsense_connected_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adsense_last_sync_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adsense_sync_status         TEXT NOT NULL DEFAULT 'disconnected';

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_adsense_publisher_id_format
    CHECK (adsense_publisher_id IS NULL OR adsense_publisher_id ~ '^ca-pub-[0-9]+$');

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_adsense_sync_status_check
    CHECK (adsense_sync_status IN ('ok', 'error', 'pending', 'disconnected'));

COMMENT ON COLUMN public.organizations.adsense_publisher_id IS
  'Google AdSense publisher ID (ca-pub-XXXXX). One per org; shared across org''s sites.';
COMMENT ON COLUMN public.organizations.adsense_refresh_token_enc IS
  'OAuth2 refresh token encrypted with AES-256-GCM. Decryption key in ADSENSE_TOKEN_KEY env var — never stored in DB.';
COMMENT ON COLUMN public.organizations.adsense_sync_status IS
  'Current state of the AdSense data sync: disconnected | pending | ok | error.';
