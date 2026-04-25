-- Migration: Ad Engine Foundation
-- Source: @tn-figueiredo/ad-engine@0.2.0 migrations/001_ad_engine_foundation.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared trigger function used by ad_campaigns and other tables
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Table: ad_events (nullable ad_id — FK added after ad_campaigns exists in migration 020)
CREATE TABLE IF NOT EXISTS public.ad_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id       UUID,
  event_type  TEXT NOT NULL
    CHECK (event_type IN ('impression', 'click', 'dismiss', 'interest')),
  user_hash   TEXT NOT NULL,
  app_id      TEXT NOT NULL,
  slot_id     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: user_app_presence
CREATE TABLE IF NOT EXISTS public.user_app_presence (
  email_hash  TEXT NOT NULL,
  app_id      TEXT NOT NULL,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (email_hash, app_id)
);

ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_app_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_events_insert_authenticated"
  ON public.ad_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ad_events_all_service_role"
  ON public.ad_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "user_app_presence_all_service_role"
  ON public.user_app_presence FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ad_events_user_hash    ON public.ad_events (user_hash);
CREATE INDEX IF NOT EXISTS idx_ad_events_created_at   ON public.ad_events (created_at);
CREATE INDEX IF NOT EXISTS idx_ad_events_event_type   ON public.ad_events (event_type);
CREATE INDEX IF NOT EXISTS idx_user_app_presence_hash ON public.user_app_presence (email_hash);
