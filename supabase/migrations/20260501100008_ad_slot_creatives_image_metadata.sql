-- Migration: ad_slot_creatives_image_metadata
ALTER TABLE public.ad_slot_creatives
  ADD COLUMN IF NOT EXISTS image_aspect_ratio TEXT,
  ADD COLUMN IF NOT EXISTS image_width        INT,
  ADD COLUMN IF NOT EXISTS image_height       INT;

ALTER TABLE public.ad_slot_creatives
  ADD CONSTRAINT ad_slot_creatives_image_dimensions_positive
    CHECK (
      (image_width IS NULL AND image_height IS NULL)
      OR (image_width > 0 AND image_height > 0)
    );

COMMENT ON COLUMN public.ad_slot_creatives.image_aspect_ratio IS
  'Calculated aspect ratio of the uploaded image (e.g. "8:1"). Validated against ad_slot_config.aspect_ratio on save.';
COMMENT ON COLUMN public.ad_slot_creatives.image_width IS
  'Image width in pixels. NULL until image is uploaded or analysed.';
COMMENT ON COLUMN public.ad_slot_creatives.image_height IS
  'Image height in pixels. NULL until image is uploaded or analysed.';
