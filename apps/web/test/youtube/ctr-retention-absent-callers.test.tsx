// @vitest-environment jsdom
/**
 * CTR and retention are NOT measured — every caller must say so.
 *
 * Production on 2026-09-22: 0 of 35 videos on UCRHtzTwaEpcjspAS2hbqmrA had
 * `ctr`, `impressions`, `avg_view_percentage` or `traffic_sources`. The YouTube
 * Analytics API v2 does not serve impressions/CTR, and averageViewPercentage is
 * never requested. `scoreVideo` learned to take `null` (9571e94a), but five
 * callers kept passing `?? 0` — and with every channel median at 0 too, the
 * tier-shifted sigmoid turned that 0 into CTR ~63 and retention 99 for every
 * video. The "Visao geral" tab showed exactly that to the owner, and the API
 * the Cowork reads served it as data.
 *
 * Each describe below drives one caller with videos in the EXACT production
 * shape (the four columns NULL) and asserts two things: the caller hands
 * `null` to `scoreVideo` (spy), and the axis comes out as unavailable — never
 * as a number.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { VideoScoreInput } from '@/lib/youtube/scoring-types'

const { scoreInputs } = vi.hoisted(() => ({ scoreInputs: [] as VideoScoreInput[] }))

vi.mock('@/lib/youtube/scoring', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/youtube/scoring')>()
  return {
    ...actual,
    scoreVideo: (input: VideoScoreInput, baseline: Parameters<typeof actual.scoreVideo>[1]) => {
      scoreInputs.push(input)
      return actual.scoreVideo(input, baseline)
    },
  }
})

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: SITE }),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'u1' } }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/youtube/analytics-client', () => ({
  fetchYtSearchTerms: vi.fn().mockResolvedValue([]),
  fetchYtDemographics: vi.fn().mockResolvedValue({ ageGender: [], countries: [], devices: [] }),
}))

const tables: Record<string, unknown[]> = {}
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => stubSupabase(),
}))

const SITE = '11111111-1111-4111-8111-111111111111'
const CHANNEL = '22222222-2222-4222-8222-222222222222'
const V1 = '33333333-3333-4333-8333-333333333331'
const V2 = '33333333-3333-4333-8333-333333333332'
const V3 = '33333333-3333-4333-8333-333333333333'

/** Chainable, thenable Supabase stub: every filter returns the builder. */
function stubSupabase() {
  const make = (rows: unknown[]) => {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'not', 'is']) {
      builder[m] = () => builder
    }
    builder.single = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    builder.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve, reject)
    return builder
  }
  return { from: (table: string) => make(tables[table] ?? []) }
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString()
const dateAgo = (n: number) => daysAgo(n).slice(0, 10)

/** A video exactly as production stores it today: the four columns NULL. */
function prodVideo(id: string, ageDays: number, views: number) {
  return {
    id,
    youtube_video_id: `yt-${id.slice(-1)}`,
    title: `Video ${id.slice(-1)}`,
    thumbnail_url: null,
    published_at: daysAgo(ageDays),
    view_count: views,
    like_count: 3,
    comment_count: 1,
    channel_id: CHANNEL,
    ctr: null,
    impressions: null,
    avg_view_percentage: null,
    avg_view_duration_seconds: 120,
    retention_curve: null,
    traffic_sources: null,
  }
}

function seedProductionShape() {
  tables.youtube_channels = [{
    id: CHANNEL, channel_id: 'UCtest', name: 'Canal', subscriber_count: 1160,
    video_count: 3, last_synced_at: daysAgo(0),
  }]
  tables.youtube_videos = [prodVideo(V1, 40, 120), prodVideo(V2, 80, 60), prodVideo(V3, 200, 30)]
  // Only V1 and V2 have analytics rows (as in prod: 16 of 35 videos do).
  tables.youtube_video_analytics = [V1, V2].flatMap(vid =>
    [3, 2, 1].map(d => ({
      youtube_video_id: vid, date: dateAgo(d), views: 20, likes: 2, comments: 1, shares: 0,
      subscribers_gained: 1, impressions: 0,
    })),
  )
  tables.video_grade_history = []
  tables.optimization_cycles = []
  tables.youtube_intelligence = []
  tables.ab_tests = []
}

const ABSENT = ['ctr', 'retention', 'sub_impact'] as const

function expectNullPassedThrough() {
  expect(scoreInputs.length).toBeGreaterThan(0)
  for (const input of scoreInputs) {
    expect(input.ctr).toBeNull()
    expect(input.avgViewPercentage).toBeNull()
    expect(input.impressions).toBeNull()
  }
}

beforeEach(() => {
  scoreInputs.length = 0
  for (const k of Object.keys(tables)) delete tables[k]
  seedProductionShape()
})

// ─── 1. CMS "Visao geral" + Health Coach (analytics/actions.ts) ─────────────

