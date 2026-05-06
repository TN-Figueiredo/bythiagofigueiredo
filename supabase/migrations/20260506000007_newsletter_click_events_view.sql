-- Migrate existing click events to link_clicks before dropping the old table.
-- link_clicks is partitioned by clicked_at; we insert into the parent and let
-- PostgreSQL route each row to the correct partition.
-- The source_type 'newsletter' distinguishes these rows.

-- Step 0: Create a default partition for link_clicks to catch any historical
-- rows whose clicked_at falls outside the explicit monthly partitions.
CREATE TABLE IF NOT EXISTS public.link_clicks_default
  PARTITION OF public.link_clicks DEFAULT;

-- Step 1: Backfill tracked_links entries for any newsletter click event that
-- does not yet have a corresponding tracked_link row.  For each unique
-- (edition_id, url) pair we create a manual tracked_link so FK referential
-- integrity can be established after the table swap.
DO $$
DECLARE
  v_site_id uuid;
BEGIN
  -- Resolve the master site (used as fallback when edition has no site_id).
  SELECT id INTO v_site_id FROM sites ORDER BY created_at LIMIT 1;

  -- Skip if no sites exist (empty dev DB) or no click events to migrate.
  IF v_site_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM newsletter_click_events LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO tracked_links (site_id, code, destination_url, source_type, created_at)
  SELECT DISTINCT
    coalesce(ne.site_id, v_site_id),
    public.generate_link_code(coalesce(ne.site_id, v_site_id)),
    nce.url,
    'newsletter',
    now()
  FROM newsletter_click_events nce
  LEFT JOIN newsletter_sends ns ON ns.id = nce.send_id
  LEFT JOIN newsletter_editions ne ON ne.id = ns.edition_id
  WHERE NOT EXISTS (
    SELECT 1 FROM tracked_links tl
    WHERE tl.destination_url = nce.url
      AND tl.source_type = 'newsletter'
  );
END $$;

-- Step 2: Copy rows from newsletter_click_events into link_clicks.
INSERT INTO link_clicks (
  link_id,
  site_id,
  user_agent,
  ip,
  referrer_url,
  clicked_at
)
SELECT
  tl.id,
  coalesce(ne.site_id, (SELECT id FROM sites ORDER BY created_at LIMIT 1)),
  nce.user_agent,
  nce.ip::text,
  NULL,
  nce.clicked_at
FROM newsletter_click_events nce
LEFT JOIN newsletter_sends ns ON ns.id = nce.send_id
LEFT JOIN newsletter_editions ne ON ne.id = ns.edition_id
LEFT JOIN tracked_links tl ON tl.destination_url = nce.url AND tl.source_type = 'newsletter'
WHERE tl.id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 3: Drop the old table (data now lives in link_clicks + legacy rows are
-- preserved in the view below).
DROP TABLE IF EXISTS newsletter_click_events;

-- Step 4: Re-create newsletter_click_events as a view over link_clicks filtered
-- to newsletter source links.  Callers that reference the table for reads
-- (analytics, webhooks) continue to work without code changes.
CREATE OR REPLACE VIEW newsletter_click_events AS
  SELECT
    lc.id,
    ns.id           AS send_id,
    tl.destination_url AS url,
    lc.ip,
    lc.user_agent,
    lc.clicked_at
  FROM link_clicks lc
  JOIN tracked_links tl    ON tl.id = lc.link_id
  JOIN newsletter_sends ns ON ns.link_id = tl.id
  WHERE tl.source_type = 'newsletter';
