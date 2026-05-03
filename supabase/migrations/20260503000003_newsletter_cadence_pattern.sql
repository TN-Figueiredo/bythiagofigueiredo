-- Newsletter Cadence Pattern Redesign
-- Adds rich cadence_pattern JSONB to newsletter_types (replaces cadence_days)
-- Adds edition_kind to newsletter_editions (cadence vs special)

-- Add cadence_pattern JSONB to newsletter_types
ALTER TABLE newsletter_types
  ADD COLUMN IF NOT EXISTS cadence_pattern jsonb;

-- Add edition_kind to newsletter_editions
ALTER TABLE newsletter_editions
  ADD COLUMN IF NOT EXISTS edition_kind text NOT NULL DEFAULT 'cadence';

-- CHECK constraint for edition_kind
DO $$ BEGIN
  ALTER TABLE newsletter_editions
    ADD CONSTRAINT newsletter_editions_edition_kind_check
    CHECK (edition_kind IN ('cadence', 'special'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Unique constraint: 1 cadence edition per type per slot (excluding cancelled/archived)
-- Prevents double-booking of cadence slots
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_editions_cadence_slot_unique
  ON newsletter_editions (newsletter_type_id, slot_date)
  WHERE edition_kind = 'cadence' AND status NOT IN ('cancelled', 'archived');
