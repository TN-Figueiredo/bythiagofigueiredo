import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

// ─── Mock Sentry (transitive dep) ───────────────────────────────────────────
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

// ─── Mock transitive deps that youtube.ts imports ───────────────────────────
vi.mock('@/lib/youtube/analytics-sync', () => ({
  getIsoWeek: vi.fn().mockReturnValue('2026-W23'),
}))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({
  fanOutToSiteAdmins: vi.fn(),
}))
vi.mock('@/lib/youtube/scoring', () => ({
  scoreVideo: vi.fn(),
  computeBaseline: vi.fn(),
  computeTrend: vi.fn(),
  assignGrade: vi.fn(),
}))
vi.mock('@/lib/youtube/analytics-client', () => ({
  fetchYtDemographics: vi.fn(),
  fetchYtSearchTerms: vi.fn(),
}))

// ─── Constants ──────────────────────────────────────────────────────────────
const SITE_ID = '11111111-1111-1111-1111-111111111111'
const VIDEO_ID_1 = '22222222-2222-2222-2222-222222222222'
const VIDEO_ID_2 = '33333333-3333-3333-3333-333333333333'
const TEST_ID_1 = '44444444-4444-4444-4444-444444444444'
const TEST_ID_2 = '55555555-5555-5555-5555-555555555555'
const TEST_ID_3 = '66666666-6666-6666-6666-666666666666'
const VARIANT_A = 'aaaa1111-1111-1111-1111-111111111111'
const VARIANT_B = 'aaaa2222-2222-2222-2222-222222222222'
const VARIANT_C = 'aaaa3333-3333-3333-3333-333333333333'

// ─── Chainable Supabase Mock Builder ────────────────────────────────────────

type MockResult = { data: unknown; error: unknown }

/**
 * Creates a chainable mock that records method calls and returns
 * a configurable result at the terminal call.
 */
