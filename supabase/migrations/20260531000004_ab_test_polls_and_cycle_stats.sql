-- Live polling data (pruned after 7 days)
CREATE TABLE IF NOT EXISTS ab_test_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES ab_test_variants(id) ON DELETE CASCADE,
  polled_at timestamptz NOT NULL DEFAULT now(),
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'client',
  UNIQUE (test_id, variant_id, polled_at)
);

CREATE INDEX IF NOT EXISTS idx_ab_test_polls_test_time ON ab_test_polls (test_id, polled_at DESC);
CREATE INDEX IF NOT EXISTS idx_ab_test_polls_variant ON ab_test_polls (variant_id, polled_at DESC);

-- RLS
ALTER TABLE ab_test_polls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ab_test_polls_select" ON ab_test_polls;
CREATE POLICY "ab_test_polls_select" ON ab_test_polls FOR SELECT
  USING (EXISTS (SELECT 1 FROM ab_tests t WHERE t.id = test_id AND public.can_view_site(t.site_id)));
DROP POLICY IF EXISTS "ab_test_polls_insert" ON ab_test_polls;
CREATE POLICY "ab_test_polls_insert" ON ab_test_polls FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM ab_tests t WHERE t.id = test_id AND public.can_edit_site(t.site_id)));

-- Milestone view snapshots on analytics table
ALTER TABLE youtube_video_analytics
  ADD COLUMN IF NOT EXISTS views_at_24h integer,
  ADD COLUMN IF NOT EXISTS views_at_48h integer,
  ADD COLUMN IF NOT EXISTS views_at_7d integer,
  ADD COLUMN IF NOT EXISTS views_at_30d integer;

-- Cycle-level metrics (populated when cycle closes)
ALTER TABLE ab_test_cycles
  ADD COLUMN IF NOT EXISTS views integer,
  ADD COLUMN IF NOT EXISTS avd_seconds numeric(8,2),
  ADD COLUMN IF NOT EXISTS subscribers_gained integer,
  ADD COLUMN IF NOT EXISTS estimated_revenue numeric(10,4),
  ADD COLUMN IF NOT EXISTS likes integer;
