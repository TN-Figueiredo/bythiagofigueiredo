# YouTube Analytics Intelligence Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the YouTube analytics module from passive display into an active intelligence engine with 6-axis scoring, continuous optimization loops, AI-powered coaching, and CMS notification system.

**Architecture:** 3 layers — Data Engine (crons populate daily/weekly metrics, compute 6-axis scores with sigmoid normalization) → Cowork AI Pipeline (Claude reads via GET, writes enrichment via PATCH) → CMS Display (grades, health coach, notifications, A/B integration). The optimization loop state machine drives videos through flagging → diagnosis → testing → monitoring → resolution.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, Supabase (PostgreSQL 17), YouTube Analytics API v2, Zod, Vitest, Recharts (retention curves)

---

## File Structure

### New Files

| Path | Responsibility |
|------|---------------|
| `supabase/migrations/20260517100001_analytics_intelligence.sql` | All new tables + youtube_videos columns + helper functions |
| `src/lib/youtube/scoring.ts` | 6-axis scoring algorithm (sigmoid, weights, evergreen bonus) |
| `src/lib/youtube/scoring-types.ts` | Types for scoring system |
| `src/lib/youtube/optimization-loop.ts` | State machine transitions for optimization cycles |
| `src/lib/youtube/notification-service.ts` | Create/deduplicate/aggregate notifications |
| `src/lib/youtube/analytics-sync.ts` | Daily metrics sync logic (extracted from cron) |
| `src/app/api/cron/sync-analytics-metrics/route.ts` | Daily cron: fetch CTR/impressions/retention/daily views |
| `src/app/api/cron/weekly-grade-snapshot/route.ts` | Monday cron: compute scores, detect streaks, flag |
| `src/app/api/cron/youtube-intelligence-dispatch/route.ts` | Monday cron: create Cowork pipeline task |
| `src/app/api/cron/optimization-monitor/route.ts` | Daily cron: day 7/14/30 post-test checks |
| `src/app/api/cron/expire-notifications/route.ts` | Daily cron: 30-day notification expiry |
| `src/app/api/pipeline/youtube/intelligence/route.ts` | GET + PATCH intelligence endpoints |
| `src/app/api/pipeline/youtube/intelligence/task/route.ts` | GET pending task endpoint |
| `src/app/cms/(authed)/youtube/analytics/_components/yt-grades-v2.tsx` | Redesigned grades panel with 6-axis bars + expand |
| `src/app/cms/(authed)/youtube/analytics/_components/yt-video-diagnostic.tsx` | Expanded diagnostic panel per video |
| `src/app/cms/(authed)/youtube/analytics/_components/yt-health-coach.tsx` | Health Coach tab: radar + coaching cards |
| `src/app/cms/(authed)/youtube/analytics/_components/yt-notifications-bell.tsx` | Bell icon + dropdown panel |
| `src/app/cms/(authed)/youtube/analytics/_components/yt-notifications-panel.tsx` | Full notifications list/settings |
| `src/app/cms/(authed)/youtube/analytics/_components/yt-bootstrap-banner.tsx` | Day 0-14 bootstrap experience |
| `src/app/cms/(authed)/youtube/analytics/_components/yt-retention-curve-v2.tsx` | Real retention curve from API data |
| `src/app/cms/(authed)/youtube/analytics/_components/yt-before-after.tsx` | Before/After comparison card |
| `src/app/cms/(authed)/youtube/analytics/_components/yt-score-bar.tsx` | Reusable mini score bar (0-100) |
| `src/app/cms/(authed)/youtube/analytics/_components/yt-outliers-v2.tsx` | MAD-based outlier detection + scatter |
| `src/app/cms/(authed)/youtube/analytics/actions.ts` | Server actions for analytics intelligence |
| `test/analytics-scoring.test.ts` | Tests for 6-axis scoring |
| `test/analytics-optimization-loop.test.ts` | Tests for state machine |
| `test/analytics-notification-service.test.ts` | Tests for notification logic |
| `test/analytics-sync.test.ts` | Tests for sync logic |
| `test/analytics-intelligence-api.test.ts` | Tests for pipeline GET/PATCH |

### Modified Files

| Path | Changes |
|------|---------|
| `src/lib/youtube/analytics-client.ts` | Fix error handling, add retry, structured errors |
| `src/lib/youtube/analytics-types.ts` | Add new types for 6-axis scores, notifications |
| `src/lib/youtube/analytics-queries.ts` | New query functions for grade history, notifications |
| `src/app/cms/(authed)/youtube/analytics/_components/yt-analytics-tabs.tsx` | Add Health Coach + Notifications tabs |
| `src/app/cms/(authed)/youtube/analytics/page.tsx` | Wire new data fetching |
| `src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx` | Accept pre-fill props from grades |
| `src/app/api/cron/ab-evaluate/route.ts` | Emit notification + trigger optimization state |

---

## Phase 1 — Database Foundation

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260517100001_analytics_intelligence.sql`

- [ ] **Step 1: Generate migration file**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run db:new analytics_intelligence`

This generates the timestamped migration file. Note the actual filename produced.

- [ ] **Step 2: Write migration SQL**

Write the following SQL to the generated migration file:

```sql
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
```

- [ ] **Step 3: Push migration to production**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run db:push:prod`

Expected: Migration applied successfully. Confirm with "YES" when prompted.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(analytics): add intelligence engine database schema

6 new tables: youtube_video_analytics, video_grade_history,
optimization_cycles, yt_notifications, youtube_intelligence,
youtube_intelligence_tasks. Add 9 columns to youtube_videos.
Helper functions for notification creation and expiry."
```

---

## Phase 2 — Scoring Engine + Core Logic

### Task 2: Scoring Types

**Files:**
- Create: `apps/web/src/lib/youtube/scoring-types.ts`

- [ ] **Step 1: Create the types file**

```typescript
export type Axis = 'ctr' | 'retention' | 'reach' | 'engagement' | 'growth' | 'sub_impact'
export type Grade = 'A' | 'B' | 'C' | 'D'
export type VideoLifecycle = 'fresh' | 'maturing' | 'established' | 'evergreen'
export type TrendDirection = 'up' | 'down' | 'flat'
export type ChannelTier = 'small' | 'medium' | 'large'

export interface AxisWeights {
  ctr: number
  retention: number
  reach: number
  engagement: number
  growth: number
  sub_impact: number
}

export interface AxisScore {
  axis: Axis
  raw: number
  normalized: number
  weight: number
  weighted: number
}

export interface VideoScore {
  videoId: string
  overall: number
  grade: Grade
  axes: AxisScore[]
  evergreenBonus: number
  lifecycle: VideoLifecycle
  ageDays: number
}

export interface VideoScoreInput {
  videoId: string
  publishedAt: string
  ctr: number
  avgViewPercentage: number
  impressions: number
  trafficSources: TrafficSources | null
  engagementRate: number
  dailyViews: DailyViewPoint[]
  subscribersGained: number
  viewCount: number
}

export interface TrafficSources {
  browse: number
  search: number
  suggested: number
  external: number
  direct: number
  notifications: number
  playlists: number
}

export interface DailyViewPoint {
  date: string
  views: number
}

export interface ChannelBaseline {
  medianCtr: number
  medianRetention: number
  medianReach: number
  medianEngagement: number
  medianGrowth: number
  medianSubImpact: number
  channelDailyMean: number
  subscriberCount: number
}

export interface TrendData {
  direction: TrendDirection
  velocity: number
  streak: number
  label: string | null
}

export interface OutlierResult {
  videoId: string
  axis: Axis
  modifiedZ: number
  direction: 'positive' | 'negative'
}

export const AXIS_LABELS: Record<Axis, string> = {
  ctr: 'CTR',
  retention: 'Retenção',
  reach: 'Alcance',
  engagement: 'Engajamento',
  growth: 'Crescimento',
  sub_impact: 'Impacto em Subs',
}

export const GRADE_THRESHOLDS = { A: 85, B: 65, C: 40 } as const
export const SIGMOID_K: Record<Axis, number> = {
  ctr: 1.8,
  retention: 2.0,
  reach: 1.2,
  engagement: 1.5,
  growth: 2.5,
  sub_impact: 2.2,
}
export const LOG_TRANSFORM_AXES: Axis[] = ['reach', 'growth']
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/youtube/scoring-types.ts
git commit -m "feat(analytics): add scoring type definitions"
```

---

### Task 3: 6-Axis Scoring Algorithm

**Files:**
- Create: `apps/web/src/lib/youtube/scoring.ts`
- Create: `apps/web/test/analytics-scoring.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest'
import {
  sigmoid,
  prepareAxisInput,
  computeGrowthVelocity,
  computeEvergreenBonus,
  getAxisWeights,
  scoreVideo,
  assignGrade,
  computeOutliers,
  computeTrend,
} from '@/lib/youtube/scoring'
import type { VideoScoreInput, ChannelBaseline, DailyViewPoint } from '@/lib/youtube/scoring-types'

describe('sigmoid', () => {
  it('returns 50 at midpoint', () => {
    expect(sigmoid(5, 1.8, 5)).toBeCloseTo(50, 0)
  })

  it('returns >50 above midpoint', () => {
    expect(sigmoid(7, 1.8, 5)).toBeGreaterThan(50)
  })

  it('returns <50 below midpoint', () => {
    expect(sigmoid(3, 1.8, 5)).toBeLessThan(50)
  })

  it('clamps output to [1, 99]', () => {
    expect(sigmoid(100, 2.0, 5)).toBeLessThanOrEqual(99)
    expect(sigmoid(-100, 2.0, 5)).toBeGreaterThanOrEqual(1)
  })
})

describe('prepareAxisInput', () => {
  it('applies log2 transform for reach', () => {
    expect(prepareAxisInput('reach', 1000)).toBeCloseTo(Math.log2(1001), 4)
  })

  it('applies log2 transform for growth', () => {
    expect(prepareAxisInput('growth', 100)).toBeCloseTo(Math.log2(101), 4)
  })

  it('returns raw value for ctr', () => {
    expect(prepareAxisInput('ctr', 5.5)).toBe(5.5)
  })
})

describe('computeGrowthVelocity', () => {
  it('returns 0 for fewer than 7 days', () => {
    const points: DailyViewPoint[] = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      views: 100,
    }))
    expect(computeGrowthVelocity(points, 1.5)).toBe(0)
  })

  it('returns positive for increasing views', () => {
    const points: DailyViewPoint[] = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      views: 100 + i * 20,
    }))
    expect(computeGrowthVelocity(points, 1.5)).toBeGreaterThan(0)
  })

  it('returns negative for decreasing views', () => {
    const points: DailyViewPoint[] = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      views: 500 - i * 30,
    }))
    expect(computeGrowthVelocity(points, 1.5)).toBeLessThan(0)
  })
})

describe('computeEvergreenBonus', () => {
  it('returns 0 for video younger than 90 days', () => {
    expect(computeEvergreenBonus(60, [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], 50)).toBe(0)
  })

  it('returns 0 if below channel mean', () => {
    expect(computeEvergreenBonus(120, [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20], 50)).toBe(0)
  })

  it('returns bonus 3-8 for qualifying evergreen', () => {
    const views = Array.from({ length: 14 }, () => 100)
    const bonus = computeEvergreenBonus(120, views, 50)
    expect(bonus).toBeGreaterThanOrEqual(3)
    expect(bonus).toBeLessThanOrEqual(8)
  })

  it('returns 0 if high variance (CV > 0.8)', () => {
    const views = [10, 200, 5, 300, 8, 250, 3, 180, 15, 220, 7, 190, 4, 210]
    expect(computeEvergreenBonus(120, views, 50)).toBe(0)
  })
})

describe('getAxisWeights', () => {
  it('returns standard weights for 30-day video', () => {
    const w = getAxisWeights(30)
    expect(w.growth).toBe(0.12)
    expect(w.ctr + w.retention + w.reach + w.engagement + w.growth + w.sub_impact).toBeCloseTo(1.0)
  })

  it('reduces growth weight for fresh video (<=14 days)', () => {
    const w = getAxisWeights(7)
    expect(w.growth).toBe(0.04)
    expect(w.ctr).toBe(0.29)
    expect(w.ctr + w.retention + w.reach + w.engagement + w.growth + w.sub_impact).toBeCloseTo(1.0)
  })
})

describe('assignGrade', () => {
  it('assigns A for score >= 85', () => expect(assignGrade(90)).toBe('A'))
  it('assigns B for score >= 65', () => expect(assignGrade(72)).toBe('B'))
  it('assigns C for score >= 40', () => expect(assignGrade(50)).toBe('C'))
  it('assigns D for score < 40', () => expect(assignGrade(30)).toBe('D'))
})

describe('scoreVideo', () => {
  const baseline: ChannelBaseline = {
    medianCtr: 5.0,
    medianRetention: 45,
    medianReach: 5000,
    medianEngagement: 4.0,
    medianGrowth: 0,
    medianSubImpact: 0.5,
    channelDailyMean: 100,
    subscriberCount: 5000,
  }

  it('scores a high-performing video as A or B', () => {
    const input: VideoScoreInput = {
      videoId: 'test-1',
      publishedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      ctr: 8.0,
      avgViewPercentage: 55,
      impressions: 10000,
      trafficSources: { browse: 40, search: 25, suggested: 20, external: 10, direct: 3, notifications: 1, playlists: 1 },
      engagementRate: 6.5,
      dailyViews: Array.from({ length: 28 }, (_, i) => ({ date: `2026-05-${String(i + 1).padStart(2, '0')}`, views: 200 + i * 10 })),
      subscribersGained: 50,
      viewCount: 5000,
    }
    const result = scoreVideo(input, baseline)
    expect(result.grade).toMatch(/^[AB]$/)
    expect(result.overall).toBeGreaterThan(60)
    expect(result.axes).toHaveLength(6)
  })

  it('scores a low-performing video as C or D', () => {
    const input: VideoScoreInput = {
      videoId: 'test-2',
      publishedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      ctr: 2.0,
      avgViewPercentage: 25,
      impressions: 8000,
      trafficSources: { browse: 85, search: 5, suggested: 5, external: 3, direct: 1, notifications: 1, playlists: 0 },
      engagementRate: 1.5,
      dailyViews: Array.from({ length: 28 }, (_, i) => ({ date: `2026-05-${String(i + 1).padStart(2, '0')}`, views: 200 - i * 5 })),
      subscribersGained: 2,
      viewCount: 3000,
    }
    const result = scoreVideo(input, baseline)
    expect(result.grade).toMatch(/^[CD]$/)
    expect(result.overall).toBeLessThan(65)
  })
})

describe('computeOutliers', () => {
  it('detects positive outlier when modified z > 2.5', () => {
    const scores = [50, 52, 48, 51, 49, 50, 53, 47, 50, 95]
    const outliers = computeOutliers(
      scores.map((s, i) => ({ videoId: `v${i}`, score: s })),
      'ctr',
    )
    expect(outliers.some(o => o.videoId === 'v9' && o.direction === 'positive')).toBe(true)
  })

  it('detects negative outlier', () => {
    const scores = [50, 52, 48, 51, 49, 50, 53, 47, 50, 5]
    const outliers = computeOutliers(
      scores.map((s, i) => ({ videoId: `v${i}`, score: s })),
      'ctr',
    )
    expect(outliers.some(o => o.videoId === 'v9' && o.direction === 'negative')).toBe(true)
  })

  it('returns empty for uniform distribution', () => {
    const scores = Array.from({ length: 10 }, (_, i) => ({ videoId: `v${i}`, score: 50 + i }))
    const outliers = computeOutliers(scores, 'ctr')
    expect(outliers).toHaveLength(0)
  })
})

describe('computeTrend', () => {
  it('detects upward trend', () => {
    const weeklyScores = [40, 45, 52, 60]
    const trend = computeTrend(weeklyScores)
    expect(trend.direction).toBe('up')
    expect(trend.velocity).toBeGreaterThan(0)
  })

  it('detects downward trend', () => {
    const weeklyScores = [80, 72, 65, 55]
    const trend = computeTrend(weeklyScores)
    expect(trend.direction).toBe('down')
    expect(trend.velocity).toBeLessThan(0)
  })

  it('returns flat for stable scores', () => {
    const weeklyScores = [50, 50.5, 49.8, 50.2]
    const trend = computeTrend(weeklyScores)
    expect(trend.direction).toBe('flat')
  })

  it('handles fewer than 4 weeks gracefully', () => {
    const trend = computeTrend([50, 52])
    expect(trend.direction).toBe('flat')
    expect(trend.streak).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/analytics-scoring.test.ts`