describe('fetchGradesData — feeds the Visao geral tab and the Health Coach', () => {
  it('passes null and reports ctr/retention/sub_impact unavailable on every video', async () => {
    const { fetchGradesData } = await import('@/app/cms/(authed)/youtube/analytics/actions')
    const { videos } = await fetchGradesData(CHANNEL)

    expectNullPassedThrough()
    expect(videos).toHaveLength(3)
    for (const v of videos) {
      for (const axis of ABSENT) {
        expect(v.axes.find(a => a.axis === axis)).toBeUndefined()
        expect(v.unavailableAxes.map(u => u.axis)).toContain(axis)
      }
      expect(v.avgViewPercentage).toBeNull()
    }
    // V3 has no analytics row: engagement is unavailable, not 0.
    const v3 = videos.find(v => v.videoId === V3)!
    expect(v3.axes.find(a => a.axis === 'engagement')).toBeUndefined()
    expect(v3.unavailableAxes.map(u => u.axis)).toContain('engagement')
  })

  it('the radar and the unavailable list built from it show CTR/Retencao as unavailable, not 63/99', async () => {
    const { fetchGradesData } = await import('@/app/cms/(authed)/youtube/analytics/actions')
    const { computeRadarData, computeUnavailableAxes } = await import(
      '@/app/cms/(authed)/youtube/analytics/_components/yt-analytics-tabs'
    )
    const { videos } = await fetchGradesData(CHANNEL)

    const radar = computeRadarData(videos)
    expect(radar.map(r => r.label)).not.toContain('CTR')
    expect(radar.map(r => r.label)).not.toContain('Retenção')

    const unavailable = computeUnavailableAxes(videos)
    expect(unavailable.map(u => u.axis)).toEqual(['ctr', 'retention', 'growth', 'sub_impact'])
  })
})

// ─── 2. API the Cowork reads (pipeline/services/youtube.ts) ─────────────────

describe('getAnalyticsOverview — GET /api/pipeline/youtube/analytics/overview', () => {
  it('reports absence as null / unavailableAxes, never as 0', async () => {
    const { getAnalyticsOverview } = await import('@/lib/pipeline/services/youtube')
    const r = await getAnalyticsOverview({ supabase: stubSupabase(), siteId: SITE } as never, CHANNEL, 28)
    const data = r.data!

    expectNullPassedThrough()
    for (const axis of ABSENT) {
      expect(data.health.axes.find(a => a.axis === axis)).toBeUndefined()
      expect(data.health.unavailableAxes.map(u => u.axis)).toContain(axis)
    }
    expect(data.kpis.avgCtr).toBeNull()
    expect(data.kpis.avgRetention).toBeNull()
    expect(data.baseline.medianCtr).toBeNull()
    expect(data.baseline.medianRetention).toBeNull()
    // engagement is measured on V1/V2, so it is NOT channel-level unavailable.
    expect(data.health.axes.map(a => a.axis)).toContain('engagement')
    expect(data.health.unavailableAxes.map(u => u.axis)).not.toContain('engagement')
  })
})

describe('getAnalyticsGrades — GET /api/pipeline/youtube/analytics/grades', () => {
  it('passes null and serves ctr/retention as null', async () => {
    const { getAnalyticsGrades } = await import('@/lib/pipeline/services/youtube')
    const r = await getAnalyticsGrades({ supabase: stubSupabase(), siteId: SITE } as never, CHANNEL, 'score', 20)

    expectNullPassedThrough()
    for (const v of r.data!.videos) {
      expect(v.ctr).toBeNull()
      expect(v.retention).toBeNull()
    }
  })
})

describe('getVideoDetail — GET /api/pipeline/youtube/videos/{id}', () => {
  it('passes null and lists the missing axes with their reason', async () => {
    const { getVideoDetail } = await import('@/lib/pipeline/services/youtube')
    const r = await getVideoDetail({ supabase: stubSupabase(), siteId: SITE } as never, V1)
    const data = r.data!

    expectNullPassedThrough()
    for (const axis of ABSENT) {
      expect(data.axes.find(a => a.axis === axis)).toBeUndefined()
      expect(data.unavailableAxes.map(u => u.axis)).toContain(axis)
    }
  })
})

// ─── 3. Prompt context (youtube-prompt-actions.ts) ──────────────────────────

describe('fetchChannelHealthData — channel health prompt', () => {
  it('passes null, lists the axes as unavailable, and serves retention as null', async () => {
    const { fetchChannelHealthData } = await import('@/app/cms/(authed)/youtube/_actions/youtube-prompt-actions')
    const r = await fetchChannelHealthData(CHANNEL)
    if (!r.ok) throw new Error(r.error)

    expectNullPassedThrough()
    const health = r.data.healthScore!
    for (const axis of ABSENT) {
      expect(health.axes.find(a => a.axis === axis)).toBeUndefined()
      expect(health.unavailableAxes.map(u => u.axis)).toContain(axis)
    }
    for (const v of [...r.data.topVideos, ...r.data.bottomVideos]) {
      expect(v.retention).toBeNull()
    }
  })
})

