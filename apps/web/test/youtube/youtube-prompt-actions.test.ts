// @vitest-environment node
/**
 * As actions de prompt do YouTube passam ao analytics o id "UC…" do canal
 * (`social_connections.account_id`), nunca o uuid de `youtube_channels.id`.
 * Com o uuid o filtro nunca casava e os prompts saíam sem termos de busca e
 * sem demografia.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const SITE = '11111111-1111-4111-8111-111111111111'
const CH_UUID = '22222222-2222-4222-8222-222222222222'
const CH_UC = 'UCabcdefghijklmnopqrstuv'
const V1 = '33333333-3333-4333-8333-333333333331'

const { searchTerms, demographics } = vi.hoisted(() => ({
  searchTerms: vi.fn(),
  demographics: vi.fn(),
}))

vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: SITE }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'u1' } }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/youtube/analytics-client', () => ({
  fetchYtSearchTerms: searchTerms,
  fetchYtDemographics: demographics,
}))

const tables: Record<string, unknown[]> = {}
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => stub() }))

function stub() {
  const make = (rows: unknown[]) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'not', 'is']) b[m] = () => b
    b.single = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    b.maybeSingle = b.single
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(res, rej)
    return b
  }
  return { from: (t: string) => make(tables[t] ?? []) }
}

function seed(channelId: string | null) {
  tables.youtube_channels = [
    { id: CH_UUID, channel_id: channelId, name: 'Canal', subscriber_count: 1000, video_count: 1, last_synced_at: new Date().toISOString() },
  ]
  tables.youtube_videos = [
    {
      id: V1, youtube_video_id: 'yt1', title: 'V', thumbnail_url: null, published_at: new Date().toISOString(),
      view_count: 10, like_count: 1, comment_count: 0, channel_id: CH_UUID, ctr: null, impressions: null,
      avg_view_percentage: null, avg_view_duration_seconds: 10, retention_curve: null, traffic_sources: null,
    },
  ]
  for (const t of ['youtube_categories', 'youtube_video_analytics', 'video_grade_history', 'optimization_cycles', 'youtube_intelligence', 'ab_tests']) tables[t] = []
}

beforeEach(() => {
  vi.clearAllMocks()
  searchTerms.mockResolvedValue([])
  demographics.mockResolvedValue({ ageGender: [], countries: [], devices: [] })
  for (const k of Object.keys(tables)) delete tables[k]
})

describe('prompts do YouTube: o analytics recebe o id UC do canal', () => {
  it('fetchContentCalendarData', async () => {
    seed(CH_UC)
    const { fetchContentCalendarData } = await import('@/app/cms/(authed)/youtube/_actions/youtube-prompt-actions')
    const r = await fetchContentCalendarData(CH_UUID)
    expect(r.ok).toBe(true)
    expect(searchTerms).toHaveBeenCalledWith(SITE, 28, CH_UC)
    expect(demographics).toHaveBeenCalledWith(SITE, 28, CH_UC)
    expect(searchTerms).not.toHaveBeenCalledWith(SITE, 28, CH_UUID)
  })

  it('fetchChannelHealthData', async () => {
    seed(CH_UC)
    const { fetchChannelHealthData } = await import('@/app/cms/(authed)/youtube/_actions/youtube-prompt-actions')
    const r = await fetchChannelHealthData(CH_UUID)
    expect(r.ok).toBe(true)
    expect(searchTerms).toHaveBeenCalledWith(SITE, 28, CH_UC)
    expect(demographics).toHaveBeenCalledWith(SITE, 28, CH_UC)
    expect(searchTerms).not.toHaveBeenCalledWith(SITE, 28, CH_UUID)
  })

  it('o dado não existe: canal sem channel_id → "No sync-enabled channel found", sem chamar o analytics', async () => {
    seed(null)
    const a = await import('@/app/cms/(authed)/youtube/_actions/youtube-prompt-actions')
    expect(await a.fetchContentCalendarData(CH_UUID)).toEqual({ ok: false, error: 'No sync-enabled channel found' })
    expect(await a.fetchChannelHealthData(CH_UUID)).toEqual({ ok: false, error: 'No sync-enabled channel found' })
    expect(searchTerms).not.toHaveBeenCalled()
    expect(demographics).not.toHaveBeenCalled()
  })
})
