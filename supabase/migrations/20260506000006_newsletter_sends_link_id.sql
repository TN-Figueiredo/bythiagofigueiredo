-- Add link_id to newsletter_sends so each email send can reference the tracked
-- short link that was embedded in the email (one-click unsubscribe + click
-- attribution).  Nullable: legacy sends have no tracked link.
ALTER TABLE newsletter_sends
  ADD COLUMN IF NOT EXISTS link_id uuid REFERENCES tracked_links(id) ON DELETE SET NULL;

-- Index for joining newsletter_sends → tracked_links (attribution dashboard).
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_link_id
  ON newsletter_sends (link_id)
  WHERE link_id IS NOT NULL;
