-- Add geo and device columns to content_events for analytics enrichment.
-- All nullable: existing rows stay NULL (pre-feature data). No backfill needed.

ALTER TABLE content_events
  ADD COLUMN IF NOT EXISTS country     text,
  ADD COLUMN IF NOT EXISTS city        text,
  ADD COLUMN IF NOT EXISTS region      text,
  ADD COLUMN IF NOT EXISTS device_type text;

DO $$ BEGIN
  ALTER TABLE content_events
    ADD CONSTRAINT content_events_device_type_check
    CHECK (device_type IS NULL OR device_type IN ('mobile','desktop','tablet','bot'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