Expected: FAIL — module `@/lib/youtube/scoring` does not exist.

- [ ] **Step 3: Implement the scoring module**

```typescript
import type {
  Axis,
  AxisScore,
  AxisWeights,
  ChannelBaseline,
  DailyViewPoint,
  Grade,
  OutlierResult,
  TrendData,
  TrendDirection,
  VideoLifecycle,
  VideoScore,
  VideoScoreInput,
} from './scoring-types'
import { GRADE_THRESHOLDS, LOG_TRANSFORM_AXES, SIGMOID_K } from './scoring-types'

export function sigmoid(x: number, k: number, midpoint: number): number {
  const raw = 100 / (1 + Math.exp(-k * (x - midpoint)))
  return Math.max(1, Math.min(99, raw))
}

export function prepareAxisInput(axis: Axis, rawValue: number): number {
  if (LOG_TRANSFORM_AXES.includes(axis)) {
    return Math.log2(rawValue + 1)
  }
  return rawValue
}

export function computeGrowthVelocity(dailyViews: DailyViewPoint[], recencyExponent: number): number {
  if (dailyViews.length < 7) return 0
  const n = dailyViews.length
  let sumW = 0, sumWX = 0, sumWY = 0, sumWXX = 0, sumWXY = 0

  for (let i = 0; i < n; i++) {
    const w = Math.pow(i + 1, recencyExponent)
    sumW += w
    sumWX += w * i
    sumWY += w * dailyViews[i]!.views
    sumWXX += w * i * i
    sumWXY += w * i * dailyViews[i]!.views
  }

  const denominator = sumW * sumWXX - sumWX * sumWX
  if (denominator === 0) return 0
  const slope = (sumW * sumWXY - sumWX * sumWY) / denominator
  const meanViews = sumWY / sumW
  if (meanViews < 1) return 0
  return (slope / meanViews) * 100
}

export function computeEvergreenBonus(ageDays: number, dailyViews: number[], channelDailyMean: number): number {
  if (ageDays < 90 || dailyViews.length < 14) return 0
  const videoMean = dailyViews.reduce((a, b) => a + b, 0) / dailyViews.length
  if (videoMean < channelDailyMean) return 0
  const stdDev = Math.sqrt(dailyViews.reduce((sum, v) => sum + Math.pow(v - videoMean, 2), 0) / dailyViews.length)
  if (videoMean === 0 || stdDev / videoMean > 0.8) return 0
  return Math.min(8, Math.max(3, Math.round((videoMean / channelDailyMean) * 2.5)))
}

export function getAxisWeights(videoAgeDays: number): AxisWeights {
  if (videoAgeDays <= 14) {
    return { ctr: 0.29, retention: 0.29, reach: 0.15, engagement: 0.15, growth: 0.04, sub_impact: 0.08 }
  }
  return { ctr: 0.25, retention: 0.25, reach: 0.15, engagement: 0.15, growth: 0.12, sub_impact: 0.08 }
}

export function assignGrade(score: number): Grade {
  if (score >= GRADE_THRESHOLDS.A) return 'A'
  if (score >= GRADE_THRESHOLDS.B) return 'B'
  if (score >= GRADE_THRESHOLDS.C) return 'C'
  return 'D'
}

function getLifecycle(ageDays: number): VideoLifecycle {
  if (ageDays <= 14) return 'fresh'
  if (ageDays <= 90) return 'maturing'
  if (ageDays <= 365) return 'established'
  return 'evergreen'
}

function getRecencyExponent(ageDays: number): number {
  if (ageDays <= 14) return 2.0
  if (ageDays <= 90) return 1.5
  return 1.0
}

function computeReachDiversity(sources: VideoScoreInput['trafficSources']): number {
  if (!sources) return 0
  const values = [sources.browse, sources.search, sources.suggested, sources.external, sources.direct, sources.notifications, sources.playlists]
  const total = values.reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  const probs = values.map(v => v / total).filter(p => p > 0)
  const entropy = -probs.reduce((sum, p) => sum + p * Math.log2(p), 0)
  const maxEntropy = Math.log2(probs.length)
  return maxEntropy > 0 ? (entropy / maxEntropy) * 100 : 0
}

export function scoreVideo(input: VideoScoreInput, baseline: ChannelBaseline): VideoScore {
  const ageDays = Math.floor((Date.now() - new Date(input.publishedAt).getTime()) / 86400000)
  const lifecycle = getLifecycle(ageDays)
  const weights = getAxisWeights(ageDays)
  const recencyExp = getRecencyExponent(ageDays)

  const velocity = computeGrowthVelocity(input.dailyViews, recencyExp)
  const reachDiversity = computeReachDiversity(input.trafficSources)
  const subImpactRaw = input.impressions > 0 ? (input.subscribersGained / input.impressions) * 1000 : 0

  const axisInputs: Record<Axis, { raw: number; midpoint: number }> = {
    ctr: { raw: input.ctr, midpoint: baseline.medianCtr },
    retention: { raw: input.avgViewPercentage, midpoint: baseline.medianRetention },
    reach: { raw: reachDiversity, midpoint: prepareAxisInput('reach', baseline.medianReach) },
    engagement: { raw: input.engagementRate, midpoint: baseline.medianEngagement },
    growth: { raw: velocity, midpoint: prepareAxisInput('growth', baseline.medianGrowth) },
    sub_impact: { raw: subImpactRaw, midpoint: baseline.medianSubImpact },
  }

  const axes: AxisScore[] = (Object.keys(weights) as Axis[]).map(axis => {
    const { raw, midpoint } = axisInputs[axis]!
    const prepared = prepareAxisInput(axis, raw)
    const preparedMidpoint = LOG_TRANSFORM_AXES.includes(axis) ? midpoint : midpoint
    const normalized = sigmoid(prepared, SIGMOID_K[axis]!, preparedMidpoint)
    const weight = weights[axis]!
    return { axis, raw, normalized, weight, weighted: normalized * weight }
  })

  const dailyViewValues = input.dailyViews.map(d => d.views)
  const evergreenBonus = computeEvergreenBonus(ageDays, dailyViewValues, baseline.channelDailyMean)

  const overall = Math.min(100, axes.reduce((sum, a) => sum + a.weighted, 0) + evergreenBonus)
  const grade = assignGrade(overall)

  return { videoId: input.videoId, overall, grade, axes, evergreenBonus, lifecycle, ageDays }
}

export function computeOutliers(
  videoScores: { videoId: string; score: number }[],
  axis: Axis,
): OutlierResult[] {
  if (videoScores.length < 5) return []

  const scores = videoScores.map(v => v.score)
  const sorted = [...scores].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]!
  const deviations = scores.map(s => Math.abs(s - median))
  const sortedDev = [...deviations].sort((a, b) => a - b)
  const mad = sortedDev[Math.floor(sortedDev.length / 2)]!

  if (mad === 0) return []

  return videoScores
    .map(v => {
      const modifiedZ = (0.6745 * (v.score - median)) / mad
      if (Math.abs(modifiedZ) <= 2.5) return null
      return {
        videoId: v.videoId,
        axis,
        modifiedZ,
        direction: modifiedZ > 0 ? 'positive' as const : 'negative' as const,
      }
    })
    .filter((r): r is OutlierResult => r !== null)
}

export function computeTrend(weeklyScores: number[]): TrendData {
  if (weeklyScores.length < 3) {
    return { direction: 'flat', velocity: 0, streak: 0, label: null }
  }

  const weights = [0.4, 0.3, 0.2, 0.1]
  const deltas: number[] = []
  for (let i = 1; i < weeklyScores.length; i++) {
    deltas.push(weeklyScores[i]! - weeklyScores[i - 1]!)
  }

  let weightedDelta = 0
  let weightSum = 0
  for (let i = deltas.length - 1; i >= 0 && deltas.length - 1 - i < weights.length; i--) {
    const w = weights[deltas.length - 1 - i]!
    weightedDelta += deltas[i]! * w
    weightSum += w
  }
  const velocity = weightSum > 0 ? weightedDelta / weightSum : 0

  let direction: TrendDirection = 'flat'
  if (velocity > 1.5) direction = 'up'
  else if (velocity < -1.5) direction = 'down'

  let streak = 0
  if (direction !== 'flat') {
    for (let i = deltas.length - 1; i >= 0; i--) {
      if ((direction === 'up' && deltas[i]! > 0) || (direction === 'down' && deltas[i]! < 0)) {
        streak++
      } else break
    }
  }

  let label: string | null = null
  if (Math.abs(velocity) > 5) {
    label = velocity > 0 ? 'Acelerando rápido' : 'Queda acentuada'
  } else if (streak >= 3) {
    label = velocity > 0 ? 'Tendência de alta' : 'Tendência de queda'
  }

  return { direction, velocity, streak, label }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/analytics-scoring.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/scoring.ts apps/web/test/analytics-scoring.test.ts
git commit -m "feat(analytics): implement 6-axis scoring algorithm with sigmoid normalization"
```

---

### Task 4: Optimization Loop State Machine

**Files:**
- Create: `apps/web/src/lib/youtube/optimization-loop.ts`
- Create: `apps/web/test/analytics-optimization-loop.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest'
import {
  transitionState,
  canTransition,
  OPTIMIZATION_CONFIG,
  isInCooldown,
  getMaxCycles,
} from '@/lib/youtube/optimization-loop'
import type { OptimizationCycle, TransitionTrigger } from '@/lib/youtube/optimization-loop'

function makeCycle(overrides: Partial<OptimizationCycle> = {}): OptimizationCycle {
  return {
    id: 'cycle-1',
    youtube_video_id: 'vid-1',
    site_id: 'site-1',
    state: 'flagged',
    cycle_number: 1,
    flagged_at: new Date().toISOString(),
    diagnosed_at: null,
    diagnosis_summary: null,
    test_suggested_at: null,
    test_suggestion: null,
    ab_test_id: null,
    testing_started_at: null,
    test_completed_at: null,
    test_winner_applied_at: null,
    monitoring_day7_at: null,
    monitoring_day7_result: null,
    monitoring_day14_at: null,
    monitoring_day14_result: null,
    monitoring_day30_at: null,
    monitoring_day30_result: null,
    resolved_at: null,
    resolved_reason: null,
    cooldown_until: null,
    ...overrides,
  }
}

describe('canTransition', () => {
  it('allows flagged → diagnosed', () => {
    expect(canTransition('flagged', 'diagnosed')).toBe(true)
  })

  it('allows flagged → unmonitored', () => {
    expect(canTransition('flagged', 'unmonitored')).toBe(true)
  })

  it('disallows flagged → testing', () => {
    expect(canTransition('flagged', 'testing')).toBe(false)
  })

  it('allows testing → post_test_monitoring', () => {
    expect(canTransition('testing', 'post_test_monitoring')).toBe(true)
  })

  it('allows post_test_monitoring → resolved', () => {
    expect(canTransition('post_test_monitoring', 'resolved')).toBe(true)
  })

  it('allows post_test_monitoring → retest_needed', () => {
    expect(canTransition('post_test_monitoring', 'retest_needed')).toBe(true)
  })

  it('disallows resolved → anything', () => {
    expect(canTransition('resolved', 'flagged')).toBe(false)
  })

  it('disallows exhausted → anything', () => {
    expect(canTransition('exhausted', 'flagged')).toBe(false)
  })
})

describe('transitionState', () => {
  it('transitions flagged → diagnosed with summary', () => {
    const cycle = makeCycle({ state: 'flagged' })
    const result = transitionState(cycle, 'diagnosed', { diagnosis_summary: 'CTR below average' })
    expect(result.state).toBe('diagnosed')
    expect(result.diagnosed_at).toBeTruthy()
    expect(result.diagnosis_summary).toBe('CTR below average')
  })

  it('transitions test_suggested → testing with ab_test_id', () => {
    const cycle = makeCycle({ state: 'test_suggested' })
    const result = transitionState(cycle, 'testing', { ab_test_id: 'test-123' })
    expect(result.state).toBe('testing')
    expect(result.ab_test_id).toBe('test-123')
    expect(result.testing_started_at).toBeTruthy()
  })

  it('transitions post_test_monitoring → resolved', () => {
    const cycle = makeCycle({ state: 'post_test_monitoring', test_winner_applied_at: new Date().toISOString() })
    const result = transitionState(cycle, 'resolved', { resolved_reason: 'grade_improved' })
    expect(result.state).toBe('resolved')
    expect(result.resolved_at).toBeTruthy()
    expect(result.resolved_reason).toBe('grade_improved')
  })

  it('transitions retest_needed → exhausted at max cycles', () => {
    const cycle = makeCycle({ state: 'retest_needed', cycle_number: 5 })
    const result = transitionState(cycle, 'exhausted', {})
    expect(result.state).toBe('exhausted')
  })

  it('throws for invalid transition', () => {
    const cycle = makeCycle({ state: 'resolved' })
    expect(() => transitionState(cycle, 'flagged', {})).toThrow()
  })
})

describe('isInCooldown', () => {
  it('returns true if within cooldown period', () => {
    const applied = new Date()
    applied.setDate(applied.getDate() - 30)
    expect(isInCooldown(applied.toISOString())).toBe(true)
  })

  it('returns false if past cooldown period', () => {
    const applied = new Date()
    applied.setDate(applied.getDate() - 61)
    expect(isInCooldown(applied.toISOString())).toBe(false)
  })

  it('returns false for null', () => {
    expect(isInCooldown(null)).toBe(false)
  })
})

describe('getMaxCycles', () => {
  it('returns configured max', () => {
    expect(getMaxCycles()).toBe(OPTIMIZATION_CONFIG.max_cycles_per_video)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/analytics-optimization-loop.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement optimization loop**

```typescript
export const OPTIMIZATION_CONFIG = {
  min_consecutive_low_weeks: 2,
  cooldown_days: 60,
  max_cycles_per_video: 5,
  monitoring_check_days: [7, 14, 30] as const,
  ctr_drop_rollback_threshold_percent: -10,
  grade_improvement_target: 'B' as const,
}

export type OptimizationState =
  | 'unmonitored' | 'flagged' | 'diagnosed' | 'test_suggested'
  | 'testing' | 'post_test_monitoring' | 'resolved' | 'retest_needed' | 'exhausted'

export interface OptimizationCycle {
  id: string
  youtube_video_id: string
  site_id: string
  state: OptimizationState
  cycle_number: number
  flagged_at: string | null
  diagnosed_at: string | null
  diagnosis_summary: string | null
  test_suggested_at: string | null
  test_suggestion: unknown | null
  ab_test_id: string | null
  testing_started_at: string | null
  test_completed_at: string | null
  test_winner_applied_at: string | null
  monitoring_day7_at: string | null
  monitoring_day7_result: unknown | null
  monitoring_day14_at: string | null
  monitoring_day14_result: unknown | null
  monitoring_day30_at: string | null
  monitoring_day30_result: unknown | null
  resolved_at: string | null
  resolved_reason: string | null
  cooldown_until: string | null
}

export interface TransitionTrigger {
  diagnosis_summary?: string
  test_suggestion?: unknown
  ab_test_id?: string
  resolved_reason?: string
  monitoring_result?: unknown
}

const VALID_TRANSITIONS: Record<OptimizationState, OptimizationState[]> = {
  unmonitored: ['flagged'],
  flagged: ['diagnosed', 'unmonitored'],
  diagnosed: ['test_suggested', 'unmonitored'],
  test_suggested: ['testing', 'diagnosed'],
  testing: ['post_test_monitoring', 'retest_needed'],
  post_test_monitoring: ['resolved', 'retest_needed'],
  retest_needed: ['flagged', 'exhausted'],
  resolved: [],
  exhausted: [],
}

