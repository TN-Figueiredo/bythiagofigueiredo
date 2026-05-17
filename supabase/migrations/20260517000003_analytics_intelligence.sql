-- YouTube Analytics Intelligence Engine
-- Adds: youtube_video_analytics, video_grade_history, optimization_cycles,
--        yt_notifications, youtube_intelligence, youtube_intelligence_tasks
-- Modifies: youtube_videos (new analytics columns)

-- =============================================================================
-- 1. Add analytics columns to youtube_videos
-- =============================================================================
ALTER TABLE youtube_videos
  ADD COLUMN IF NOT EXISTS ctr NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS impressions INTEGER,
  ADD COLUMN IF NOT EXISTS avg_view_percentage NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS avg_view_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS retention_curve JSONB,
  ADD COLUMN IF NOT EXISTS traffic_sources JSONB,
  ADD COLUMN IF NOT EXISTS last_analytics_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS view_count_yesterday INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count_delta_today INTEGER DEFAULT 0;

-- =============================================================================
-- 2. youtube_video_analytics — daily metrics per video
-- =============================================================================
CREATE TABLE youtube_video_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_video_id UUID NOT NULL REFERENCES youtube_videos(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  ctr NUMERIC(6,4) NOT NULL DEFAULT 0,
  avg_view_duration_seconds INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  subscribers_gained INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_yt_video_analytics_video_date
  ON youtube_video_analytics (youtube_video_id, date);
CREATE INDEX idx_yt_video_analytics_site_date
  ON youtube_video_analytics (site_id, date);

ALTER TABLE youtube_video_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "yt_video_analytics_select" ON youtube_video_analytics;
CREATE POLICY "yt_video_analytics_select" ON youtube_video_analytics
  FOR SELECT USING (public.can_view_site(site_id));
DROP POLICY IF EXISTS "yt_video_analytics_insert" ON youtube_video_analytics;
CREATE POLICY "yt_video_analytics_insert" ON youtube_video_analytics
  FOR INSERT WITH CHECK (public.can_edit_site(site_id));

-- =============================================================================
-- 3. video_grade_history — weekly snapshots
-- =============================================================================
CREATE TABLE video_grade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_video_id UUID NOT NULL REFERENCES youtube_videos(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  grade TEXT NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D')),
  score NUMERIC(5,2) NOT NULL,
  ctr NUMERIC(6,4),
  retention NUMERIC(5,2),
  reach NUMERIC(5,2),
  engagement NUMERIC(5,2),
  growth NUMERIC(5,2),
  sub_impact NUMERIC(5,2),
  view_count INTEGER,
  week_iso TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_video_grade_history_video_week
  ON video_grade_history (youtube_video_id, week_iso);
CREATE INDEX idx_video_grade_history_site_week
  ON video_grade_history (site_id, week_iso);

ALTER TABLE video_grade_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "video_grade_history_select" ON video_grade_history;
CREATE POLICY "video_grade_history_select" ON video_grade_history
  FOR SELECT USING (public.can_view_site(site_id));
DROP POLICY IF EXISTS "video_grade_history_insert" ON video_grade_history;
CREATE POLICY "video_grade_history_insert" ON video_grade_history
  FOR INSERT WITH CHECK (public.can_edit_site(site_id));

-- =============================================================================
-- 4. optimization_cycles — state machine
-- =============================================================================
CREATE TABLE optimization_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_video_id UUID NOT NULL REFERENCES youtube_videos(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'flagged'
    CHECK (state IN ('unmonitored','flagged','diagnosed','test_suggested','testing','post_test_monitoring','resolved','retest_needed','exhausted')),
  cycle_number INTEGER NOT NULL DEFAULT 1,
  flagged_at TIMESTAMPTZ,
  diagnosed_at TIMESTAMPTZ,
  diagnosis_summary TEXT,
  test_suggested_at TIMESTAMPTZ,
  test_suggestion JSONB,
  ab_test_id UUID REFERENCES ab_tests(id),
  testing_started_at TIMESTAMPTZ,
  test_completed_at TIMESTAMPTZ,
  test_winner_applied_at TIMESTAMPTZ,
  monitoring_day7_at TIMESTAMPTZ,
  monitoring_day7_result JSONB,
  monitoring_day14_at TIMESTAMPTZ,
  monitoring_day14_result JSONB,
  monitoring_day30_at TIMESTAMPTZ,
  monitoring_day30_result JSONB,
  resolved_at TIMESTAMPTZ,
  resolved_reason TEXT,
  cooldown_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only 1 active cycle per video
CREATE UNIQUE INDEX idx_optimization_cycles_active
  ON optimization_cycles (youtube_video_id)
  WHERE state NOT IN ('resolved', 'exhausted', 'unmonitored');

CREATE INDEX idx_optimization_cycles_site_state
  ON optimization_cycles (site_id, state);
CREATE INDEX idx_optimization_cycles_monitoring
  ON optimization_cycles (state, test_winner_applied_at)
  WHERE state = 'post_test_monitoring';

ALTER TABLE optimization_cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "optimization_cycles_select" ON optimization_cycles;
CREATE POLICY "optimization_cycles_select" ON optimization_cycles
  FOR SELECT USING (public.can_view_site(site_id));
DROP POLICY IF EXISTS "optimization_cycles_insert" ON optimization_cycles;
CREATE POLICY "optimization_cycles_insert" ON optimization_cycles
  FOR INSERT WITH CHECK (public.can_edit_site(site_id));
DROP POLICY IF EXISTS "optimization_cycles_update" ON optimization_cycles;
CREATE POLICY "optimization_cycles_update" ON optimization_cycles
  FOR UPDATE USING (public.can_edit_site(site_id));

CREATE TRIGGER set_optimization_cycles_updated_at
  BEFORE UPDATE ON optimization_cycles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 5. yt_notifications — CMS notification storage
-- =============================================================================
CREATE TABLE yt_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  youtube_video_id UUID REFERENCES youtube_videos(id) ON DELETE SET NULL,
  ab_test_id UUID REFERENCES ab_tests(id) ON DELETE SET NULL,
  optimization_cycle_id UUID REFERENCES optimization_cycles(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'grade_drop','ctr_drop','monitoring_alert','ab_test_completed',
    'retest_suggested','optimization_available','trending_viral','optimization_resolved'
  )),
  priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  suggested_action TEXT,
  action_href TEXT,
  dedup_key TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  expired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_yt_notifications_dedup
  ON yt_notifications (site_id, dedup_key);
CREATE INDEX idx_yt_notifications_site_unread
  ON yt_notifications (site_id, read, created_at DESC)
  WHERE dismissed = false AND expired_at IS NULL;

ALTER TABLE yt_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "yt_notifications_select" ON yt_notifications;
CREATE POLICY "yt_notifications_select" ON yt_notifications
  FOR SELECT USING (public.can_view_site(site_id));
DROP POLICY IF EXISTS "yt_notifications_insert" ON yt_notifications;
CREATE POLICY "yt_notifications_insert" ON yt_notifications
  FOR INSERT WITH CHECK (public.can_edit_site(site_id));
DROP POLICY IF EXISTS "yt_notifications_update" ON yt_notifications;
CREATE POLICY "yt_notifications_update" ON yt_notifications
  FOR UPDATE USING (public.can_edit_site(site_id));

-- =============================================================================
-- 6. youtube_intelligence — Cowork AI analysis storage
-- =============================================================================
CREATE TABLE youtube_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
  video_id UUID REFERENCES youtube_videos(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('video', 'channel')),
  recommendations JSONB,
  analysis_text TEXT,
  patterns_detected JSONB,
  coaching JSONB,
  source TEXT NOT NULL DEFAULT 'cowork',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_youtube_intelligence_dedup
  ON youtube_intelligence (site_id, channel_id, video_id, source)
  WHERE video_id IS NOT NULL;
CREATE UNIQUE INDEX idx_youtube_intelligence_channel_dedup
  ON youtube_intelligence (site_id, channel_id, source)
  WHERE video_id IS NULL;

ALTER TABLE youtube_intelligence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "youtube_intelligence_select" ON youtube_intelligence;
CREATE POLICY "youtube_intelligence_select" ON youtube_intelligence
  FOR SELECT USING (public.can_view_site(site_id));
DROP POLICY IF EXISTS "youtube_intelligence_insert" ON youtube_intelligence;
CREATE POLICY "youtube_intelligence_insert" ON youtube_intelligence
  FOR INSERT WITH CHECK (public.can_edit_site(site_id));
DROP POLICY IF EXISTS "youtube_intelligence_update" ON youtube_intelligence;
CREATE POLICY "youtube_intelligence_update" ON youtube_intelligence
  FOR UPDATE USING (public.can_edit_site(site_id));

CREATE TRIGGER set_youtube_intelligence_updated_at
  BEFORE UPDATE ON youtube_intelligence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 7. youtube_intelligence_tasks — Pipeline task coordination
-- =============================================================================
CREATE TABLE youtube_intelligence_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'stale')),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'cron')),
  requested_by UUID,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  result_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_yt_intel_task_active
  ON youtube_intelligence_tasks (site_id, channel_id)
  WHERE status IN ('pending', 'running');
