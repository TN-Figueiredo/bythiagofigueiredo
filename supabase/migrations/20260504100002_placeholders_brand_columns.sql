-- Migration: add brand_color and logo_url columns to ad_placeholders
-- Required before migration 3 (seed archive slots references these columns)

ALTER TABLE public.ad_placeholders
  ADD COLUMN IF NOT EXISTS brand_color TEXT NOT NULL DEFAULT '#6B7280',
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