export function canTransition(from: OptimizationState, to: OptimizationState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function transitionState(
  cycle: OptimizationCycle,
  to: OptimizationState,
  trigger: TransitionTrigger,
): OptimizationCycle {
  if (!canTransition(cycle.state, to)) {
    throw new Error(`Invalid transition: ${cycle.state} → ${to}`)
  }

  const now = new Date().toISOString()
  const updated = { ...cycle, state: to }

  switch (to) {
    case 'flagged':
      updated.flagged_at = now
      break
    case 'diagnosed':
      updated.diagnosed_at = now
      updated.diagnosis_summary = trigger.diagnosis_summary ?? null
      break
    case 'test_suggested':
      updated.test_suggested_at = now
      updated.test_suggestion = trigger.test_suggestion ?? null
      break
    case 'testing':
      updated.testing_started_at = now
      updated.ab_test_id = trigger.ab_test_id ?? null
      break
    case 'post_test_monitoring':
      updated.test_completed_at = now
      break
    case 'resolved':
      updated.resolved_at = now
      updated.resolved_reason = trigger.resolved_reason ?? null
      break
    case 'retest_needed':
      updated.cooldown_until = new Date(Date.now() + OPTIMIZATION_CONFIG.cooldown_days * 86400000).toISOString()
      break
    case 'exhausted':
      updated.resolved_at = now
      updated.resolved_reason = 'max_cycles_reached'
      break
    case 'unmonitored':
      break
  }

  return updated
}

export function isInCooldown(testWinnerAppliedAt: string | null): boolean {
  if (!testWinnerAppliedAt) return false
  const appliedDate = new Date(testWinnerAppliedAt)
  const cooldownEnd = new Date(appliedDate.getTime() + OPTIMIZATION_CONFIG.cooldown_days * 86400000)
  return new Date() < cooldownEnd
}

export function getMaxCycles(): number {
  return OPTIMIZATION_CONFIG.max_cycles_per_video
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/analytics-optimization-loop.test.ts`

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/optimization-loop.ts apps/web/test/analytics-optimization-loop.test.ts
git commit -m "feat(analytics): implement optimization loop state machine with 9 states"
```

---

### Task 5: Notification Service

**Files:**
- Create: `apps/web/src/lib/youtube/notification-service.ts`
- Create: `apps/web/test/analytics-notification-service.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildNotification,
  buildDedupKey,
  shouldAggregate,
  buildGroupNotification,
  NotificationType,
  NOTIFICATION_PRIORITIES,
} from '@/lib/youtube/notification-service'

describe('NOTIFICATION_PRIORITIES', () => {
  it('has correct priorities for all types', () => {
    expect(NOTIFICATION_PRIORITIES.grade_drop).toBe(5)
    expect(NOTIFICATION_PRIORITIES.ctr_drop).toBe(4)
    expect(NOTIFICATION_PRIORITIES.monitoring_alert).toBe(4)
    expect(NOTIFICATION_PRIORITIES.ab_test_completed).toBe(3)
    expect(NOTIFICATION_PRIORITIES.retest_suggested).toBe(3)
    expect(NOTIFICATION_PRIORITIES.optimization_available).toBe(2)
    expect(NOTIFICATION_PRIORITIES.trending_viral).toBe(2)
    expect(NOTIFICATION_PRIORITIES.optimization_resolved).toBe(2)
  })
})

describe('buildDedupKey', () => {
  it('builds video-specific key with week', () => {
    const key = buildDedupKey('ctr_drop', 'vid-123', '2026-W20')
    expect(key).toBe('ctr_drop:vid-123:2026-W20')
  })

  it('builds group key', () => {
    const key = buildDedupKey('grade_drop', null, '2026-W20')
    expect(key).toBe('grade_drop:group:2026-W20')
  })
})

describe('buildNotification', () => {
  it('builds a grade_drop notification', () => {
    const n = buildNotification({
      type: 'grade_drop',
      videoId: 'vid-1',
      videoTitle: 'Como ganhar dinheiro',
      oldGrade: 'A',
      newGrade: 'D',
      weekIso: '2026-W20',
    })
    expect(n.type).toBe('grade_drop')
    expect(n.priority).toBe(5)
    expect(n.title).toContain('Queda')
    expect(n.dedup_key).toContain('grade_drop:vid-1:2026-W20')
  })

  it('builds a trending_viral notification', () => {
    const n = buildNotification({
      type: 'trending_viral',
      videoId: 'vid-2',
      videoTitle: 'Video viral',
      views48h: 50000,
      channelAvg48h: 5000,
      weekIso: '2026-W20',
    })
    expect(n.type).toBe('trending_viral')
    expect(n.priority).toBe(2)
    expect(n.title).toContain('viral')
  })

  it('builds an ab_test_completed notification', () => {
    const n = buildNotification({
      type: 'ab_test_completed',
      videoId: 'vid-3',
      videoTitle: 'Test video',
      testName: 'Thumb Test 1',
      winnerLabel: 'Variante B',
      ctrLift: 18.5,
      weekIso: '2026-W20',
    })
    expect(n.type).toBe('ab_test_completed')
    expect(n.priority).toBe(3)
    expect(n.message).toContain('+18.5%')
  })
})

describe('shouldAggregate', () => {
  it('returns true for 3+ same-type notifications', () => {
    expect(shouldAggregate(3)).toBe(true)
  })

  it('returns false for 1-2 notifications', () => {
    expect(shouldAggregate(2)).toBe(false)
    expect(shouldAggregate(1)).toBe(false)
  })
})

describe('buildGroupNotification', () => {
  it('aggregates multiple grade drops into one', () => {
    const items = [
      { videoTitle: 'Video A', oldGrade: 'A', newGrade: 'C' },
      { videoTitle: 'Video B', oldGrade: 'B', newGrade: 'D' },
      { videoTitle: 'Video C', oldGrade: 'A', newGrade: 'D' },
    ]
    const group = buildGroupNotification('grade_drop', items, '2026-W20')
    expect(group.title).toContain('3 vídeos')
    expect(group.message).toContain('Video A')
    expect(group.message).toContain('Video B')
    expect(group.message).toContain('Video C')
    expect(group.dedup_key).toBe('grade_drop:group:2026-W20')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/analytics-notification-service.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement notification service**

```typescript
export type NotificationType =
  | 'grade_drop' | 'ctr_drop' | 'monitoring_alert' | 'ab_test_completed'
  | 'retest_suggested' | 'optimization_available' | 'trending_viral' | 'optimization_resolved'

export const NOTIFICATION_PRIORITIES: Record<NotificationType, number> = {
  grade_drop: 5,
  ctr_drop: 4,
  monitoring_alert: 4,
  ab_test_completed: 3,
  retest_suggested: 3,
  optimization_available: 2,
  trending_viral: 2,
  optimization_resolved: 2,
}

export interface NotificationPayload {
  type: NotificationType
  priority: number
  title: string
  message: string
  dedup_key: string
  video_id?: string
  ab_test_id?: string
  cycle_id?: string
  suggested_action?: string
  action_href?: string
}

export function buildDedupKey(type: NotificationType, videoId: string | null, weekIso: string): string {
  if (!videoId) return `${type}:group:${weekIso}`
  return `${type}:${videoId}:${weekIso}`
}

export function shouldAggregate(count: number): boolean {
  return count >= 3
}

interface GradeDropInput {
  type: 'grade_drop'
  videoId: string
  videoTitle: string
  oldGrade: string
  newGrade: string
  weekIso: string
}

interface CtrDropInput {
  type: 'ctr_drop'
  videoId: string
  videoTitle: string
  currentCtr: number
  avgCtr: number
  weekIso: string
}

interface MonitoringAlertInput {
  type: 'monitoring_alert'
  videoId: string
  videoTitle: string
  checkDay: number
  ctrDelta: number
  weekIso: string
}

interface AbTestCompletedInput {
  type: 'ab_test_completed'
  videoId: string
  videoTitle: string
  testName: string
  winnerLabel: string
  ctrLift: number
  weekIso: string
}

interface RetestSuggestedInput {
  type: 'retest_suggested'
  videoId: string
  videoTitle: string
  weekIso: string
}

interface OptimizationAvailableInput {
  type: 'optimization_available'
  videoId: string
  videoTitle: string
  weekIso: string
}

interface TrendingViralInput {
  type: 'trending_viral'
  videoId: string
  videoTitle: string
  views48h: number
  channelAvg48h: number
  weekIso: string
}

interface OptimizationResolvedInput {
  type: 'optimization_resolved'
  videoId: string
  videoTitle: string
  weekIso: string
}

type NotificationInput =
  | GradeDropInput | CtrDropInput | MonitoringAlertInput | AbTestCompletedInput
  | RetestSuggestedInput | OptimizationAvailableInput | TrendingViralInput | OptimizationResolvedInput

export function buildNotification(input: NotificationInput): NotificationPayload {
  const priority = NOTIFICATION_PRIORITIES[input.type]!
  const dedupKey = buildDedupKey(input.type, input.videoId, input.weekIso)
  const baseHref = `/cms/youtube/analytics`

  switch (input.type) {
    case 'grade_drop':
      return {
        type: input.type,
        priority,
        title: `Queda de grade: ${input.videoTitle.slice(0, 40)}`,
        message: `Grade caiu de ${input.oldGrade} para ${input.newGrade}. Ação recomendada.`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `${baseHref}?tab=grades&video=${input.videoId}`,
        suggested_action: 'Verificar diagnóstico e considerar A/B test',
      }
    case 'ctr_drop':
      return {
        type: input.type,
        priority,
        title: `CTR em queda: ${input.videoTitle.slice(0, 40)}`,
        message: `CTR atual ${input.currentCtr.toFixed(1)}% vs média ${input.avgCtr.toFixed(1)}% (queda >20%).`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `${baseHref}?tab=grades&video=${input.videoId}`,
      }
    case 'monitoring_alert':
      return {
        type: input.type,
        priority,
        title: `Alerta de monitoramento: ${input.videoTitle.slice(0, 40)}`,
        message: `Dia ${input.checkDay}: CTR ${input.ctrDelta > 0 ? '+' : ''}${input.ctrDelta.toFixed(1)}% desde A/B test.`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `${baseHref}?tab=grades&video=${input.videoId}`,
      }
    case 'ab_test_completed':
      return {
        type: input.type,
        priority,
        title: `Teste concluído: ${input.testName}`,
        message: `Vencedor: ${input.winnerLabel} com +${input.ctrLift.toFixed(1)}% CTR.`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `/cms/youtube/ab-lab`,
      }
    case 'retest_suggested':
      return {
        type: input.type,
        priority,
        title: `Re-teste sugerido: ${input.videoTitle.slice(0, 40)}`,
        message: `Vídeo ainda C/D após cooldown. Novo ciclo de otimização disponível.`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `${baseHref}?tab=grades&video=${input.videoId}`,
      }
    case 'optimization_available':
      return {
        type: input.type,
        priority,
        title: `Nova recomendação AI: ${input.videoTitle.slice(0, 40)}`,
        message: `Cowork gerou nova análise com sugestões de otimização.`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `${baseHref}?tab=grades&video=${input.videoId}`,
      }
    case 'trending_viral':
      return {
        type: input.type,
        priority,
        title: `Vídeo viral detectado! 🚀`,
        message: `"${input.videoTitle.slice(0, 30)}" — ${input.views48h.toLocaleString('pt-BR')} views em 48h (${Math.round(input.views48h / input.channelAvg48h)}× a média).`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `${baseHref}?tab=grades&video=${input.videoId}`,
      }
    case 'optimization_resolved':
      return {
        type: input.type,
        priority,
        title: `Otimização bem-sucedida! ✓`,
        message: `"${input.videoTitle.slice(0, 30)}" atingiu grade B+ após otimização.`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `${baseHref}?tab=grades&video=${input.videoId}`,
      }
  }
}

export function buildGroupNotification(
  type: NotificationType,
  items: { videoTitle: string; oldGrade?: string; newGrade?: string }[],
  weekIso: string,
): NotificationPayload {
  const priority = NOTIFICATION_PRIORITIES[type]!
  const dedupKey = buildDedupKey(type, null, weekIso)
  const itemList = items.map(i => {
    if (i.oldGrade && i.newGrade) return `• ${i.videoTitle.slice(0, 30)} — ${i.oldGrade} → ${i.newGrade}`
    return `• ${i.videoTitle.slice(0, 30)}`
  }).join('\n')

  return {
    type,
    priority,
    title: `${items.length} vídeos tiveram ${type === 'grade_drop' ? 'queda de grade' : 'alteração'} esta semana`,
    message: itemList,
    dedup_key: dedupKey,
    action_href: `/cms/youtube/analytics?tab=grades`,
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/analytics-notification-service.test.ts`

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/notification-service.ts apps/web/test/analytics-notification-service.test.ts
git commit -m "feat(analytics): implement notification service with dedup and aggregation"
```

---

### Task 6: Fix Analytics API Error Handling

**Files:**
- Modify: `apps/web/src/lib/youtube/analytics-client.ts`

- [ ] **Step 1: Overhaul the analytics client error handling**

Replace the `queryYtAnalytics` function and add retry logic + structured errors:

```typescript
// Add at top of file after imports:
import * as Sentry from '@sentry/nextjs'

export class YouTubeAnalyticsError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string,
    public readonly channelId: string,
    public readonly errorBody?: string,
  ) {
    super(message)
    this.name = 'YouTubeAnalyticsError'
  }
}

async function fetchWithRetry(
  url: string,
  headers: HeadersInit,
  maxRetries = 3,
): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, { headers, next: { revalidate: 300 } })
    if (res.ok) return res
    if (res.status < 500 && res.status !== 429) return res
    lastError = new Error(`HTTP ${res.status}`)
    if (attempt < maxRetries - 1) {
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
    }
  }
  throw lastError!
}
```

Then replace the `queryYtAnalytics` function body to use `fetchWithRetry` and throw `YouTubeAnalyticsError` with Sentry capture instead of generic Error. Also remove the `.catch(() => null)` patterns in `fetchYtChannelMetrics` (the impressionReport catch) — replace with proper error propagation that returns `null` only for 403/insufficient_scope.

In `fetchYtSearchTerms` and `fetchYtDemographics`: remove the silent catch and let errors propagate to caller with structured info. The caller (`getCachedYtSearchTerms`) will catch and return empty array with a logged warning.

- [ ] **Step 2: Update cached wrappers in analytics-queries.ts**

Wrap each cached function with try/catch that logs to Sentry and returns `null` / empty array instead of throwing to the UI:

```typescript
export async function getCachedYtSearchTerms(siteId: string, days: number, channelId?: string) {
  try {
    return await unstable_cache(
      () => fetchYtSearchTerms(siteId, days, channelId),
      [`yt-search-${siteId}-${days}-${channelId ?? 'default'}`],
      { revalidate: 300 },
    )()
  } catch (e) {
    if (e instanceof YouTubeAnalyticsError) {
      Sentry.captureException(e, { tags: { youtube_endpoint: 'search_terms' } })
    }
    return []
  }
}
```

Apply same pattern to `getCachedYtDemographics` and `getCachedYtMetrics`.

- [ ] **Step 3: Verify existing tests still pass**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run`

Expected: All existing tests pass (no breaking changes to interfaces).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/youtube/analytics-client.ts apps/web/src/lib/youtube/analytics-queries.ts
git commit -m "fix(analytics): replace silent error swallowing with structured errors + Sentry + retry"
```

---

### Task 7: Analytics Sync Logic

**Files:**
- Create: `apps/web/src/lib/youtube/analytics-sync.ts`
- Create: `apps/web/test/analytics-sync.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi } from 'vitest'
import {
  computeViewDeltas,
  detectViral,
  getIsoWeek,
} from '@/lib/youtube/analytics-sync'

describe('computeViewDeltas', () => {
  it('computes delta from previous count', () => {
    const result = computeViewDeltas(1500, 1000, 400)
    expect(result.delta_today).toBe(500)
    expect(result.yesterday).toBe(400)
  })

  it('handles first sync (no previous data)', () => {
    const result = computeViewDeltas(1000, 0, 0)
    expect(result.delta_today).toBe(1000)
    expect(result.yesterday).toBe(0)
  })

  it('handles no change', () => {
    const result = computeViewDeltas(1000, 1000, 200)
    expect(result.delta_today).toBe(0)
    expect(result.yesterday).toBe(200)
  })
})

describe('detectViral', () => {
  it('detects viral when 48h views >= 5x channel avg', () => {
    expect(detectViral(5000, 800, 200)).toBe(true)
  })

  it('does not flag below threshold', () => {
    expect(detectViral(800, 400, 200)).toBe(false)
  })

  it('handles zero channel average', () => {
    expect(detectViral(100, 0, 0)).toBe(false)
  })
})

describe('getIsoWeek', () => {
  it('returns correct ISO week string', () => {
    const result = getIsoWeek(new Date('2026-05-17'))
    expect(result).toMatch(/^2026-W\d{2}$/)
  })
})
```

- [ ] **Step 2: Run tests (fail)**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/analytics-sync.test.ts`

- [ ] **Step 3: Implement analytics-sync.ts**

```typescript
export function computeViewDeltas(
  currentViewCount: number,
  previousViewCount: number,
  previousYesterday: number,
): { delta_today: number; yesterday: number } {
  const delta_today = Math.max(0, currentViewCount - previousViewCount)
  return { delta_today, yesterday: previousYesterday }
}

export function detectViral(
  deltaToday: number,
  deltaYesterday: number,
  channelAvg48h: number,
): boolean {
  if (channelAvg48h <= 0) return false
  const views48h = deltaToday + deltaYesterday
  return views48h >= 5 * channelAvg48h
}

export function getIsoWeek(date: Date): string {
  const d = new Date(date.getTime())
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
```

- [ ] **Step 4: Run tests (pass)**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/analytics-sync.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/analytics-sync.ts apps/web/test/analytics-sync.test.ts
git commit -m "feat(analytics): add sync helpers — view deltas, viral detection, ISO week"
```

---

## Phase 3 — Cron Jobs

### Task 8: Daily Analytics Metrics Sync Cron

**Files:**
- Create: `apps/web/src/app/api/cron/sync-analytics-metrics/route.ts`

- [ ] **Step 1: Create the cron route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { fetchYtChannelMetrics } from '@/lib/youtube/analytics-client'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { computeViewDeltas, detectViral, getIsoWeek } from '@/lib/youtube/analytics-sync'
import { buildNotification, NOTIFICATION_PRIORITIES } from '@/lib/youtube/notification-service'
import * as Sentry from '@sentry/nextjs'

const YT_ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2/reports'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()

  const { data: channels } = await supabase
    .from('youtube_channels')
    .select('id, channel_id, site_id, subscriber_count')
    .eq('enabled', true)

  if (!channels || channels.length === 0) {
    return NextResponse.json({ status: 'no_channels' })
  }

  let synced = 0
  let errors = 0
  const notifications: Array<{ siteId: string; payload: ReturnType<typeof buildNotification> }> = []

  for (const channel of channels) {
    try {
      const { accessToken } = await ensureFreshToken(channel.site_id, 'youtube', channel.channel_id)

      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 2)

      const endStr = end.toISOString().split('T')[0]!
      const startStr = start.toISOString().split('T')[0]!

      const url = new URL(YT_ANALYTICS_BASE)
      url.searchParams.set('ids', `channel==${channel.channel_id}`)
      url.searchParams.set('startDate', startStr)
      url.searchParams.set('endDate', endStr)
      url.searchParams.set('metrics', 'views,impressions,impressionClickThroughRate,averageViewDuration,likes,comments,shares,subscribersGained')
      url.searchParams.set('dimensions', 'video')
      url.searchParams.set('sort', '-views')
      url.searchParams.set('maxResults', '50')

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!res.ok) {
        Sentry.captureMessage(`sync-analytics-metrics failed for channel ${channel.channel_id}: ${res.status}`)
        errors++
        continue
      }

      const report = await res.json() as { rows?: (string | number)[][] }
      if (!report.rows?.length) { synced++; continue }

      const { data: videos } = await supabase
        .from('youtube_videos')
        .select('id, video_id, view_count, view_count_yesterday, view_count_delta_today')
        .eq('channel_id', channel.id)

      const videoMap = new Map((videos ?? []).map(v => [v.video_id, v]))

      const channelTotalDelta = (videos ?? []).reduce((s, v) => s + (v.view_count_delta_today ?? 0), 0)
      const channelAvg48h = (videos ?? []).length > 0
        ? (channelTotalDelta + (videos ?? []).reduce((s, v) => s + (v.view_count_yesterday ?? 0), 0)) / (videos ?? []).length
        : 0

      const today = new Date().toISOString().split('T')[0]!

      for (const row of report.rows) {
        const videoExternalId = String(row[0])
        const dbVideo = videoMap.get(videoExternalId)
        if (!dbVideo) continue

        const views = Number(row[1])
        const impressions = Number(row[2])
        const ctr = Number(row[3])
        const avgDuration = Number(row[4])
        const likes = Number(row[5])
        const comments = Number(row[6])
        const shares = Number(row[7])
        const subsGained = Number(row[8])

        const { delta_today, yesterday } = computeViewDeltas(
          views,
          dbVideo.view_count ?? 0,
          dbVideo.view_count_delta_today ?? 0,
        )

        await supabase.from('youtube_videos').update({
          view_count: views,
          impressions,
          ctr,
          avg_view_duration_seconds: avgDuration,
          view_count_delta_today: delta_today,
          view_count_yesterday: dbVideo.view_count_delta_today ?? 0,
          last_analytics_sync_at: new Date().toISOString(),
        }).eq('id', dbVideo.id)

        await supabase.from('youtube_video_analytics').upsert({
          youtube_video_id: dbVideo.id,
          site_id: channel.site_id,
          date: today,
          views: delta_today,
          impressions,
          ctr,
          avg_view_duration_seconds: avgDuration,
          likes,
          comments,
          shares,
          subscribers_gained: subsGained,
        }, { onConflict: 'youtube_video_id,date' })

        if (detectViral(delta_today, dbVideo.view_count_yesterday ?? 0, channelAvg48h)) {
          const { data: videoRow } = await supabase
            .from('youtube_videos')
            .select('title')
            .eq('id', dbVideo.id)
            .single()

          notifications.push({
            siteId: channel.site_id,
            payload: buildNotification({
              type: 'trending_viral',
              videoId: dbVideo.id,
              videoTitle: videoRow?.title ?? 'Video',
              views48h: delta_today + (dbVideo.view_count_yesterday ?? 0),
              channelAvg48h,
              weekIso: getIsoWeek(new Date()),
            }),
          })
        }
      }

      synced++
    } catch (e) {
      Sentry.captureException(e)
      errors++
    }
  }

  for (const { siteId, payload } of notifications) {
    await supabase.rpc('create_yt_notification', {
      p_site_id: siteId,
      p_type: payload.type,
      p_priority: payload.priority,
      p_title: payload.title,
      p_message: payload.message,
      p_dedup_key: payload.dedup_key,
      p_video_id: payload.video_id ?? null,
      p_suggested_action: payload.suggested_action ?? null,
      p_action_href: payload.action_href ?? null,
    })
  }

  return NextResponse.json({ synced, errors, notifications: notifications.length })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/cron/sync-analytics-metrics/route.ts
git commit -m "feat(analytics): add daily sync-analytics-metrics cron"
```

---

### Task 9: Weekly Grade Snapshot Cron

**Files:**
- Create: `apps/web/src/app/api/cron/weekly-grade-snapshot/route.ts`

- [ ] **Step 1: Create the cron route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { scoreVideo, computeTrend, assignGrade } from '@/lib/youtube/scoring'
import { getIsoWeek } from '@/lib/youtube/analytics-sync'
import { buildNotification, buildGroupNotification, shouldAggregate } from '@/lib/youtube/notification-service'
import type { ChannelBaseline, VideoScoreInput } from '@/lib/youtube/scoring-types'
import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const weekIso = getIsoWeek(new Date())

  const { data: channels } = await supabase
    .from('youtube_channels')
    .select('id, site_id, subscriber_count')
    .eq('enabled', true)

  if (!channels?.length) return NextResponse.json({ status: 'no_channels' })

  let graded = 0
  let flagged = 0

  for (const channel of channels) {
    try {
      const { data: videos } = await supabase
        .from('youtube_videos')
        .select('id, video_id, title, published_at, view_count, ctr, impressions, avg_view_percentage, avg_view_duration_seconds, traffic_sources')
        .eq('channel_id', channel.id)
        .not('ctr', 'is', null)
        .order('published_at', { ascending: false })
        .limit(50)

      if (!videos?.length) continue

      const { data: dailyData } = await supabase
        .from('youtube_video_analytics')
        .select('youtube_video_id, date, views, likes, comments, shares, subscribers_gained, impressions')
        .eq('site_id', channel.site_id)
        .gte('date', new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]!)
        .order('date', { ascending: true })

      const dailyByVideo = new Map<string, Array<{ date: string; views: number; likes: number; comments: number; shares: number; subscribers_gained: number; impressions: number }>>()
      for (const row of dailyData ?? []) {
        const arr = dailyByVideo.get(row.youtube_video_id) ?? []
        arr.push(row)
        dailyByVideo.set(row.youtube_video_id, arr)
      }

      const medians = computeChannelBaseline(videos, dailyByVideo, channel.subscriber_count ?? 0)

      const gradeDrops: Array<{ videoTitle: string; oldGrade: string; newGrade: string; videoId: string }> = []

      for (const video of videos) {
        const daily = dailyByVideo.get(video.id) ?? []
        const last28 = daily.filter(d => new Date(d.date).getTime() > Date.now() - 28 * 86400000)
        const totalViews = last28.reduce((s, d) => s + d.views, 0)
        const totalEngagement = last28.reduce((s, d) => s + d.likes + d.comments + d.shares, 0)
        const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0
        const totalSubs = last28.reduce((s, d) => s + d.subscribers_gained, 0)

        const input: VideoScoreInput = {
          videoId: video.id,
          publishedAt: video.published_at ?? new Date().toISOString(),
          ctr: video.ctr ?? 0,
          avgViewPercentage: video.avg_view_percentage ?? 0,
          impressions: video.impressions ?? 0,
          trafficSources: video.traffic_sources as VideoScoreInput['trafficSources'],
          engagementRate,
          dailyViews: last28.map(d => ({ date: d.date, views: d.views })),
          subscribersGained: totalSubs,
          viewCount: video.view_count ?? 0,
        }

        const scored = scoreVideo(input, medians)

        await supabase.from('video_grade_history').upsert({
          youtube_video_id: video.id,
          site_id: channel.site_id,
          grade: scored.grade,
          score: scored.overall,
          ctr: scored.axes.find(a => a.axis === 'ctr')?.normalized ?? null,
          retention: scored.axes.find(a => a.axis === 'retention')?.normalized ?? null,
          reach: scored.axes.find(a => a.axis === 'reach')?.normalized ?? null,
          engagement: scored.axes.find(a => a.axis === 'engagement')?.normalized ?? null,
          growth: scored.axes.find(a => a.axis === 'growth')?.normalized ?? null,
          sub_impact: scored.axes.find(a => a.axis === 'sub_impact')?.normalized ?? null,
          view_count: video.view_count,
          week_iso: weekIso,
        }, { onConflict: 'youtube_video_id,week_iso' })

        graded++

        const { data: history } = await supabase
          .from('video_grade_history')
          .select('grade, score, week_iso')
          .eq('youtube_video_id', video.id)
          .order('week_iso', { ascending: false })
          .limit(4)

        if (history && history.length >= 2) {
          const prevGrade = history[1]!.grade
          if (prevGrade && scored.grade > prevGrade) {
            const gradeOrder = { A: 0, B: 1, C: 2, D: 3 } as Record<string, number>
            const drop = (gradeOrder[scored.grade] ?? 0) - (gradeOrder[prevGrade] ?? 0)
            if (drop >= 2) {
              gradeDrops.push({ videoTitle: video.title ?? 'Video', oldGrade: prevGrade, newGrade: scored.grade, videoId: video.id })
            }
          }
        }

        if (history && history.length >= 2) {
          const lowWeeks = history.filter(h => h.grade === 'C' || h.grade === 'D').length
          if (lowWeeks >= 2) {
            const { data: existingCycle } = await supabase
              .from('optimization_cycles')
              .select('id')
              .eq('youtube_video_id', video.id)
              .not('state', 'in', '("resolved","exhausted","unmonitored")')
              .limit(1)
              .single()

            if (!existingCycle) {
              await supabase.from('optimization_cycles').insert({
                youtube_video_id: video.id,
                site_id: channel.site_id,
                state: 'flagged',
                cycle_number: 1,
                flagged_at: new Date().toISOString(),
              })
              flagged++
            }
          }
        }
      }

      if (gradeDrops.length > 0) {
        if (shouldAggregate(gradeDrops.length)) {
          const group = buildGroupNotification('grade_drop', gradeDrops, weekIso)
          await supabase.rpc('create_yt_notification', {
            p_site_id: channel.site_id,
            p_type: group.type,
            p_priority: group.priority,
            p_title: group.title,
            p_message: group.message,
            p_dedup_key: group.dedup_key,
            p_action_href: group.action_href ?? null,
          })
        } else {
          for (const drop of gradeDrops) {
            const payload = buildNotification({
              type: 'grade_drop',
              videoId: drop.videoId,
              videoTitle: drop.videoTitle,
              oldGrade: drop.oldGrade,
              newGrade: drop.newGrade,
              weekIso,
            })
            await supabase.rpc('create_yt_notification', {
              p_site_id: channel.site_id,
              p_type: payload.type,
              p_priority: payload.priority,
              p_title: payload.title,
              p_message: payload.message,
              p_dedup_key: payload.dedup_key,
              p_video_id: payload.video_id ?? null,
              p_action_href: payload.action_href ?? null,
            })
          }
        }
      }
    } catch (e) {
      Sentry.captureException(e)
    }
  }

  return NextResponse.json({ graded, flagged, week: weekIso })
}

function computeChannelBaseline(
  videos: Array<{ ctr: number | null; avg_view_percentage: number | null; impressions: number | null }>,
  dailyByVideo: Map<string, Array<{ views: number; likes: number; comments: number; shares: number; subscribers_gained: number; impressions: number }>>,
  subscriberCount: number,
): ChannelBaseline {
  const ctrs = videos.map(v => v.ctr ?? 0).filter(c => c > 0).sort((a, b) => a - b)
  const retentions = videos.map(v => v.avg_view_percentage ?? 0).filter(r => r > 0).sort((a, b) => a - b)
  const reaches = videos.map(v => v.impressions ?? 0).filter(r => r > 0).sort((a, b) => a - b)

  const allDaily = Array.from(dailyByVideo.values()).flat()
  const totalViews = allDaily.reduce((s, d) => s + d.views, 0)
  const totalDays = new Set(allDaily.map(d => d.date)).size || 1

  const median = (arr: number[]) => arr.length === 0 ? 0 : arr[Math.floor(arr.length / 2)]!

  return {
    medianCtr: median(ctrs),
    medianRetention: median(retentions),
    medianReach: median(reaches),
    medianEngagement: 4.0,
    medianGrowth: 0,
    medianSubImpact: 0.5,
    channelDailyMean: totalViews / totalDays,
    subscriberCount,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/cron/weekly-grade-snapshot/route.ts
git commit -m "feat(analytics): add weekly-grade-snapshot cron — 6-axis scoring + C/D flagging"
```

---

### Task 10: Intelligence Dispatch + Optimization Monitor + Expire Crons

**Files:**
- Create: `apps/web/src/app/api/cron/youtube-intelligence-dispatch/route.ts`
- Create: `apps/web/src/app/api/cron/optimization-monitor/route.ts`
- Create: `apps/web/src/app/api/cron/expire-notifications/route.ts`

- [ ] **Step 1: Create intelligence dispatch cron**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()

  const { data: channels } = await supabase
    .from('youtube_channels')
    .select('id, site_id')
    .eq('enabled', true)

  if (!channels?.length) return NextResponse.json({ status: 'no_channels' })

  let created = 0
  for (const channel of channels) {
    const { data: existing } = await supabase
      .from('youtube_intelligence_tasks')
      .select('id')
      .eq('channel_id', channel.id)
      .in('status', ['pending', 'running'])
      .limit(1)
      .single()

    if (existing) continue

    await supabase.from('youtube_intelligence_tasks').insert({
      site_id: channel.site_id,
      channel_id: channel.id,
      trigger_type: 'cron',
    })
    created++
  }

  return NextResponse.json({ created })
}
```

- [ ] **Step 2: Create optimization monitor cron**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildNotification } from '@/lib/youtube/notification-service'
import { getIsoWeek } from '@/lib/youtube/analytics-sync'
import { OPTIMIZATION_CONFIG } from '@/lib/youtube/optimization-loop'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const now = new Date()
  const weekIso = getIsoWeek(now)

  const { data: monitoring } = await supabase
    .from('optimization_cycles')
    .select('id, youtube_video_id, site_id, test_winner_applied_at, monitoring_day7_at, monitoring_day14_at, monitoring_day30_at')
    .eq('state', 'post_test_monitoring')
    .not('test_winner_applied_at', 'is', null)

  if (!monitoring?.length) return NextResponse.json({ checked: 0 })

  let checked = 0

  for (const cycle of monitoring) {
    const appliedAt = new Date(cycle.test_winner_applied_at!)
    const daysSinceApplied = Math.floor((now.getTime() - appliedAt.getTime()) / 86400000)

    const { data: video } = await supabase
      .from('youtube_videos')
      .select('title, ctr')
      .eq('id', cycle.youtube_video_id)
      .single()

    const { data: preTestHistory } = await supabase
      .from('video_grade_history')
      .select('score, grade')
      .eq('youtube_video_id', cycle.youtube_video_id)
      .lt('recorded_at', cycle.test_winner_applied_at!)
      .order('recorded_at', { ascending: false })
      .limit(4)

    const preTestAvgScore = preTestHistory?.length
      ? preTestHistory.reduce((s, h) => s + Number(h.score), 0) / preTestHistory.length
      : 0

    const currentCtr = video?.ctr ?? 0

    for (const checkDay of OPTIMIZATION_CONFIG.monitoring_check_days) {
      if (daysSinceApplied >= checkDay && daysSinceApplied < checkDay + 1) {
        const field = `monitoring_day${checkDay}_at` as const
        if (cycle[field]) continue

        const { data: latestGrade } = await supabase
          .from('video_grade_history')
          .select('score, grade')
          .eq('youtube_video_id', cycle.youtube_video_id)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .single()

        const result = { score: latestGrade?.score ?? 0, grade: latestGrade?.grade ?? 'D', ctr: currentCtr }

        await supabase.from('optimization_cycles').update({
          [`monitoring_day${checkDay}_at`]: now.toISOString(),
          [`monitoring_day${checkDay}_result`]: result,
        }).eq('id', cycle.id)

        if (checkDay === 30) {
          const isResolved = latestGrade && (latestGrade.grade === 'A' || latestGrade.grade === 'B')
          if (isResolved) {
            await supabase.from('optimization_cycles').update({
              state: 'resolved',
              resolved_at: now.toISOString(),
              resolved_reason: 'grade_improved',
            }).eq('id', cycle.id)

            const payload = buildNotification({
              type: 'optimization_resolved',
              videoId: cycle.youtube_video_id,
              videoTitle: video?.title ?? 'Video',
              weekIso,
            })
            await supabase.rpc('create_yt_notification', {
              p_site_id: cycle.site_id,
              p_type: payload.type,
              p_priority: payload.priority,
              p_title: payload.title,
              p_message: payload.message,
              p_dedup_key: payload.dedup_key,
              p_video_id: payload.video_id ?? null,
              p_action_href: payload.action_href ?? null,
            })
          } else {
            await supabase.from('optimization_cycles').update({
              state: 'retest_needed',
              cooldown_until: new Date(now.getTime() + OPTIMIZATION_CONFIG.cooldown_days * 86400000).toISOString(),
            }).eq('id', cycle.id)

            const payload = buildNotification({
              type: 'retest_suggested',
              videoId: cycle.youtube_video_id,
              videoTitle: video?.title ?? 'Video',
              weekIso,
            })
            await supabase.rpc('create_yt_notification', {
              p_site_id: cycle.site_id,
              p_type: payload.type,
              p_priority: payload.priority,
              p_title: payload.title,
              p_message: payload.message,
              p_dedup_key: payload.dedup_key,
              p_video_id: payload.video_id ?? null,
              p_action_href: payload.action_href ?? null,
            })
          }
        }

        checked++
      }
    }
  }

  return NextResponse.json({ checked })
}
```

- [ ] **Step 3: Create expire-notifications cron**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()

  const { count: expiredNotifications } = await supabase.rpc('expire_old_yt_notifications')

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: staleTasks } = await supabase
    .from('youtube_intelligence_tasks')
    .update({ status: 'stale', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lt('requested_at', sevenDaysAgo)
    .select('id')

  return NextResponse.json({
    expired_notifications: expiredNotifications ?? 0,
    stale_tasks: staleTasks?.length ?? 0,
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/cron/youtube-intelligence-dispatch/route.ts apps/web/src/app/api/cron/optimization-monitor/route.ts apps/web/src/app/api/cron/expire-notifications/route.ts
git commit -m "feat(analytics): add intelligence-dispatch, optimization-monitor, expire-notifications crons"
```

---

## Phase 4 — Pipeline API

### Task 11: Intelligence Pipeline GET Endpoint

**Files:**
- Create: `apps/web/src/app/api/pipeline/youtube/intelligence/route.ts`

- [ ] **Step 1: Create the GET + PATCH endpoint file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'
import type { IntelligenceGetResponse } from '@/lib/youtube/intelligence-types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  if (!requirePermission(authResult.auth, 'read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const channelId = req.nextUrl.searchParams.get('channel_id')
  if (!channelId) return NextResponse.json({ error: 'channel_id required' }, { status: 400 })

  const supabase = getSupabaseServiceClient()
  const siteId = authResult.auth.siteId

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('id, channel_id, name, subscriber_count')
    .eq('id', channelId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  const { data: videos } = await supabase
    .from('youtube_videos')
    .select('id, video_id, title, thumbnail_url, published_at, view_count, ctr, impressions, avg_view_percentage, avg_view_duration_seconds, retention_curve, traffic_sources')
    .eq('channel_id', channel.id)
    .order('published_at', { ascending: false })
    .limit(50)

  const { data: gradeHistory } = await supabase
    .from('video_grade_history')
    .select('youtube_video_id, grade, score, ctr, retention, reach, engagement, growth, sub_impact, week_iso')
    .eq('site_id', siteId)
    .order('week_iso', { ascending: false })
    .limit(200)

  const { data: cycles } = await supabase
    .from('optimization_cycles')
    .select('*')
    .eq('site_id', siteId)
    .not('state', 'in', '("resolved","exhausted")')

  const { data: abTests } = await supabase
    .from('ab_tests')
    .select('id, youtube_video_id, name, status, test_type, winner_variant_id, completed_reason, config')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: intelligence } = await supabase
    .from('youtube_intelligence')
    .select('*')
    .eq('channel_id', channel.id)
    .order('generated_at', { ascending: false })
    .limit(50)

  const response: IntelligenceGetResponse = {
    channel: {
      id: channel.id,
      channel_id: channel.channel_id,
      name: channel.name,
      subscriber_count: channel.subscriber_count,
    },
    videos: (videos ?? []).map(v => ({
      id: v.id,
      video_id: v.video_id,
      title: v.title,
      thumbnail_url: v.thumbnail_url,
      published_at: v.published_at,
      view_count: v.view_count,
      ctr: v.ctr,
      impressions: v.impressions,
      avg_view_percentage: v.avg_view_percentage,
      retention_curve: v.retention_curve,
      traffic_sources: v.traffic_sources,
    })),
    grade_history: gradeHistory ?? [],
    optimization_cycles: cycles ?? [],
    ab_tests: abTests ?? [],
    intelligence: intelligence ?? [],
  }

  const headers = buildRateLimitHeaders(authResult.auth)
  return NextResponse.json(response, { headers: headers ?? {} })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/pipeline/youtube/intelligence/route.ts
git commit -m "feat(analytics): add Pipeline GET /youtube/intelligence endpoint"
```

---

### Task 12: Intelligence Pipeline PATCH Endpoint

**Files:**
- Modify: `apps/web/src/app/api/pipeline/youtube/intelligence/route.ts`

- [ ] **Step 1: Add PATCH handler with Zod validation**

Append to the route file:

```typescript
const RecommendationSchema = z.object({
  video_id: z.string().uuid(),
  action_type: z.enum([
    'thumbnail_test', 'title_test', 'description_test', 'combo_test',
    'retention_fix', 'seo_optimization', 'engagement_boost', 'distribution_expand',
    'content_series', 'publish_timing', 'community_post', 'end_screen_optimize',
  ]),
  priority: z.enum(['high', 'medium', 'low']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(500),
  suggested_variant_description: z.string().max(200).optional(),
})

const NotificationSchema = z.object({
  type: z.enum([
    'grade_drop', 'ctr_drop', 'monitoring_alert', 'ab_test_completed',
    'retest_suggested', 'optimization_available', 'trending_viral', 'optimization_resolved',
  ]),
  video_id: z.string().uuid().optional(),
  priority: z.number().int().min(1).max(5),
  title: z.string().max(100),
  message: z.string().max(500),
})

const CoachingSchema = z.object({
  summary: z.string().max(500),
  priorities: z.array(z.object({
    axis: z.enum(['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']),
    score: z.number().min(0).max(10),
    diagnosis: z.string().max(300),
    action: z.string().max(300),
  })).max(6),
})

const PatchPayloadSchema = z.object({
  task_id: z.string().uuid(),
  video_recommendations: z.array(RecommendationSchema).max(25).optional(),
  coaching: CoachingSchema.optional(),
  notifications: z.array(NotificationSchema).max(20).optional(),
  channel_insights: z.object({
    patterns_detected: z.array(z.object({
      pattern_id: z.string(),
      category: z.string(),
      finding: z.string().max(300),
      confidence: z.number().min(0).max(1),
      sample_size: z.number().int(),
    })).optional(),
    analysis_text: z.string().max(2000).optional(),
  }).optional(),
})

export async function PATCH(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  if (!requirePermission(authResult.auth, 'write')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = PatchPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({
      error: 'validation_failed',
      details: parsed.error.issues.map(i => ({ path: i.path.join('.'), code: i.code, message: i.message })),
    }, { status: 422 })
  }

  const { task_id, video_recommendations, coaching, notifications, channel_insights } = parsed.data
  const supabase = getSupabaseServiceClient()
  const siteId = authResult.auth.siteId

  const { data: task } = await supabase
    .from('youtube_intelligence_tasks')
    .select('id, channel_id, status')
    .eq('id', task_id)
    .eq('site_id', siteId)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (task.status !== 'running') {
    return NextResponse.json({ error: `Task status is '${task.status}', expected 'running'` }, { status: 409 })
  }

  if (video_recommendations?.length) {
    const videoIds = video_recommendations.map(r => r.video_id)
    const { data: existing } = await supabase
      .from('youtube_videos')
      .select('id')
      .eq('channel_id', task.channel_id)
      .in('id', videoIds)

    const existingIds = new Set((existing ?? []).map(v => v.id))
    const missing = videoIds.filter(id => !existingIds.has(id))
    if (missing.length > 0) {
      return NextResponse.json({
        error: 'validation_failed',
        details: missing.map(id => ({ path: `video_recommendations[].video_id`, code: 'referential_integrity', message: `Video ${id} not found` })),
      }, { status: 422 })
    }

    for (const rec of video_recommendations) {
      await supabase.from('youtube_intelligence').upsert({
        site_id: siteId,
        channel_id: task.channel_id,
        video_id: rec.video_id,
        type: 'video',
        recommendations: rec,
        source: 'cowork',
        generated_at: new Date().toISOString(),
      }, { onConflict: 'site_id,channel_id,video_id,source' })

      const { data: cycle } = await supabase
        .from('optimization_cycles')
        .select('id, state')
        .eq('youtube_video_id', rec.video_id)
        .eq('state', 'flagged')
        .single()

      if (cycle) {
        await supabase.from('optimization_cycles').update({
          state: 'diagnosed',
          diagnosed_at: new Date().toISOString(),
          diagnosis_summary: rec.reasoning,
        }).eq('id', cycle.id)
      }
    }
  }

  if (coaching || channel_insights) {
    await supabase.from('youtube_intelligence').upsert({
      site_id: siteId,
      channel_id: task.channel_id,
      video_id: null,
      type: 'channel',
      coaching: coaching ?? null,
      patterns_detected: channel_insights?.patterns_detected ?? null,
      analysis_text: channel_insights?.analysis_text ?? null,
      source: 'cowork',
      generated_at: new Date().toISOString(),
    }, { onConflict: 'site_id,channel_id,source' })
  }

  if (notifications?.length) {
    const weekIso = new Date().toISOString().split('T')[0]!.replace(/-/g, '').slice(0, 6)
    for (const n of notifications) {
      const dedupKey = `cowork:${n.type}:${n.video_id ?? 'channel'}:${weekIso}`
      await supabase.rpc('create_yt_notification', {
        p_site_id: siteId,
        p_type: n.type,
        p_priority: n.priority,
        p_title: n.title,
        p_message: n.message,
        p_dedup_key: dedupKey,
        p_video_id: n.video_id ?? null,
      })
    }
  }

  await supabase.from('youtube_intelligence_tasks').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    result_summary: { recommendations: video_recommendations?.length ?? 0, has_coaching: !!coaching },
  }).eq('id', task_id)

  const headers = buildRateLimitHeaders(authResult.auth)
  return NextResponse.json({ status: 'ok', processed: true }, { headers: headers ?? {} })
}
```

- [ ] **Step 2: Add the `z` import at top of file**

Ensure `import { z } from 'zod'` is already at top.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/pipeline/youtube/intelligence/route.ts
git commit -m "feat(analytics): add Pipeline PATCH /youtube/intelligence with Zod validation"
```

---

### Task 13: Intelligence Task Pickup Endpoint

**Files:**
- Create: `apps/web/src/app/api/pipeline/youtube/intelligence/task/route.ts`

- [ ] **Step 1: Create the task endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  if (!requirePermission(authResult.auth, 'read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const status = req.nextUrl.searchParams.get('status') ?? 'pending'
  const supabase = getSupabaseServiceClient()

  const { data: task } = await supabase
    .from('youtube_intelligence_tasks')
    .select('id, site_id, channel_id, trigger_type, requested_at')
    .eq('site_id', authResult.auth.siteId)
    .eq('status', status)
    .order('requested_at', { ascending: true })
    .limit(1)
    .single()

  if (!task) {
    return new NextResponse(null, { status: 204 })
  }

  await supabase.from('youtube_intelligence_tasks').update({
    status: 'running',
    started_at: new Date().toISOString(),
  }).eq('id', task.id)

  const headers = buildRateLimitHeaders(authResult.auth)
  return NextResponse.json(task, { headers: headers ?? {} })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/pipeline/youtube/intelligence/task/route.ts
git commit -m "feat(analytics): add Pipeline GET /youtube/intelligence/task endpoint"
```

---

### Task 14: Pipeline API Integration Tests

**Files:**
- Create: `apps/web/test/analytics-intelligence-api.test.ts`

- [ ] **Step 1: Write integration tests**

```typescript
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const RecommendationSchema = z.object({
  video_id: z.string().uuid(),
  action_type: z.enum([
    'thumbnail_test', 'title_test', 'description_test', 'combo_test',
    'retention_fix', 'seo_optimization', 'engagement_boost', 'distribution_expand',
    'content_series', 'publish_timing', 'community_post', 'end_screen_optimize',
  ]),
  priority: z.enum(['high', 'medium', 'low']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(500),
})

const PatchPayloadSchema = z.object({
  task_id: z.string().uuid(),
  video_recommendations: z.array(RecommendationSchema).max(25).optional(),
  coaching: z.object({
    summary: z.string().max(500),
    priorities: z.array(z.object({
      axis: z.enum(['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']),
      score: z.number().min(0).max(10),
      diagnosis: z.string().max(300),
      action: z.string().max(300),
    })).max(6),
  }).optional(),
  notifications: z.array(z.object({
    type: z.enum([
      'grade_drop', 'ctr_drop', 'monitoring_alert', 'ab_test_completed',
      'retest_suggested', 'optimization_available', 'trending_viral', 'optimization_resolved',
    ]),
    video_id: z.string().uuid().optional(),
    priority: z.number().int().min(1).max(5),
    title: z.string().max(100),
    message: z.string().max(500),
  })).max(20).optional(),
})

describe('PATCH payload validation', () => {
  it('validates a complete valid payload', () => {
    const payload = {
      task_id: '123e4567-e89b-12d3-a456-426614174000',
      video_recommendations: [{
        video_id: '123e4567-e89b-12d3-a456-426614174001',
        action_type: 'thumbnail_test',
        priority: 'high',
        confidence: 0.85,
        reasoning: 'CTR below channel average, face close-ups work better',
      }],
      coaching: {
        summary: 'Focus on improving CTR through better thumbnails',
        priorities: [
          { axis: 'ctr', score: 3.2, diagnosis: 'CTR below benchmark', action: 'Test face close-ups' },
        ],
      },
    }
    expect(PatchPayloadSchema.safeParse(payload).success).toBe(true)
  })

  it('rejects missing task_id', () => {
    const payload = { video_recommendations: [] }
    expect(PatchPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects invalid action_type', () => {
    const payload = {
      task_id: '123e4567-e89b-12d3-a456-426614174000',
      video_recommendations: [{
        video_id: '123e4567-e89b-12d3-a456-426614174001',
        action_type: 'invalid_action',
        priority: 'high',
        confidence: 0.85,
        reasoning: 'test',
      }],
    }
    expect(PatchPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects confidence > 1', () => {
    const payload = {
      task_id: '123e4567-e89b-12d3-a456-426614174000',
      video_recommendations: [{
        video_id: '123e4567-e89b-12d3-a456-426614174001',
        action_type: 'thumbnail_test',
        priority: 'high',
        confidence: 1.5,
        reasoning: 'test',
      }],
    }
    expect(PatchPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects more than 25 recommendations', () => {
    const recs = Array.from({ length: 26 }, (_, i) => ({
      video_id: `123e4567-e89b-12d3-a456-42661417${String(i).padStart(4, '0')}`,
      action_type: 'thumbnail_test' as const,
      priority: 'medium' as const,
      confidence: 0.7,
      reasoning: 'test',
    }))
    const payload = { task_id: '123e4567-e89b-12d3-a456-426614174000', video_recommendations: recs }
    expect(PatchPayloadSchema.safeParse(payload).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/analytics-intelligence-api.test.ts`

Expected: All PASS (pure Zod schema validation, no dependencies).

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/analytics-intelligence-api.test.ts
git commit -m "test(analytics): add PATCH payload validation tests for intelligence API"
```

---

## Phase 5 — UI Components

### Task 15: Score Bar Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-score-bar.tsx`

- [ ] **Step 1: Create reusable score bar component**

```typescript
import type { Axis } from '@/lib/youtube/scoring-types'
import { AXIS_LABELS } from '@/lib/youtube/scoring-types'

interface Props {
  axis: Axis
  score: number
  showLabel?: boolean
}

function getBarColor(score: number): string {
  if (score >= 85) return 'bg-[#34d399]'
  if (score >= 65) return 'bg-[#60a5fa]'
  if (score >= 40) return 'bg-[#fbbf24]'
  return 'bg-[#f87171]'
}

export function YtScoreBar({ axis, score, showLabel = true }: Props) {
  const pct = Math.max(0, Math.min(100, score))

  return (
    <div className="flex items-center gap-2">
      {showLabel && (
        <span className="w-16 text-[10px] text-cms-text-muted truncate">{AXIS_LABELS[axis]}</span>
      )}
      <div className="relative h-1.5 flex-1 rounded-sm bg-cms-border">
        <div
          className={`absolute inset-y-0 left-0 rounded-sm ${getBarColor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right text-[10px] font-medium text-cms-text-muted">
        {Math.round(score)}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-score-bar.tsx
git commit -m "feat(analytics): add YtScoreBar reusable component"
```

---

### Task 16: Retention Curve V2 (Real Data)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-retention-curve-v2.tsx`

- [ ] **Step 1: Create the retention curve component**

```typescript
'use client'

interface Props {
  retentionCurve: number[] | null
  avgViewPercentage: number
}

export function YtRetentionCurveV2({ retentionCurve, avgViewPercentage }: Props) {
  if (!retentionCurve || retentionCurve.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded border border-dashed border-cms-border">
        <span className="text-xs text-cms-text-muted">
          Dados de retenção indisponíveis — mínimo 100 views necessários
        </span>
      </div>
    )
  }

  const w = 400
  const h = 80
  const points = retentionCurve.map((val, i) => ({
    x: (i / (retentionCurve.length - 1)) * w,
    y: h - (val / 100) * h,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaD = `${pathD} L ${w},${h} L 0,${h} Z`

  const cliffs: Array<{ x: number; startPct: number; endPct: number }> = []
  for (let i = 1; i < retentionCurve.length; i++) {
    const drop = retentionCurve[i - 1]! - retentionCurve[i]!
    if (drop > 30) {
      cliffs.push({
        x: (i / retentionCurve.length) * w,
        startPct: retentionCurve[i - 1]!,
        endPct: retentionCurve[i]!,
      })
    }
  }

  const midpointRetention = retentionCurve[Math.floor(retentionCurve.length / 2)] ?? 0
  const benchY = h - (50 / 100) * h

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: '80px' }}>
        <defs>
          <linearGradient id="retGradV2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#retGradV2)" />
        <line x1="0" y1={benchY} x2={w} y2={benchY} stroke="#958A75" strokeWidth="0.5" strokeDasharray="3" />
        <path d={pathD} fill="none" stroke="#60a5fa" strokeWidth="1.5" />
        {cliffs.map((cliff, i) => (
          <line key={i} x1={cliff.x} y1={0} x2={cliff.x} y2={h} stroke="#f87171" strokeWidth="1" strokeDasharray="2" opacity="0.6" />
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[9px] text-cms-text-muted">
        <span>0%</span>
        <span>Retenção média: {avgViewPercentage.toFixed(0)}%</span>
        <span>100%</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-retention-curve-v2.tsx
git commit -m "feat(analytics): add real-data retention curve component with cliff detection"
```

---

### Task 17: Video Diagnostic Panel

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-video-diagnostic.tsx`

- [ ] **Step 1: Create the expanded diagnostic component**

```typescript
'use client'

import { YtScoreBar } from './yt-score-bar'
import { YtRetentionCurveV2 } from './yt-retention-curve-v2'
import type { Axis } from '@/lib/youtube/scoring-types'
import { AXIS_LABELS } from '@/lib/youtube/scoring-types'

interface VideoAnalytics {
  videoId: string
  title: string
  axes: Array<{ axis: Axis; normalized: number }>
  retentionCurve: number[] | null
  avgViewPercentage: number
  diagnosis: string | null
  recommendation: string | null
  optimizationState: string | null
  trafficSources: Record<string, number> | null
}

interface Props {
  video: VideoAnalytics
  onCreateAbTest?: (videoId: string, testType: string) => void
  onDismiss?: (videoId: string) => void
}

export function YtVideoDiagnostic({ video, onCreateAbTest, onDismiss }: Props) {
  const weakestAxis = video.axes.reduce((min, a) => a.normalized < min.normalized ? a : min, video.axes[0]!)

  return (
    <div className="space-y-3 border-t border-cms-border pt-3">
      {/* Score Bars */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {video.axes.map(a => (
          <YtScoreBar key={a.axis} axis={a.axis} score={a.normalized} />
        ))}
      </div>

      {/* Weakest Axis Call-out */}
      <div className="rounded border border-[#f87171]/30 bg-[#f87171]/5 px-3 py-2">
        <p className="text-xs font-medium text-[#f87171]">
          Maior Fraqueza: {AXIS_LABELS[weakestAxis.axis]} ({Math.round(weakestAxis.normalized)}/100)
        </p>
      </div>

      {/* Retention Curve */}
      <YtRetentionCurveV2
        retentionCurve={video.retentionCurve}
        avgViewPercentage={video.avgViewPercentage}
      />

      {/* Traffic Sources */}
      {video.trafficSources && (
        <div className="flex gap-2 text-[10px] text-cms-text-muted">
          {Object.entries(video.trafficSources)
            .filter(([, v]) => v > 0)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 4)
            .map(([key, val]) => (
              <span key={key} className="rounded bg-cms-surface px-1.5 py-0.5">
                {key} {val}%
              </span>
            ))}
        </div>
      )}

      {/* AI Recommendation */}
      {video.recommendation && (
        <div className="rounded border border-cms-border bg-cms-surface p-3">
          <p className="mb-1 text-[10px] font-medium text-cms-text-muted">🤖 Recomendação AI</p>
          <p className="text-xs text-cms-text">{video.recommendation}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {onCreateAbTest && (
          <button
            onClick={() => onCreateAbTest(video.videoId, weakestAxis.axis === 'ctr' ? 'thumbnail' : 'title')}
            className="rounded bg-cms-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-[#FF9A60]"
          >
            Criar A/B Test →
          </button>
        )}
        {onDismiss && (
          <button
            onClick={() => onDismiss(video.videoId)}
            className="rounded border border-cms-border px-3 py-1.5 text-xs text-cms-text-muted hover:bg-cms-surface"
          >
            Dispensar
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-video-diagnostic.tsx
git commit -m "feat(analytics): add expanded video diagnostic panel"
```

---

### Task 18: Grades Panel V2

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-grades-v2.tsx`

- [ ] **Step 1: Create the redesigned grades panel**

```typescript
'use client'

import { useState } from 'react'
import { YtScoreBar } from './yt-score-bar'
import { YtVideoDiagnostic } from './yt-video-diagnostic'
import type { Axis, Grade, TrendDirection } from '@/lib/youtube/scoring-types'

interface VideoGradeRow {
  videoId: string
  title: string
  thumbnailUrl: string
  grade: Grade
  score: number
  axes: Array<{ axis: Axis; normalized: number }>
  trend: { direction: TrendDirection; velocity: number }
  optimizationState: string | null
  retentionCurve: number[] | null
  avgViewPercentage: number
  diagnosis: string | null
  recommendation: string | null
  trafficSources: Record<string, number> | null
}

interface Props {
  videos: VideoGradeRow[]
  onCreateAbTest?: (videoId: string, testType: string) => void
}

const GRADE_COLORS: Record<Grade, string> = {
  A: 'bg-[#34d399] text-black',
  B: 'bg-[#60a5fa] text-black',
  C: 'bg-[#fbbf24] text-black',
  D: 'bg-[#f87171] text-white',
}

const STATE_BADGES: Record<string, { label: string; color: string }> = {
  flagged: { label: 'Sinalizado', color: 'text-[#fbbf24]' },
  diagnosed: { label: 'Diagnosticado', color: 'text-[#f59e0b]' },
  test_suggested: { label: 'Teste Sugerido', color: 'text-[#60a5fa]' },
  testing: { label: 'Em Teste', color: 'text-[#8b5cf6]' },
  post_test_monitoring: { label: 'Monitorando', color: 'text-[#06b6d4]' },
}

export function YtGradesV2({ videos, onCreateAbTest }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [gradeFilter, setGradeFilter] = useState<Grade | 'all'>('all')
  const [sortBy, setSortBy] = useState<'score' | 'ctr' | 'trend'>('score')

  const filtered = videos.filter(v => gradeFilter === 'all' || v.grade === gradeFilter)
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'score') return a.score - b.score
    if (sortBy === 'trend') return a.trend.velocity - b.trend.velocity
    return (a.axes.find(x => x.axis === 'ctr')?.normalized ?? 0) - (b.axes.find(x => x.axis === 'ctr')?.normalized ?? 0)
  })

  const counts = { A: 0, B: 0, C: 0, D: 0 }
  for (const v of videos) counts[v.grade]++
  const inTest = videos.filter(v => v.optimizationState === 'testing').length

  return (
    <div className="space-y-3">
      {/* Summary Strip */}
      <div className="flex items-center gap-4 text-xs text-cms-text-muted">
        <span>{videos.length} vídeos</span>
        <span className="text-[#f87171]">{counts.D} Grade D</span>
        <span className="text-[#fbbf24]">{counts.C} Grade C</span>
        {inTest > 0 && <span className="text-[#8b5cf6]">{inTest} em teste</span>}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(['all', 'A', 'B', 'C', 'D'] as const).map(g => (
          <button
            key={g}
            onClick={() => setGradeFilter(g)}
            className={`rounded px-2 py-0.5 text-xs ${gradeFilter === g ? 'bg-cms-accent text-white' : 'border border-cms-border text-cms-text-muted hover:bg-cms-surface'}`}
          >
            {g === 'all' ? 'Todos' : g}
          </button>
        ))}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="ml-auto rounded border border-cms-border bg-transparent px-2 py-0.5 text-xs text-cms-text-muted"
        >
          <option value="score">Score ↑</option>
          <option value="ctr">CTR ↑</option>
          <option value="trend">Tendência ↑</option>
        </select>
      </div>

      {/* Video List */}
      <div className="space-y-1">
        {sorted.map(video => (
          <div key={video.videoId} className="rounded border border-cms-border bg-cms-surface">
            <button
              onClick={() => setExpandedId(expandedId === video.videoId ? null : video.videoId)}
              className="flex w-full items-center gap-3 p-3 text-left"
            >
              {/* Grade Badge */}
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-xs font-bold ${GRADE_COLORS[video.grade]}`}>
                {video.grade}
              </span>

              {/* Title + State */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-cms-text">{video.title}</p>
                {video.optimizationState && STATE_BADGES[video.optimizationState] && (
                  <span className={`text-[10px] ${STATE_BADGES[video.optimizationState]!.color}`}>
                    {STATE_BADGES[video.optimizationState]!.label}
                  </span>
                )}
              </div>

              {/* Mini Score Bars (hidden on mobile) */}
              <div className="hidden w-40 space-y-0.5 md:block">
                {video.axes.slice(0, 3).map(a => (
                  <YtScoreBar key={a.axis} axis={a.axis} score={a.normalized} showLabel={false} />
                ))}
              </div>

              {/* Score + Trend */}
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-medium text-cms-text">{Math.round(video.score)}</span>
                <span className={`text-xs ${video.trend.direction === 'up' ? 'text-[#34d399]' : video.trend.direction === 'down' ? 'text-[#f87171]' : 'text-cms-text-muted'}`}>
                  {video.trend.direction === 'up' ? '↑' : video.trend.direction === 'down' ? '↓' : '→'}
                </span>
              </div>
            </button>

            {/* Expanded Diagnostic */}
            {expandedId === video.videoId && (
              <div className="px-3 pb-3">
                <YtVideoDiagnostic
                  video={{
                    videoId: video.videoId,
                    title: video.title,
                    axes: video.axes,
                    retentionCurve: video.retentionCurve,
                    avgViewPercentage: video.avgViewPercentage,
                    diagnosis: video.diagnosis,
                    recommendation: video.recommendation,
                    optimizationState: video.optimizationState,
                    trafficSources: video.trafficSources,
                  }}
                  onCreateAbTest={onCreateAbTest}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-grades-v2.tsx
git commit -m "feat(analytics): add redesigned grades panel with expandable diagnostics"
```

---

### Task 19: Health Coach Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-health-coach.tsx`

- [ ] **Step 1: Create the Health Coach tab component**

```typescript
'use client'

import { YtHealthRing } from './yt-health-ring'
import { YtRadarChart } from './yt-radar-chart'
import type { Axis } from '@/lib/youtube/scoring-types'
import { AXIS_LABELS } from '@/lib/youtube/scoring-types'

interface CoachingCard {
  axis: Axis
  score: number
  benchmark: number
  channelValue: number
  diagnosis: string
  action: string
  source: 'cowork' | 'fallback'
}

interface Props {
  healthScore: number
  radarData: Array<{ axis: string; value: number; prevValue?: number }>
  coachingCards: CoachingCard[]
  videoCount: number
  lastAnalysisAt: string | null
  onRequestAnalysis?: () => void
  analysisState: 'idle' | 'pending' | 'running' | 'cooldown'
}

export function YtHealthCoach({
  healthScore,
  radarData,
  coachingCards,
  videoCount,
  lastAnalysisAt,
  onRequestAnalysis,
  analysisState,
}: Props) {
  const sortedCards = [...coachingCards].sort((a, b) => a.score - b.score)

  if (videoCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded border border-dashed border-cms-border p-12 text-center">
        <div className="h-24 w-24 rounded-full border-4 border-cms-border" />
        <p className="text-sm text-cms-text-muted">
          Nenhuma análise de inteligência disponível ainda.
        </p>
        <p className="max-w-md text-xs text-cms-text-dim">
          O Health Coach usa dados de performance do canal para gerar diagnósticos personalizados.
        </p>
        {onRequestAnalysis && (
          <button
            onClick={onRequestAnalysis}
            disabled={analysisState !== 'idle'}
            className="mt-2 rounded bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-[#FF9A60] disabled:opacity-50"
          >
            Solicitar Nova Análise →
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Row: Ring + Radar */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col items-center gap-2">
          <YtHealthRing score={healthScore} />
          <p className="text-xs text-cms-text-muted">Score geral do canal</p>
          {lastAnalysisAt && (
            <StalenessIndicator lastAt={lastAnalysisAt} />
          )}
        </div>
        <div>
          {videoCount >= 3 ? (
            <YtRadarChart data={radarData} />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-cms-text-muted">
              Mínimo 3 vídeos para radar
            </div>
          )}
          {videoCount >= 3 && videoCount < 10 && (
            <p className="mt-1 text-center text-[10px] text-cms-text-dim">
              Score se estabiliza com 10+ vídeos
            </p>
          )}
        </div>
      </div>

      {/* Coaching Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-cms-text">Áreas de Melhoria</h3>
        {sortedCards.map((card, i) => (
          <div key={card.axis} className="rounded border border-cms-border bg-cms-surface p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-medium text-cms-text">
                  #{i + 1} {AXIS_LABELS[card.axis]}
                </span>
                <span className="ml-2 text-xs text-cms-text-muted">
                  — {card.score.toFixed(1)}/10
                </span>
              </div>
              <span className={`rounded px-1.5 py-0.5 text-[9px] ${card.source === 'cowork' ? 'bg-[#8b5cf6]/10 text-[#8b5cf6]' : 'bg-cms-border text-cms-text-muted'}`}>
                {card.source === 'cowork' ? 'Análise AI' : 'Diagnóstico básico'}
              </span>
            </div>
            <p className="mt-2 text-xs text-cms-text-muted">{card.diagnosis}</p>
            <p className="mt-1 text-xs text-cms-text">{card.action}</p>
          </div>
        ))}
      </div>

      {/* Request Analysis Button */}
      {onRequestAnalysis && (
        <div className="flex justify-center">
          <button
            onClick={onRequestAnalysis}
            disabled={analysisState !== 'idle'}
            className="rounded border border-cms-border px-4 py-2 text-xs text-cms-text-muted hover:bg-cms-surface disabled:opacity-50"
          >
            {analysisState === 'pending' ? 'Em fila...' :
             analysisState === 'running' ? 'Analisando...' :
             analysisState === 'cooldown' ? 'Disponível em breve' :
             'Solicitar Nova Análise'}
          </button>
        </div>
      )}
    </div>
  )
}

function StalenessIndicator({ lastAt }: { lastAt: string }) {
  const days = Math.floor((Date.now() - new Date(lastAt).getTime()) / 86400000)
  const color = days < 7 ? 'bg-[#22c55e]' : days < 14 ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-cms-text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      Última análise: {days === 0 ? 'hoje' : `${days}d atrás`}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-health-coach.tsx
git commit -m "feat(analytics): add Health Coach tab with radar, coaching cards, staleness"
```

---

### Task 20: Notifications Bell + Panel

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-notifications-bell.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-notifications-panel.tsx`

- [ ] **Step 1: Create the bell component**

```typescript
'use client'

import { useState } from 'react'
import { YtNotificationsPanel } from './yt-notifications-panel'

interface Notification {
  id: string
  type: string
  priority: number
  title: string
  message: string
  read: boolean
  action_href: string | null
  created_at: string
}

interface Props {
  notifications: Notification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onDismiss: (id: string) => void
}

export function YtNotificationsBell({ notifications, onMarkRead, onMarkAllRead, onDismiss }: Props) {
  const [open, setOpen] = useState(false)
  const unreadCount = notifications.filter(n => !n.read).length
  const hasCritical = notifications.some(n => !n.read && n.priority >= 4)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded p-1.5 hover:bg-cms-surface"
        aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
      >
        <svg className="h-5 w-5 text-cms-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${hasCritical ? 'animate-pulse bg-[#ef4444]' : 'bg-cms-accent'}`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded border border-cms-border bg-[#1A1714] shadow-lg">
            <YtNotificationsPanel
              notifications={notifications}
              onMarkRead={onMarkRead}
              onMarkAllRead={onMarkAllRead}
              onDismiss={onDismiss}
            />
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create the panel component**

```typescript
'use client'

interface Notification {
  id: string
  type: string
  priority: number
  title: string
  message: string
  read: boolean
  action_href: string | null
  created_at: string
}

interface Props {
  notifications: Notification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onDismiss: (id: string) => void
}

const PRIORITY_BORDER: Record<number, string> = {
  5: 'border-l-[#ef4444]',
  4: 'border-l-[#f59e0b]',
  3: 'border-l-[#60a5fa]',
  2: 'border-l-[#958A75]',
  1: 'border-l-[#958A75]',
}

export function YtNotificationsPanel({ notifications, onMarkRead, onMarkAllRead, onDismiss }: Props) {
  if (notifications.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-cms-text-muted">Nenhuma notificação. Tudo em ordem!</p>
      </div>
    )
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between border-b border-cms-border px-3 py-2">
        <span className="text-xs font-medium text-cms-text">Notificações</span>
        <button onClick={onMarkAllRead} className="text-[10px] text-cms-accent hover:underline">
          Marcar tudo como lido
        </button>
      </div>
      <div className="divide-y divide-cms-border">
        {notifications.slice(0, 50).map(n => (
          <div
            key={n.id}
            className={`group flex gap-2 border-l-2 ${PRIORITY_BORDER[n.priority] ?? ''} px-3 py-2.5 ${!n.read ? 'bg-cms-surface/50' : ''}`}
          >
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${n.read ? 'border border-cms-text-muted' : 'bg-cms-accent'}`} />
            <div className="min-w-0 flex-1">
              <p className={`text-xs ${n.read ? 'text-cms-text-muted' : 'font-medium text-cms-text'}`}>
                {n.title}
              </p>
              <p className="mt-0.5 text-[10px] text-cms-text-dim line-clamp-2">{n.message}</p>
              <p className="mt-0.5 text-[9px] text-cms-text-dim">
                {formatRelativeTime(n.created_at)}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(n.id) }}
              className="shrink-0 opacity-0 group-hover:opacity-100 text-cms-text-muted hover:text-cms-text"
              aria-label="Dispensar"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-notifications-bell.tsx apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-notifications-panel.tsx
git commit -m "feat(analytics): add notification bell + dropdown panel"
```

---

### Task 21: Bootstrap Banner

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-bootstrap-banner.tsx`

- [ ] **Step 1: Create bootstrap banner component**

```typescript
interface Props {
  weeksSinceFirstGrade: number
}

export function YtBootstrapBanner({ weeksSinceFirstGrade }: Props) {
  if (weeksSinceFirstGrade >= 2) return null

  const progress = Math.min(100, (weeksSinceFirstGrade / 2) * 100)

  return (
    <div className="rounded border border-[#60a5fa]/30 bg-[#60a5fa]/5 px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="text-sm">ℹ️</span>
        <div className="flex-1">
          <p className="text-xs font-medium text-[#60a5fa]">
            Primeira avaliação — tendências disponíveis após 2 semanas de coleta.
          </p>
          <p className="mt-1 text-[10px] text-cms-text-muted">
            Os scores atuais são baseados em métricas cumulativas. Grades se tornarão mais precisos com o tempo.
          </p>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-cms-border">
            <div
              className="h-full rounded-full bg-[#60a5fa] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-[9px] text-cms-text-dim">
            {weeksSinceFirstGrade === 0 ? 'Dia 0 — coletando dados...' : 'Semana 1 — mais 1 semana para tendências'}
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-bootstrap-banner.tsx
git commit -m "feat(analytics): add bootstrap banner for day 0-14 experience"
```

---

### Task 22: Before/After Comparison Card

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-before-after.tsx`

- [ ] **Step 1: Create before/after component**

```typescript
interface BeforeAfterData {
  oldThumbnailUrl: string | null
  newThumbnailUrl: string | null
  oldTitle: string | null
  newTitle: string | null
  ctrBefore: number
  ctrAfter: number
  gradeBefore: string
  gradeAfter: string
  daysSinceApplied: number
  extraClicks: number
}

interface Props {
  data: BeforeAfterData
}

export function YtBeforeAfter({ data }: Props) {
  const ctrLift = data.ctrBefore > 0 ? ((data.ctrAfter - data.ctrBefore) / data.ctrBefore) * 100 : 0

  return (
    <div className="rounded border border-cms-border bg-cms-surface">
      <div className="flex items-center justify-between border-b border-cms-border px-3 py-2">
        <span className="text-xs font-medium text-cms-text">Antes / Depois</span>
        <span className="text-[10px] text-cms-text-muted">
          Há {data.daysSinceApplied} dias desde mudança
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-cms-border">
        {/* Before */}
        <div className="p-3 space-y-2">
          {data.oldThumbnailUrl && (
            <img src={data.oldThumbnailUrl} alt="Thumbnail anterior" className="w-full rounded-sm aspect-video object-cover" />
          )}
          {data.oldTitle && data.oldTitle !== data.newTitle && (
            <p className="text-[10px] text-cms-text-muted line-through">{data.oldTitle}</p>
          )}
          <div className="space-y-0.5 text-[10px]">
            <p className="text-cms-text-muted">CTR: {data.ctrBefore.toFixed(1)}%</p>
            <p className="text-cms-text-muted">Grade: {data.gradeBefore}</p>
          </div>
        </div>
        {/* After */}
        <div className="p-3 space-y-2">
          {data.newThumbnailUrl && (
            <img src={data.newThumbnailUrl} alt="Thumbnail nova" className="w-full rounded-sm aspect-video object-cover" />
          )}
          {data.newTitle && data.oldTitle !== data.newTitle && (
            <p className="text-[10px] text-cms-text">{data.newTitle}</p>
          )}
          <div className="space-y-0.5 text-[10px]">
            <p className="text-[#34d399]">CTR: {data.ctrAfter.toFixed(1)}% ({ctrLift > 0 ? '+' : ''}{ctrLift.toFixed(0)}%)</p>
            <p className="text-cms-text">Grade: {data.gradeAfter}</p>
          </div>
        </div>
      </div>
      {data.extraClicks > 0 && (
        <div className="border-t border-cms-border px-3 py-2">
          <p className="text-[10px] text-[#34d399]">
            Estimativa: +{data.extraClicks.toLocaleString('pt-BR')} cliques extras desde a mudança
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-before-after.tsx
git commit -m "feat(analytics): add Before/After comparison card for completed A/B tests"
```

---

### Task 23: Outliers V2 (MAD-based)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-outliers-v2.tsx`

- [ ] **Step 1: Create outlier component**

```typescript
'use client'

import { useState } from 'react'
import type { Axis, OutlierResult } from '@/lib/youtube/scoring-types'
import { AXIS_LABELS } from '@/lib/youtube/scoring-types'

interface OutlierVideo {
  videoId: string
  title: string
  score: number
  modifiedZ: number
  direction: 'positive' | 'negative'
  axis: Axis
  patterns?: string[]
}

interface Props {
  outliers: OutlierVideo[]
}

export function YtOutliersV2({ outliers }: Props) {
  const [selectedAxis, setSelectedAxis] = useState<Axis | 'all'>('all')
  const axes: Axis[] = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']

  const filtered = selectedAxis === 'all' ? outliers : outliers.filter(o => o.axis === selectedAxis)
  const positive = filtered.filter(o => o.direction === 'positive').sort((a, b) => b.modifiedZ - a.modifiedZ)
  const negative = filtered.filter(o => o.direction === 'negative').sort((a, b) => a.modifiedZ - b.modifiedZ)

  if (outliers.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded border border-dashed border-cms-border">
        <p className="text-xs text-cms-text-muted">Nenhum outlier significativo detectado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Axis Selector */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedAxis('all')}
          className={`rounded px-2 py-0.5 text-[10px] ${selectedAxis === 'all' ? 'bg-cms-accent text-white' : 'border border-cms-border text-cms-text-muted'}`}
        >
          Todos
        </button>
        {axes.map(a => (
          <button
            key={a}
            onClick={() => setSelectedAxis(a)}
            className={`rounded px-2 py-0.5 text-[10px] ${selectedAxis === a ? 'bg-cms-accent text-white' : 'border border-cms-border text-cms-text-muted'}`}
          >
            {AXIS_LABELS[a]}
          </button>
        ))}
      </div>

      {/* Positive Outliers */}
      {positive.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[#34d399]">Destaques Positivos</h4>
          {positive.map(o => (
            <div key={`${o.videoId}-${o.axis}`} className="rounded border border-cms-border border-l-2 border-l-[#34d399] bg-cms-surface p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-cms-text">{o.title}</span>
                <span className="text-[10px] font-mono text-[#34d399]">z={o.modifiedZ.toFixed(1)}</span>
              </div>
              <div className="mt-1 flex gap-1.5">
                <span className="rounded bg-[#34d399]/10 px-1.5 py-0.5 text-[9px] text-[#34d399]">
                  {AXIS_LABELS[o.axis]}
                </span>
                {o.patterns?.map(p => (
                  <span key={p} className="rounded bg-cms-border px-1.5 py-0.5 text-[9px] text-cms-text-muted">{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Negative Outliers */}
      {negative.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[#f87171]">Underperformers</h4>
          {negative.map(o => (
            <div key={`${o.videoId}-${o.axis}`} className="rounded border border-cms-border border-l-2 border-l-[#f87171] bg-cms-surface p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-cms-text">{o.title}</span>
                <span className="text-[10px] font-mono text-[#f87171]">z={o.modifiedZ.toFixed(1)}</span>
              </div>
              <span className="mt-1 inline-block rounded bg-[#f87171]/10 px-1.5 py-0.5 text-[9px] text-[#f87171]">
                {AXIS_LABELS[o.axis]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-outliers-v2.tsx
git commit -m "feat(analytics): add MAD-based outliers component with axis selector"
```

---

### Task 24: Server Actions for Analytics Intelligence

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/analytics/actions.ts`

- [ ] **Step 1: Create server actions**

```typescript
'use server'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { scoreVideo, computeOutliers, computeTrend } from '@/lib/youtube/scoring'
import type { ChannelBaseline, VideoScoreInput, Axis } from '@/lib/youtube/scoring-types'
import { revalidateTag } from 'next/cache'

export async function fetchGradesData(channelId: string) {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data: videos } = await supabase
    .from('youtube_videos')
    .select('id, video_id, title, thumbnail_url, published_at, view_count, ctr, impressions, avg_view_percentage, avg_view_duration_seconds, retention_curve, traffic_sources')
    .eq('channel_id', channelId)
    .eq('site_id', siteId)
    .not('ctr', 'is', null)
    .order('published_at', { ascending: false })
    .limit(50)

  if (!videos?.length) return { videos: [], outliers: [] }

  const { data: dailyData } = await supabase
    .from('youtube_video_analytics')
    .select('youtube_video_id, date, views, likes, comments, shares, subscribers_gained, impressions')
    .eq('site_id', siteId)
    .gte('date', new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]!)

  const dailyByVideo = new Map<string, Array<{ date: string; views: number; likes: number; comments: number; shares: number; subscribers_gained: number; impressions: number }>>()
  for (const row of dailyData ?? []) {
    const arr = dailyByVideo.get(row.youtube_video_id) ?? []
    arr.push(row)
    dailyByVideo.set(row.youtube_video_id, arr)
  }

  const { data: gradeHistory } = await supabase
    .from('video_grade_history')
    .select('youtube_video_id, score, week_iso')
    .eq('site_id', siteId)
    .order('week_iso', { ascending: false })
    .limit(200)

  const historyByVideo = new Map<string, number[]>()
  for (const h of gradeHistory ?? []) {
    const arr = historyByVideo.get(h.youtube_video_id) ?? []
    arr.push(Number(h.score))
    historyByVideo.set(h.youtube_video_id, arr)
  }

  const { data: cycles } = await supabase
    .from('optimization_cycles')
    .select('youtube_video_id, state')
    .eq('site_id', siteId)
    .not('state', 'in', '("resolved","exhausted","unmonitored")')

  const cycleByVideo = new Map((cycles ?? []).map(c => [c.youtube_video_id, c.state]))

  const { data: intelligence } = await supabase
    .from('youtube_intelligence')
    .select('video_id, recommendations, analysis_text')
    .eq('site_id', siteId)
    .not('video_id', 'is', null)

  const intelByVideo = new Map((intelligence ?? []).map(i => [i.video_id, i]))

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('subscriber_count')
    .eq('id', channelId)
    .single()

  const baseline = computeBaseline(videos, dailyByVideo, channel?.subscriber_count ?? 0)

  const scoredVideos = videos.map(video => {
    const daily = dailyByVideo.get(video.id) ?? []
    const last28 = daily.filter(d => new Date(d.date).getTime() > Date.now() - 28 * 86400000)
    const totalViews = last28.reduce((s, d) => s + d.views, 0)
    const totalEng = last28.reduce((s, d) => s + d.likes + d.comments + d.shares, 0)
    const totalSubs = last28.reduce((s, d) => s + d.subscribers_gained, 0)

    const input: VideoScoreInput = {
      videoId: video.id,
      publishedAt: video.published_at ?? new Date().toISOString(),
      ctr: video.ctr ?? 0,
      avgViewPercentage: video.avg_view_percentage ?? 0,
      impressions: video.impressions ?? 0,
      trafficSources: video.traffic_sources as VideoScoreInput['trafficSources'],
      engagementRate: totalViews > 0 ? (totalEng / totalViews) * 100 : 0,
      dailyViews: last28.map(d => ({ date: d.date, views: d.views })),
      subscribersGained: totalSubs,
      viewCount: video.view_count ?? 0,
    }

    const scored = scoreVideo(input, baseline)
    const weeklyScores = historyByVideo.get(video.id) ?? []
    const trend = computeTrend(weeklyScores)
    const intel = intelByVideo.get(video.id)
    const rec = intel?.recommendations as { reasoning?: string; suggested_variant_description?: string } | null

    return {
      videoId: video.id,
      title: video.title ?? '',
      thumbnailUrl: video.thumbnail_url ?? '',
      grade: scored.grade,
      score: scored.overall,
      axes: scored.axes.map(a => ({ axis: a.axis, normalized: a.normalized })),
      trend: { direction: trend.direction, velocity: trend.velocity },
      optimizationState: cycleByVideo.get(video.id) ?? null,
      retentionCurve: video.retention_curve as number[] | null,
      avgViewPercentage: video.avg_view_percentage ?? 0,
      diagnosis: rec?.reasoning ?? null,
      recommendation: rec?.suggested_variant_description ?? null,
      trafficSources: video.traffic_sources as Record<string, number> | null,
    }
  })

  const ctrScores = scoredVideos.map(v => ({
    videoId: v.videoId,
    score: v.axes.find(a => a.axis === 'ctr')?.normalized ?? 50,
  }))
  const outliers = computeOutliers(ctrScores, 'ctr')

  return { videos: scoredVideos, outliers }
}

export async function fetchNotifications() {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data } = await supabase
    .from('yt_notifications')
    .select('id, type, priority, title, message, read, action_href, created_at')
    .eq('site_id', siteId)
    .is('expired_at', null)
    .eq('dismissed', false)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  return data ?? []
}

export async function markNotificationRead(notificationId: string) {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  await supabase.from('yt_notifications').update({ read: true }).eq('id', notificationId).eq('site_id', siteId)
  revalidateTag('yt-notifications')
}

export async function markAllNotificationsRead() {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  await supabase.from('yt_notifications').update({ read: true }).eq('site_id', siteId).eq('read', false)
  revalidateTag('yt-notifications')
}

export async function dismissNotification(notificationId: string) {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  await supabase.from('yt_notifications').update({ dismissed: true }).eq('id', notificationId).eq('site_id', siteId)
  revalidateTag('yt-notifications')
}

export async function requestIntelligenceAnalysis(channelId: string) {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data: existing } = await supabase
    .from('youtube_intelligence_tasks')
    .select('id, requested_at')
    .eq('site_id', siteId)
    .eq('channel_id', channelId)
    .in('status', ['pending', 'running'])
    .limit(1)
    .single()

  if (existing) return { error: 'already_active' }

  const { data: recent } = await supabase
    .from('youtube_intelligence_tasks')
    .select('completed_at')
    .eq('site_id', siteId)
    .eq('channel_id', channelId)
    .eq('trigger_type', 'manual')
    .order('requested_at', { ascending: false })
    .limit(1)
    .single()

  if (recent?.completed_at) {
    const hoursSince = (Date.now() - new Date(recent.completed_at).getTime()) / 3600000
    if (hoursSince < 24) return { error: 'cooldown', hours_remaining: Math.ceil(24 - hoursSince) }
  }

  await supabase.from('youtube_intelligence_tasks').insert({
    site_id: siteId,
    channel_id: channelId,
    trigger_type: 'manual',
  })

  return { ok: true }
}

function computeBaseline(
  videos: Array<{ ctr: number | null; avg_view_percentage: number | null; impressions: number | null }>,
  dailyByVideo: Map<string, Array<{ views: number }>>,
  subscriberCount: number,
): ChannelBaseline {
  const ctrs = videos.map(v => v.ctr ?? 0).filter(c => c > 0).sort((a, b) => a - b)
  const retentions = videos.map(v => v.avg_view_percentage ?? 0).filter(r => r > 0).sort((a, b) => a - b)
  const reaches = videos.map(v => v.impressions ?? 0).filter(r => r > 0).sort((a, b) => a - b)
  const allDaily = Array.from(dailyByVideo.values()).flat()
  const totalViews = allDaily.reduce((s, d) => s + d.views, 0)
  const totalDays = new Set(allDaily.map((d: any) => d.date)).size || 1
  const median = (arr: number[]) => arr.length === 0 ? 0 : arr[Math.floor(arr.length / 2)]!

  return {
    medianCtr: median(ctrs),
    medianRetention: median(retentions),
    medianReach: median(reaches),
    medianEngagement: 4.0,
    medianGrowth: 0,
    medianSubImpact: 0.5,
    channelDailyMean: totalViews / totalDays,
    subscriberCount,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/analytics/actions.ts
git commit -m "feat(analytics): add server actions for grades, notifications, intelligence requests"
```

---

### Task 25: Wire Analytics Page + Tabs

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-analytics-tabs.tsx`
- Modify: `apps/web/src/app/cms/(authed)/youtube/analytics/page.tsx`

- [ ] **Step 1: Update tabs to include Health Coach**

Add 'Coach' tab to the existing tab list in `yt-analytics-tabs.tsx`. The current tabs are Visão Geral, Grades, Outliers, Search Terms, Demographics. Add "Health Coach" after Outliers.

- [ ] **Step 2: Update the page component to fetch and pass new data**

The page.tsx needs to call `fetchGradesData`, `fetchNotifications`, and pass data to the new components. Add imports for `YtGradesV2`, `YtHealthCoach`, `YtOutliersV2`, `YtNotificationsBell`, `YtBootstrapBanner`, and the server actions.

Wire the components based on the active tab, passing scored data from `fetchGradesData()`.

- [ ] **Step 3: Verify the dev server loads without errors**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds (or only unrelated warnings).

- [ ] **Step 4: Run full test suite**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/analytics/
git commit -m "feat(analytics): wire Intelligence Engine UI — grades v2, health coach, notifications, outliers"
```

---

## Phase 6 — A/B Lab Integration + Final Polish

### Task 26: Extend ab-evaluate Cron

**Files:**
- Modify: `apps/web/src/app/api/cron/ab-evaluate/route.ts`

- [ ] **Step 1: Add notification + optimization state transition**

After the existing winner-declaration logic, add:

```typescript
// After winner is applied:
import { buildNotification } from '@/lib/youtube/notification-service'
import { getIsoWeek } from '@/lib/youtube/analytics-sync'

// Inside the completion handler, after test status → 'completed':
const weekIso = getIsoWeek(new Date())
const payload = buildNotification({
  type: 'ab_test_completed',
  videoId: test.youtube_video_id,
  videoTitle: videoTitle,
  testName: test.name,
  winnerLabel: winnerVariant.label ?? 'Variante vencedora',
  ctrLift: ctrLiftPercent,
  weekIso,
})

await supabase.rpc('create_yt_notification', {
  p_site_id: test.site_id,
  p_type: payload.type,
  p_priority: payload.priority,
  p_title: payload.title,
  p_message: payload.message,
  p_dedup_key: payload.dedup_key,
  p_video_id: payload.video_id ?? null,
  p_ab_test_id: test.id,
  p_action_href: payload.action_href ?? null,
})

// Transition optimization cycle to post_test_monitoring:
const { data: cycle } = await supabase
  .from('optimization_cycles')
  .select('id')
  .eq('youtube_video_id', test.youtube_video_id)
  .eq('state', 'testing')
  .single()

if (cycle) {
  await supabase.from('optimization_cycles').update({
    state: 'post_test_monitoring',
    test_completed_at: new Date().toISOString(),
    test_winner_applied_at: new Date().toISOString(),
  }).eq('id', cycle.id)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/cron/ab-evaluate/route.ts
git commit -m "feat(analytics): extend ab-evaluate to emit notification + transition optimization state"
```

---

### Task 27: "Criar A/B Test" Integration from Grades

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx`

- [ ] **Step 1: Accept pre-fill props**

Add an optional `prefill` prop to the wizard component:

```typescript
interface PrefillData {
  videoId?: string
  testType?: 'thumbnail' | 'title' | 'description' | 'combo'
  suggestedDescription?: string
  fromOptimizationCycle?: string
}

interface Props {
  // ... existing props
  prefill?: PrefillData
}
```

When `prefill` is provided:
- Pre-select the video in the video picker
- Pre-select the test type
- Pre-fill the variant description field
- Store `fromOptimizationCycle` to link the test to the cycle on creation

On test creation (in the action), if `fromOptimizationCycle` is set, transition the cycle to `testing`:

```typescript
if (fromOptimizationCycle) {
  await supabase.from('optimization_cycles').update({
    state: 'testing',
    testing_started_at: new Date().toISOString(),
    ab_test_id: newTestId,
  }).eq('id', fromOptimizationCycle)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx
git commit -m "feat(analytics): add pre-fill support to A/B wizard from optimization cycle"
```

---

### Task 28: Cowork Reference Document

**Files:**
- Create: `docs/cowork-youtube-intelligence-reference.md`

- [ ] **Step 1: Write the pipeline reference document**

Create the 553-line PT-BR Cowork reference with: GET response structure, pattern analysis methodology, output format with examples, notification triggers, retry/backoff spec, channel size tier modifiers. This document gets seeded into the pipeline context DB via the existing seed script.

- [ ] **Step 2: Seed the reference**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && node scripts/seed-pipeline-reference.js`

(Uses existing pipeline context seed script to upsert the doc into `pipeline_contexts` table.)

- [ ] **Step 3: Commit**

```bash
git add docs/cowork-youtube-intelligence-reference.md
git commit -m "docs(analytics): add Cowork YouTube Intelligence reference document (PT-BR)"
```

---

### Task 29: Vercel Cron Configuration

**Files:**
- Modify: `vercel.json` (or `vercel.ts` if that's what exists)

- [ ] **Step 1: Add cron schedules**

Add the new cron routes:

```json
{
  "crons": [
    { "path": "/api/cron/sync-analytics-metrics", "schedule": "0 12 * * *" },
    { "path": "/api/cron/weekly-grade-snapshot", "schedule": "0 6 * * 1" },
    { "path": "/api/cron/youtube-intelligence-dispatch", "schedule": "0 8 * * 1" },
    { "path": "/api/cron/optimization-monitor", "schedule": "0 7 * * *" },
    { "path": "/api/cron/expire-notifications", "schedule": "0 3 * * *" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "chore(analytics): add Intelligence Engine cron schedules to Vercel config"
```

---

### Task 30: Final Integration Test Suite

**Files:**
- Run all tests

- [ ] **Step 1: Run the full test suite**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web`

Expected: All tests pass (existing + new scoring/notification/optimization tests).

- [ ] **Step 2: Type check**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 3: Fix any issues found in steps 1-2**

If tests fail or type errors exist, fix them before proceeding.

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix(analytics): resolve type/test issues from Intelligence Engine integration"
```

---

## Dependency Graph

```
Task 1 (DB migration) ─────────────────────────────────────┐
  ├── Task 2 (types) ──── Task 3 (scoring) ─────────────┐  │
  ├── Task 4 (optimization loop) ────────────────────────┤  │
  ├── Task 5 (notification service) ─────────────────────┤  │
  ├── Task 6 (analytics API fix) ────────────────────────┤  │
  └── Task 7 (analytics sync) ──────────────────────────┤  │
                                                         │  │
  Tasks 2-7 can run IN PARALLEL after Task 1 completes   │  │
                                                         ↓  ↓
  Task 8 (sync cron) ─── depends on: 5, 6, 7            │
  Task 9 (grade snapshot cron) ─── depends on: 3, 5, 7  │
  Task 10 (dispatch+monitor+expire crons) ─── dep: 4, 5 │
  Tasks 8-10 can run IN PARALLEL                         │
                                                         ↓
  Task 11 (GET endpoint) ─── depends on: 1              │
  Task 12 (PATCH endpoint) ─── depends on: 11           │
  Task 13 (task endpoint) ─── depends on: 1             │
  Task 14 (API tests) ─── no deps (pure validation)     │
  Tasks 11, 13, 14 can run IN PARALLEL                  │
                                                         ↓
  Tasks 15-23 (UI) ─── can ALL run IN PARALLEL          │
  Task 24 (server actions) ─── depends on: 3            │
  Task 25 (wire page) ─── depends on: 15-24            │
                                                         ↓
  Task 26 (ab-evaluate extend) ─── depends on: 4, 5    │
  Task 27 (wizard prefill) ─── depends on: 4           │
  Task 28 (cowork reference) ─── no deps               │
  Task 29 (vercel cron config) ─── no deps             │
  Tasks 26-29 can run IN PARALLEL                       │
                                                         ↓
  Task 30 (final integration) ─── depends on ALL
```

## Parallelization Strategy

**Wave 1:** Task 1 (DB migration) — MUST run first, all others depend on it

**Wave 2 (6 parallel):** Tasks 2, 4, 5, 6, 7, 14 — all independent after DB

**Wave 3 (5 parallel):** Tasks 3, 8, 9, 10, 11, 13 — depend on Wave 2 outputs

**Wave 4 (11 parallel):** Tasks 12, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24 — UI + PATCH

**Wave 5 (5 parallel):** Tasks 25, 26, 27, 28, 29 — wiring + integration

**Wave 6:** Task 30 — final validation