CREATE INDEX idx_yt_intel_task_pending
  ON youtube_intelligence_tasks (status, requested_at)
  WHERE status = 'pending';

ALTER TABLE youtube_intelligence_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "yt_intel_tasks_select" ON youtube_intelligence_tasks;
CREATE POLICY "yt_intel_tasks_select" ON youtube_intelligence_tasks
  FOR SELECT USING (public.can_view_site(site_id));
DROP POLICY IF EXISTS "yt_intel_tasks_insert" ON youtube_intelligence_tasks;
CREATE POLICY "yt_intel_tasks_insert" ON youtube_intelligence_tasks
  FOR INSERT WITH CHECK (public.can_edit_site(site_id));
DROP POLICY IF EXISTS "yt_intel_tasks_update" ON youtube_intelligence_tasks;
CREATE POLICY "yt_intel_tasks_update" ON youtube_intelligence_tasks
  FOR UPDATE USING (public.can_edit_site(site_id));

CREATE TRIGGER set_yt_intel_tasks_updated_at
  BEFORE UPDATE ON youtube_intelligence_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 8. Helper functions
-- =============================================================================
CREATE OR REPLACE FUNCTION create_yt_notification(
  p_site_id UUID,
  p_type TEXT,
  p_priority INTEGER,
  p_title TEXT,
  p_message TEXT,
  p_dedup_key TEXT,
  p_video_id UUID DEFAULT NULL,
  p_ab_test_id UUID DEFAULT NULL,
  p_cycle_id UUID DEFAULT NULL,
  p_suggested_action TEXT DEFAULT NULL,
  p_action_href TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO yt_notifications (
    site_id, youtube_video_id, ab_test_id, optimization_cycle_id,
    type, priority, title, message, dedup_key,
    suggested_action, action_href
  ) VALUES (
    p_site_id, p_video_id, p_ab_test_id, p_cycle_id,
    p_type, p_priority, p_title, p_message, p_dedup_key,
    p_suggested_action, p_action_href
  )
  ON CONFLICT (site_id, dedup_key) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION expire_old_yt_notifications()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE yt_notifications
  SET expired_at = now()
  WHERE expired_at IS NULL
    AND created_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