function chainable(result: MockResult): Record<string, ReturnType<typeof vi.fn>> {
  const self: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'not', 'in', 'is',
    'gte', 'gt', 'lte', 'lt',
    'order', 'limit', 'range',
    'single', 'maybeSingle',
    'filter',
  ]
  for (const m of methods) {
    if (m === 'single' || m === 'maybeSingle') {
      self[m] = vi.fn().mockResolvedValue(result)
    } else {
      self[m] = vi.fn().mockReturnValue(self)
    }
  }
  // Terminal: if we resolve the chain itself (no single/maybeSingle), return result
  // Make the chain thenable so `await supabase.from(...).select(...)...` works
  Object.defineProperty(self, 'then', {
    value: (resolve: (v: MockResult) => void, reject: (e: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
    writable: true,
    enumerable: false,
  })
  return self
}

interface TableSetup {
  [tableName: string]: MockResult | ((callIndex: number) => MockResult)
}

function createMockSupabase(tables: TableSetup) {
  const callCounts: Record<string, number> = {}

  return {
    from: vi.fn((table: string) => {
      const count = callCounts[table] ?? 0
      callCounts[table] = count + 1
      const setup = tables[table]
      if (!setup) return chainable({ data: null, error: null })
      const result = typeof setup === 'function' ? setup(count) : setup
      return chainable(result)
    }),
  }
}

function makeCtx(supabase: unknown): ServiceContext {
  return {
    siteId: SITE_ID,
    permissions: ['read', 'write'],
    supabase: supabase as ServiceContext['supabase'],
  }
}

// ─── Import service functions under test ────────────────────────────────────
import {
  getAbLearnings,
  getAbSuggestions,
  getAbFatigueAlerts,
  getAbDashboard,
  getAbVideoHistory,
} from '@/lib/pipeline/services/youtube'

// ═══════════════════════════════════════════════════════════════════════════
// getAbLearnings
// ═══════════════════════════════════════════════════════════════════════════

describe('getAbLearnings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns tag win rates from completed tests', async () => {
    const completedTests = [
      {
        id: TEST_ID_1,
        result_metadata: { ctr_lift_percent: 12 },
        winner_variant_id: VARIANT_A,
        test_type: 'thumbnail',
      },
      {
        id: TEST_ID_2,
        result_metadata: { ctr_lift_percent: 8 },
        winner_variant_id: VARIANT_B,
        test_type: 'thumbnail',
      },
    ]

    const winners = [
      { id: VARIANT_A, metadata: { thumbnail_tags: ['bold-text', 'face-close'] } },
      { id: VARIANT_B, metadata: { thumbnail_tags: ['bold-text', 'red-arrow'] } },
    ]

    const allVariants = [
      { id: VARIANT_A, metadata: { thumbnail_tags: ['bold-text', 'face-close'] } },
      { id: VARIANT_B, metadata: { thumbnail_tags: ['bold-text', 'red-arrow'] } },
      { id: VARIANT_C, metadata: { thumbnail_tags: ['face-close', 'minimal'] } },
    ]

    let abTestCallIdx = 0
    const sb = createMockSupabase({
      ab_tests: () => {
        abTestCallIdx++
        return { data: completedTests, error: null }
      },
      ab_test_variants: (idx: number) => {
        if (idx === 0) return { data: winners, error: null }
        return { data: allVariants, error: null }
      },
    })

    const result = await getAbLearnings(makeCtx(sb))

    expect(result.data.totalCompletedTests).toBe(2)
    expect(result.data.tagWinRates.length).toBeGreaterThan(0)

    const boldText = result.data.tagWinRates.find(t => t.tag === 'bold-text')
    expect(boldText).toBeDefined()
    expect(boldText!.wins).toBe(2)
  })

  it('computes avgLift correctly', async () => {
    const completedTests = [
      {
        id: TEST_ID_1,
        result_metadata: { ctr_lift_percent: 20 },
        winner_variant_id: VARIANT_A,
        test_type: 'thumbnail',
      },
      {
        id: TEST_ID_2,
        result_metadata: { ctr_lift_percent: 10 },
        winner_variant_id: VARIANT_B,
        test_type: 'thumbnail',
      },
    ]

    const winners = [
      { id: VARIANT_A, metadata: { thumbnail_tags: ['emoji'] } },
      { id: VARIANT_B, metadata: { thumbnail_tags: ['emoji'] } },
    ]

    const allVariants = [
      { id: VARIANT_A, metadata: { thumbnail_tags: ['emoji'] } },
      { id: VARIANT_B, metadata: { thumbnail_tags: ['emoji'] } },
    ]

    const sb = createMockSupabase({
      ab_tests: { data: completedTests, error: null },
      ab_test_variants: (idx: number) =>
        idx === 0
          ? { data: winners, error: null }
          : { data: allVariants, error: null },
    })

    const result = await getAbLearnings(makeCtx(sb))

    const emojiTag = result.data.tagWinRates.find(t => t.tag === 'emoji')
    expect(emojiTag).toBeDefined()
    // avgLift = (20 + 10) / 2 wins = 15
    expect(emojiTag!.avgLift).toBe(15)
  })

  it('returns channel insights text', async () => {
    const completedTests = [
      {
        id: TEST_ID_1,
        result_metadata: { ctr_lift_percent: 5 },
        winner_variant_id: VARIANT_A,
        test_type: 'thumbnail',
      },
    ]

    const winners = [
      { id: VARIANT_A, metadata: { thumbnail_tags: ['bright-colors'] } },
    ]

    const allVariants = [
      { id: VARIANT_A, metadata: { thumbnail_tags: ['bright-colors'] } },
    ]

    const sb = createMockSupabase({
      ab_tests: { data: completedTests, error: null },
      ab_test_variants: (idx: number) =>
        idx === 0
          ? { data: winners, error: null }
          : { data: allVariants, error: null },
    })

    const result = await getAbLearnings(makeCtx(sb))

    expect(result.data.channelInsights.length).toBeGreaterThan(0)
    // Positive lift => positive insight
    const positiveInsight = result.data.channelInsights.find(i => i.type === 'positive')
    expect(positiveInsight).toBeDefined()
    expect(positiveInsight!.text).toContain('bright-colors')
  })

  it('returns totalCompletedTests count', async () => {
    const completedTests = [
      { id: TEST_ID_1, result_metadata: { ctr_lift_percent: 3 }, winner_variant_id: VARIANT_A, test_type: 'thumbnail' },
      { id: TEST_ID_2, result_metadata: { ctr_lift_percent: 7 }, winner_variant_id: VARIANT_B, test_type: 'title' },
      { id: TEST_ID_3, result_metadata: { ctr_lift_percent: 2 }, winner_variant_id: VARIANT_C, test_type: 'thumbnail' },
    ]

    const winners = [
      { id: VARIANT_A, metadata: { thumbnail_tags: ['x'] } },
      { id: VARIANT_B, metadata: { thumbnail_tags: ['y'] } },
      { id: VARIANT_C, metadata: { thumbnail_tags: ['z'] } },
    ]

    const allVariants = winners

    const sb = createMockSupabase({
      ab_tests: { data: completedTests, error: null },
      ab_test_variants: (idx: number) =>
        idx === 0 ? { data: winners, error: null } : { data: allVariants, error: null },
    })

    const result = await getAbLearnings(makeCtx(sb))
    expect(result.data.totalCompletedTests).toBe(3)
  })

  it('returns empty when no completed tests', async () => {
    const sb = createMockSupabase({
      ab_tests: { data: [], error: null },
    })

    const result = await getAbLearnings(makeCtx(sb))

    expect(result.data.totalCompletedTests).toBe(0)
    expect(result.data.tagWinRates).toEqual([])
    expect(result.data.channelInsights).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// getAbSuggestions
// ═══════════════════════════════════════════════════════════════════════════

describe('getAbSuggestions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns videos eligible for testing (1000+ views, 14+ days old)', async () => {
    const eligibleVideos = [
      { id: VIDEO_ID_1, youtube_video_id: 'yt-vid-1', title: 'Old popular video', ctr: 3.5, view_count: 5000, impressions: 100000 },
      { id: VIDEO_ID_2, youtube_video_id: 'yt-vid-2', title: 'Another old video', ctr: 2.1, view_count: 2000, impressions: 50000 },
    ]

    const sb = createMockSupabase({
      youtube_videos: { data: eligibleVideos, error: null },
      ab_tests: { data: [], error: null },
      video_grade_history: { data: [], error: null },
    })

    const result = await getAbSuggestions(makeCtx(sb))

    expect(result.data.suggestions.length).toBe(2)
    expect(result.data.suggestions[0]!.videoId).toBe(VIDEO_ID_1)
    expect(result.data.suggestions[0]!.title).toBe('Old popular video')
  })

  it('excludes recently tested videos (60-day cooldown)', async () => {
    const allVideos = [
      { id: VIDEO_ID_1, youtube_video_id: 'yt-1', title: 'Recently tested', ctr: 3, view_count: 5000, impressions: 100000 },
      { id: VIDEO_ID_2, youtube_video_id: 'yt-2', title: 'Not tested', ctr: 2, view_count: 3000, impressions: 50000 },
    ]

    // VIDEO_ID_1 was tested recently
    const recentTests = [{ youtube_video_id: VIDEO_ID_1 }]

    const sb = createMockSupabase({
      youtube_videos: { data: allVideos, error: null },
      ab_tests: { data: recentTests, error: null },
      video_grade_history: { data: [], error: null },
    })

    const result = await getAbSuggestions(makeCtx(sb))

    const ids = result.data.suggestions.map(s => s.videoId)
    expect(ids).not.toContain(VIDEO_ID_1)
    expect(ids).toContain(VIDEO_ID_2)
  })

  it('returns grade and suggested test type', async () => {
    const videos = [
      { id: VIDEO_ID_1, youtube_video_id: 'yt-1', title: 'Video', ctr: 1.5, view_count: 10000, impressions: 200000 },
    ]

    const grades = [
      { youtube_video_id: VIDEO_ID_1, grade: 'D', score: 30 },
    ]

    const sb = createMockSupabase({
      youtube_videos: { data: videos, error: null },
      ab_tests: { data: [], error: null },
      video_grade_history: { data: grades, error: null },
    })

    const result = await getAbSuggestions(makeCtx(sb))

    expect(result.data.suggestions.length).toBe(1)
    const suggestion = result.data.suggestions[0]!
    expect(suggestion.grade).toBe('D')
    expect(suggestion.suggestedTestType).toBe('thumbnail')
  })

  it('returns empty when no eligible videos', async () => {
    const sb = createMockSupabase({
      youtube_videos: { data: [], error: null },
    })

    const result = await getAbSuggestions(makeCtx(sb))
    expect(result.data.suggestions).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// getAbFatigueAlerts
// ═══════════════════════════════════════════════════════════════════════════

describe('getAbFatigueAlerts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns pending alerts with video title', async () => {
    const alertData = [
      {
        id: 'alert-1',
        video_id: VIDEO_ID_1,
        z_score: -2.5,
        expected_ctr: 5.0,
        actual_ctr: 3.2,
        detected_at: '2026-06-01T10:00:00Z',
        youtube_videos: { id: VIDEO_ID_1, title: 'My Cool Video' },
      },
    ]

    const sb = createMockSupabase({
      youtube_fatigue_alerts: { data: alertData, error: null },
    })

    const result = await getAbFatigueAlerts(makeCtx(sb))

    expect(result.data.alerts.length).toBe(1)
    const alert = result.data.alerts[0]!
    expect(alert.title).toBe('My Cool Video')
    expect(alert.videoId).toBe(VIDEO_ID_1)
    expect(alert.zScore).toBe(-2.5)
    expect(alert.expectedCtr).toBe(5.0)
    expect(alert.actualCtr).toBe(3.2)
  })

  it('computes daysSinceChange correctly via createdAt', async () => {
    // The service returns createdAt (mapped from detected_at); daysSinceChange
    // is computed by the getThumbnailFatigueAlerts function, not getAbFatigueAlerts.
    // getAbFatigueAlerts returns createdAt as-is.
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString()
    const alertData = [
      {
        id: 'alert-2',
        video_id: VIDEO_ID_2,
        z_score: -1.8,
        expected_ctr: 4.0,
        actual_ctr: 2.8,
        detected_at: fiveDaysAgo,
        youtube_videos: { id: VIDEO_ID_2, title: 'Older Video' },
      },
    ]

    const sb = createMockSupabase({
      youtube_fatigue_alerts: { data: alertData, error: null },
    })

    const result = await getAbFatigueAlerts(makeCtx(sb))

    expect(result.data.alerts.length).toBe(1)
    // createdAt should be the detected_at value
    expect(result.data.alerts[0]!.createdAt).toBe(fiveDaysAgo)
  })

  it('returns empty when no pending alerts', async () => {
    const sb = createMockSupabase({
      youtube_fatigue_alerts: { data: [], error: null },
    })

    const result = await getAbFatigueAlerts(makeCtx(sb))
    expect(result.data.alerts).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// getAbDashboard
// ═══════════════════════════════════════════════════════════════════════════

describe('getAbDashboard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns correct active test count', async () => {
    const tests = [
      { id: '1', status: 'active', winner_variant_id: null, confidence_at_completion: null, result_metadata: null, parent_test_id: null },
      { id: '2', status: 'active', winner_variant_id: null, confidence_at_completion: null, result_metadata: null, parent_test_id: null },
      { id: '3', status: 'queued', winner_variant_id: null, confidence_at_completion: null, result_metadata: null, parent_test_id: null },
      { id: '4', status: 'draft', winner_variant_id: null, confidence_at_completion: null, result_metadata: null, parent_test_id: null },
      { id: '5', status: 'completed', winner_variant_id: VARIANT_A, confidence_at_completion: 0.95, result_metadata: { ctr_lift_percent: 10 }, parent_test_id: null },
    ]

    const sb = createMockSupabase({
      ab_tests: { data: tests, error: null },
    })

    const result = await getAbDashboard(makeCtx(sb))

    // active + queued = 3
    expect(result.data.activeTests).toBe(3)
    expect(result.data.testsByStatus.active).toBe(3)
    expect(result.data.testsByStatus.draft).toBe(1)
  })

  it('computes win rate excluding playoff children', async () => {
    const tests = [
      // Root completed WITH winner
      { id: '1', status: 'completed', winner_variant_id: VARIANT_A, confidence_at_completion: 0.95, result_metadata: { ctr_lift_percent: 10 }, parent_test_id: null },
      // Root completed WITH winner
      { id: '2', status: 'completed', winner_variant_id: VARIANT_B, confidence_at_completion: 0.90, result_metadata: { ctr_lift_percent: 5 }, parent_test_id: null },
      // Root completed WITHOUT winner (no decisive outcome)
      { id: '3', status: 'completed', winner_variant_id: null, confidence_at_completion: 0.60, result_metadata: null, parent_test_id: null },
      // Playoff child (should be excluded from win rate)
      { id: '4', status: 'completed', winner_variant_id: VARIANT_C, confidence_at_completion: 0.99, result_metadata: { ctr_lift_percent: 20 }, parent_test_id: '1' },
    ]

    const sb = createMockSupabase({
      ab_tests: { data: tests, error: null },
    })

    const result = await getAbDashboard(makeCtx(sb))

    // Root completed = 3 (ids 1, 2, 3). Winners among root = 2. Win rate = 2/3 * 100 = 66.67%
    expect(result.data.winRate).toBeCloseTo(66.67, 1)
  })

  it('computes average lift from completed tests', async () => {
    const tests = [
      { id: '1', status: 'completed', winner_variant_id: VARIANT_A, confidence_at_completion: 0.95, result_metadata: { ctr_lift_percent: 20 }, parent_test_id: null },
      { id: '2', status: 'completed', winner_variant_id: VARIANT_B, confidence_at_completion: 0.90, result_metadata: { ctr_lift_percent: 10 }, parent_test_id: null },
      // This has winner but no ctr_lift_percent => lift = 0
      { id: '3', status: 'completed', winner_variant_id: VARIANT_C, confidence_at_completion: 0.85, result_metadata: {}, parent_test_id: null },
    ]

    const sb = createMockSupabase({
      ab_tests: { data: tests, error: null },
    })

    const result = await getAbDashboard(makeCtx(sb))

    // Lift values: [20, 10, 0] => avg = 10
    expect(result.data.avgLift).toBe(10)
  })

  it('returns tests by status breakdown', async () => {
    const tests = [
      { id: '1', status: 'draft', winner_variant_id: null, confidence_at_completion: null, result_metadata: null, parent_test_id: null },
      { id: '2', status: 'draft', winner_variant_id: null, confidence_at_completion: null, result_metadata: null, parent_test_id: null },
      { id: '3', status: 'active', winner_variant_id: null, confidence_at_completion: null, result_metadata: null, parent_test_id: null },
      { id: '4', status: 'paused', winner_variant_id: null, confidence_at_completion: null, result_metadata: null, parent_test_id: null },
      { id: '5', status: 'completed', winner_variant_id: VARIANT_A, confidence_at_completion: 0.95, result_metadata: { ctr_lift_percent: 5 }, parent_test_id: null },
      { id: '6', status: 'completed', winner_variant_id: null, confidence_at_completion: null, result_metadata: null, parent_test_id: null },
    ]

    const sb = createMockSupabase({
      ab_tests: { data: tests, error: null },
    })

    const result = await getAbDashboard(makeCtx(sb))

    expect(result.data.testsByStatus).toEqual({
      draft: 2,
      active: 1,
      paused: 1,
      completed: 2,
    })
  })

  it('returns zeroes when no tests exist', async () => {
    const sb = createMockSupabase({
      ab_tests: { data: [], error: null },
    })

    const result = await getAbDashboard(makeCtx(sb))

    expect(result.data.activeTests).toBe(0)
    expect(result.data.winRate).toBe(0)
    expect(result.data.avgLift).toBe(0)
    expect(result.data.avgConfidence).toBe(0)
    expect(result.data.testsByStatus).toEqual({
      draft: 0,
      active: 0,
      paused: 0,
      completed: 0,
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// getAbVideoHistory
// ═══════════════════════════════════════════════════════════════════════════

describe('getAbVideoHistory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns test history for a specific video', async () => {
    const youtubeVideoId = VIDEO_ID_1
    const testHistory = [
      {
        id: TEST_ID_1,
        test_type: 'thumbnail',
        status: 'completed',
        started_at: '2026-04-01T00:00:00Z',
        completed_at: '2026-04-15T00:00:00Z',
        result_metadata: { ctr_lift_percent: 12.5 },
        winner: [{ label: 'B' }],
      },
      {
        id: TEST_ID_2,
        test_type: 'title',
        status: 'active',
        started_at: '2026-05-01T00:00:00Z',
        completed_at: null,
        result_metadata: null,
        winner: null,
      },
    ]

    const sb = createMockSupabase({
      ab_tests: { data: testHistory, error: null },
    })

    const result = await getAbVideoHistory(makeCtx(sb), youtubeVideoId)

    expect(result.data.videoId).toBe(youtubeVideoId)
    expect(result.data.tests.length).toBe(2)

    const completedTest = result.data.tests[0]!
    expect(completedTest.id).toBe(TEST_ID_1)
    expect(completedTest.type).toBe('thumbnail')
    expect(completedTest.status).toBe('completed')
    expect(completedTest.startedAt).toBe('2026-04-01T00:00:00Z')
    expect(completedTest.endedAt).toBe('2026-04-15T00:00:00Z')
  })

  it('includes winner label and lift percentage', async () => {
    const testHistory = [
      {
        id: TEST_ID_1,
        test_type: 'thumbnail',
        status: 'completed',
        started_at: '2026-04-01T00:00:00Z',
        completed_at: '2026-04-15T00:00:00Z',
        result_metadata: { ctr_lift_percent: 18.3 },
        winner: [{ label: 'C' }],
      },
    ]

    const sb = createMockSupabase({
      ab_tests: { data: testHistory, error: null },
    })

    const result = await getAbVideoHistory(makeCtx(sb), VIDEO_ID_1)

    const test = result.data.tests[0]!
    expect(test.winner).toBe('C')
    expect(test.liftPercent).toBe(18.3)
  })

  it('returns empty for video with no tests', async () => {
    const sb = createMockSupabase({
      ab_tests: { data: [], error: null },
    })

    const result = await getAbVideoHistory(makeCtx(sb), VIDEO_ID_1)

    expect(result.data.videoId).toBe(VIDEO_ID_1)
    expect(result.data.tests).toEqual([])
  })

  it('handles winner as null for non-completed tests', async () => {
    const testHistory = [
      {
        id: TEST_ID_1,
        test_type: 'thumbnail',
        status: 'active',
        started_at: '2026-05-01T00:00:00Z',
        completed_at: null,
        result_metadata: null,
        winner: null,
      },
    ]

    const sb = createMockSupabase({
      ab_tests: { data: testHistory, error: null },
    })

    const result = await getAbVideoHistory(makeCtx(sb), VIDEO_ID_1)

    const test = result.data.tests[0]!
    expect(test.winner).toBeNull()
    expect(test.liftPercent).toBeNull()
  })
})
