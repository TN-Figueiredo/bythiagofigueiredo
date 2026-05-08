-- Add qr_card_composition JSONB column to tracked_links
-- Stores the full CardComposition JSON for the QR Card Builder.
-- The existing qr_config column is kept for legacy compatibility.

ALTER TABLE public.tracked_links
  ADD COLUMN IF NOT EXISTS qr_card_composition jsonb;

-- Update link_qr_templates to add composition column (replaces config for new format)
-- The existing config column is kept; new builder writes to composition.
ALTER TABLE public.link_qr_templates
  ADD COLUMN IF NOT EXISTS composition jsonb;

ALTER TABLE public.link_qr_templates
  ADD COLUMN IF NOT EXISTS thumbnail_url text;
