-- Migration: Add type column to ad_campaigns
-- The ad_events repository queries campaign.type for ad targeting.
-- Default 'house' is correct for initial content-site deployment (no CPA ads yet).

ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'house';
