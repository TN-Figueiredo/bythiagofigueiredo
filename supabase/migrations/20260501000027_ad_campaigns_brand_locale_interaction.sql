-- Migration 2: Add brand identity, locale, and interaction type columns.

-- Brand identity on campaigns
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS brand_color TEXT NOT NULL DEFAULT '#6B7280';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Locale support on creatives
ALTER TABLE ad_slot_creatives ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'pt-BR';

-- Unique constraint for campaign+slot+locale combination
ALTER TABLE ad_slot_creatives ADD CONSTRAINT ad_slot_creatives_campaign_slot_locale_unique
  UNIQUE (campaign_id, slot_key, locale);

-- Interaction type on creatives (link = regular CTA, form = inline email capture)
ALTER TABLE ad_slot_creatives ADD COLUMN IF NOT EXISTS interaction TEXT NOT NULL DEFAULT 'link';
ALTER TABLE ad_slot_creatives ADD CONSTRAINT ad_slot_creatives_interaction_check
  CHECK (interaction IN ('link', 'form'));
