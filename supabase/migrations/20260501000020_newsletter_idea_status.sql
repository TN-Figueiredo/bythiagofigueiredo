-- Newsletter CMS Overhaul — Migration 1: idea status + nullable type_id + notes

-- Add 'idea' and 'cancelled' to newsletter_editions status CHECK
ALTER TABLE newsletter_editions DROP CONSTRAINT IF EXISTS newsletter_editions_status_check;
ALTER TABLE newsletter_editions ADD CONSTRAINT newsletter_editions_status_check
  CHECK (status IN ('idea', 'draft', 'ready', 'queued', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'));

-- Allow NULL newsletter_type_id for ideas (unassigned)
ALTER TABLE newsletter_editions ALTER COLUMN newsletter_type_id DROP NOT NULL;

-- Add internal notes column for ideas/drafts
ALTER TABLE newsletter_editions ADD COLUMN IF NOT EXISTS notes text;
