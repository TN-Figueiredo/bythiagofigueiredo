-- Newsletter Hub Redesign: new columns for kanban pipeline tracking + timezone

-- Idea stage tracking
ALTER TABLE newsletter_editions
  ADD COLUMN IF NOT EXISTS idea_notes text,
  ADD COLUMN IF NOT EXISTS idea_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_entered_at timestamptz;

-- Site timezone (for schedule display)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sites' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE sites ADD COLUMN timezone text NOT NULL DEFAULT 'America/Sao_Paulo';
  END IF;
END $$;

-- Backfill idea_created_at for existing idea editions
UPDATE newsletter_editions
SET idea_created_at = created_at
WHERE status = 'idea' AND idea_created_at IS NULL;
