-- Migration: Add CHECK constraints to ad_campaigns TEXT columns
--
-- Allowed values:
--   ad_campaigns.status        : 'draft', 'active', 'paused', 'archived'
--   ad_campaigns.type          : 'house', 'cpa'
--   ad_campaigns.format        : 'image', 'video', 'native', 'house'
--   ad_campaigns.pricing_model : 'cpm', 'cpc', 'cpa', 'flat', 'house_free'
--
-- ad_slot_creatives.interaction already has CHECK from migration 027.
-- ad_events.event_type keeps 'interest' for backward compat (no longer sent by ad-engine@1.0.0).

-- 1. ad_campaigns.status
DO $$ BEGIN
  ALTER TABLE public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_status_check
    CHECK (status IN ('draft', 'active', 'paused', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. ad_campaigns.type
DO $$ BEGIN
  ALTER TABLE public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_type_check
    CHECK (type IN ('house', 'cpa'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. ad_campaigns.format
DO $$ BEGIN
  ALTER TABLE public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_format_check
    CHECK (format IN ('image', 'video', 'native', 'house'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. ad_campaigns.pricing_model
DO $$ BEGIN
  ALTER TABLE public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_pricing_model_check
    CHECK (pricing_model IN ('cpm', 'cpc', 'cpa', 'flat', 'house_free'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