describe('fetchVideoOptimizerData — video optimizer prompt', () => {
  it('passes null, lists the axes as unavailable, and serves the medians as null', async () => {
    const { fetchVideoOptimizerData } = await import('@/app/cms/(authed)/youtube/_actions/youtube-prompt-actions')
    const r = await fetchVideoOptimizerData(V1)
    if (!r.ok) throw new Error(r.error)

    expectNullPassedThrough()
    for (const axis of ABSENT) {
      expect(r.data.grade.axes.find(a => a.axis === axis)).toBeUndefined()
      expect(r.data.grade.unavailableAxes.map(u => u.axis)).toContain(axis)
    }
    expect(r.data.channelBaseline.medianCtr).toBeNull()
    expect(r.data.channelBaseline.medianRetention).toBeNull()
  })
})

// ─── 4. The screen ──────────────────────────────────────────────────────────

describe('the screen shows unavailable axes as unavailable', () => {
  const unavailable = [
    { label: 'CTR', note: 'a API do YouTube nao fornece CTR', reason: 'r1' },
    { label: 'Retenção', note: 'o sync nao coleta a % assistida', reason: 'r2' },
  ]
  const metrics = {
    views: 100, estimatedMinutesWatched: 50, averageViewDuration: 60, averageViewPercentage: 0,
    subscribersGained: 1, subscribersLost: 0, impressions: 0, impressionClickThroughRate: 0,
    likes: 1, comments: 0, shares: 0,
  }

  it('Visao geral: "indisponivel" rows, no number, and no two-spoke radar', async () => {
    const { YtOverview } = await import('@/app/cms/(authed)/youtube/analytics/_components/yt-overview')
    render(
      <YtOverview
        metrics={metrics as never}
        dailyMetrics={[]}
        intelligenceHealthScore={53}
        intelligenceRadar={[
          { label: 'Alcance', value: 52, grade: 'C' },
          { label: 'Engajamento', value: 56, grade: 'C' },
        ]}
        intelligenceUnavailable={unavailable}
      />,
    )
    const rows = screen.getAllByTestId('axis-unavailable')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.textContent).toContain('CTR')
    expect(rows[0]!.textContent).toContain('indisponivel')
    expect(rows[0]!.textContent).not.toMatch(/\d/)
    expect(screen.getByTestId('radar-insufficient').textContent).toContain('Alcance e Engajamento')
    expect(screen.getByText('2 de 4 eixos medidos')).toBeTruthy()
  })

  it('Visao geral without scored videos (fallback): CTR is "indisponivel", not an engagement proxy labelled CTR', async () => {
    // Channel-level metrics in production shape: impressions and CTR arrive as
    // 0 because the Analytics API v2 does not serve them. The fallback used to
    // fill the "CTR" row with (likes+comments)/views*500 = 25 here.
    const { YtOverview } = await import('@/app/cms/(authed)/youtube/analytics/_components/yt-overview')
    const { container } = render(
      <YtOverview
        metrics={{
          views: 1000, estimatedMinutesWatched: 3000, averageViewDuration: 120, averageViewPercentage: 40,
          subscribersGained: 10, subscribersLost: 0, impressions: 0, impressionClickThroughRate: 0,
          likes: 40, comments: 10, shares: 0,
        }}
        dailyMetrics={[]}
      />,
    )
    const rows = screen.getAllByTestId('axis-unavailable')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.textContent).toContain('CTR')
    expect(rows[0]!.textContent).toContain('indisponivel')
    expect(rows[0]!.textContent).not.toMatch(/\d/)
    const measured = Array.from(container.querySelectorAll('.hb-row:not([data-testid="axis-unavailable"]) .hb-label'))
      .map(el => el.textContent)
    expect(measured).not.toContain('CTR')
    expect(measured).toHaveLength(5)
    // (retencao 80 + watch 30 + frequencia 100 + engajamento 50 + crescimento 5) / 5 — CTR out of the mean
    expect(screen.getByRole('img', { name: 'Saude do canal: 53 de 100' })).toBeTruthy()
    expect(screen.getByText('5 de 6 eixos medidos')).toBeTruthy()
  })

  it('Health Coach: lists them as "sem dado", and "saudavel" only covers what was measured', async () => {
    const { YtHealthCoach } = await import('@/app/cms/(authed)/youtube/analytics/_components/yt-health-coach')
    render(
      <YtHealthCoach
        healthScore={53}
        radarData={[]}
        unavailableAxes={unavailable}
        coachingCards={[]}
        videoCount={3}
        lastAnalysisAt={null}
        coachingMeta={null}
        analysisState="idle"
      />,
    )
    const box = screen.getByTestId('coach-unavailable')
    expect(box.textContent).toContain('CTR')
    expect(box.textContent).toContain('Retenção')
    expect(screen.queryByText('Canal saudavel em todos os eixos')).toBeNull()
    expect(screen.getByText('Canal saudavel nos eixos medidos')).toBeTruthy()
  })
})
