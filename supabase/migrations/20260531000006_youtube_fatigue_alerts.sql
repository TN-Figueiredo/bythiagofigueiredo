-- P4: CTR fatigue detection alerts
CREATE TABLE IF NOT EXISTS youtube_fatigue_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES youtube_videos(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  detected_at timestamptz DEFAULT now(),
  z_score numeric(5,2) NOT NULL,
  expected_ctr numeric(6,4),
  actual_ctr numeric(6,4),
  status text DEFAULT 'pending' CHECK (status IN ('pending','dismissed','resolved')),
  resolved_by_test_id uuid REFERENCES ab_tests(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fatigue_alerts_site_status
ON youtube_fatigue_alerts (site_id, status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_fatigue_alerts_video
ON youtube_fatigue_alerts (video_id, detected_at DESC);

-- RLS
ALTER TABLE youtube_fatigue_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fatigue_alerts_select" ON youtube_fatigue_alerts;
CREATE POLICY "fatigue_alerts_select" ON youtube_fatigue_alerts FOR SELECT
  USING (public.can_view_site(site_id));
DROP POLICY IF EXISTS "fatigue_alerts_insert" ON youtube_fatigue_alerts;
CREATE POLICY "fatigue_alerts_insert" ON youtube_fatigue_alerts FOR INSERT
  WITH CHECK (public.can_edit_site(site_id));
DROP POLICY IF EXISTS "fatigue_alerts_update" ON youtube_fatigue_alerts;
CREATE POLICY "fatigue_alerts_update" ON youtube_fatigue_alerts FOR UPDATE
  USING (public.can_edit_site(site_id));
