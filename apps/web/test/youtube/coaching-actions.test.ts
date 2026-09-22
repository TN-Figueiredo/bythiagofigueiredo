import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ─── Mock chain builders ───
 * Call order mirrors the query in actions.ts:
 * select → eq(site_id) → eq(channel_id) → is(video_id) → in(source)
 *        → not(coaching) → eq(type) → order → limit → maybeSingle
 */

const mockMaybeSingle = vi.fn()
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockOrder = vi.fn(() => ({ limit: mockLimit }))
const mockEqType = vi.fn(() => ({ order: mockOrder }))
const mockNot = vi.fn(() => ({ eq: mockEqType }))
const mockIn = vi.fn(() => ({ not: mockNot }))
const mockIs = vi.fn(() => ({ in: mockIn }))
const mockEqChannel = vi.fn(() => ({ is: mockIs }))
const mockEqSite = vi.fn(() => ({ eq: mockEqChannel }))
const mockSelect = vi.fn(() => ({ eq: mockEqSite }))

const mockFrom = vi.fn((table: string) => {
  if (table === 'youtube_intelligence') {
    return { select: mockSelect }
  }
  return { select: vi.fn(() => ({ eq: vi.fn() })) }
})

const mockSupabase = { from: mockFrom }

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({
    ok: true,
    user: { id: 'test-user-id' },
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSupabase,
}))

vi.mock('next/cache', () => ({
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// The Busca tab (imported transitively by yt-analytics-tabs) pulls createPipelineItem
// from a 'use server' module — same reason as test/youtube/yt-search-terms.test.tsx:17.
vi.mock('@/app/cms/(authed)/pipeline/actions', () => ({ createPipelineItem: vi.fn() }))

import { fetchChannelCoaching } from '../../src/app/cms/(authed)/youtube/analytics/actions'
import { computeCoachingCards } from '@/app/cms/(authed)/youtube/analytics/_components/yt-analytics-tabs'
import type { VideoGradeRow } from '@/app/cms/(authed)/youtube/analytics/_components/types'
import type { Axis } from '@/lib/youtube/scoring-types'

const VALID_CHANNEL = '00000000-0000-0000-0000-000000000002'

const AXES: Axis[] = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']

/** Every axis at 0 is below COACHING_BENCHMARK (6.5), so the heuristic branch yields 3 cards. */
function videoWithAllAxesAt(normalized: number): VideoGradeRow {
  return { axes: AXES.map(axis => ({ axis, normalized, raw: 0 })) } as unknown as VideoGradeRow
}

describe('fetchChannelCoaching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries the cowork+forja allowlist, scoped by site and channel, newest first', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { coaching: { summary: 's', priorities: [] }, source: 'forja', generated_at: '2026-09-18T13:34:00Z' },
    })
    const result = await fetchChannelCoaching(VALID_CHANNEL)
    expect(result).toEqual({ coaching: { summary: 's', priorities: [] }, source: 'forja', generatedLabel: '18/09' })
    expect(mockEqSite).toHaveBeenCalledWith('site_id', 'site-1')
    expect(mockEqChannel).toHaveBeenCalledWith('channel_id', VALID_CHANNEL)
    expect(mockIs).toHaveBeenCalledWith('video_id', null)
    expect(mockIn).toHaveBeenCalledWith('source', ['cowork', 'forja'])
    expect(mockNot).toHaveBeenCalledWith('coaching', 'is', null)
    expect(mockEqType).toHaveBeenCalledWith('type', 'channel')
    expect(mockOrder).toHaveBeenCalledWith('generated_at', { ascending: false })
  })

  it('narrows any other source to cowork — forja_retirada_* never gets the forja badge', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { coaching: { summary: 's', priorities: [] }, source: 'forja_retirada_202609181200', generated_at: '2026-09-18T13:34:00Z' },
    })
    expect((await fetchChannelCoaching(VALID_CHANNEL))!.source).toBe('cowork')
  })

  it('formats generatedLabel in Sao Paulo time — 01:30Z is the previous day', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { coaching: { summary: 's', priorities: [] }, source: 'cowork', generated_at: '2026-09-19T01:30:00Z' },
    })
    expect((await fetchChannelCoaching(VALID_CHANNEL))!.generatedLabel).toBe('18/09')
  })

  it('returns the channel coaching row when it exists', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        coaching: {
          summary: 'Canal em boa forma geral',
          priorities: [
            { axis: 'ctr', score: 4, diagnosis: 'CTR baixo', action: 'Testar thumbnails' },
          ],
        },
        source: 'cowork',
        generated_at: '2026-08-01T12:00:00Z',
      },
    })

    const result = await fetchChannelCoaching(VALID_CHANNEL)

    expect(result).toEqual({
      coaching: {
        summary: 'Canal em boa forma geral',
        priorities: [
          { axis: 'ctr', score: 4, diagnosis: 'CTR baixo', action: 'Testar thumbnails' },
        ],
      },
      source: 'cowork',
      generatedLabel: '01/08',
    })
  })

  it('returns null when no channel coaching row exists', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null })

    const result = await fetchChannelCoaching(VALID_CHANNEL)

    expect(result).toBeNull()
  })

  it('rejects invalid channelId (non-UUID)', async () => {
    await expect(fetchChannelCoaching('not-a-uuid')).rejects.toThrow('invalid_input')
  })
})

describe('computeCoachingCards', () => {
  it('returns no cards when a coaching row exists with empty priorities — no heuristic fallback', () => {
    const videos = [videoWithAllAxesAt(0)]
    expect(computeCoachingCards(videos, { summary: 's', priorities: [] })).toEqual([])
    expect(computeCoachingCards(videos, null)).toHaveLength(3)
  })

  it('tolerates a legacy row without a priorities key (jsonb, not TypeScript)', () => {
    expect(computeCoachingCards([videoWithAllAxesAt(0)], { summary: 's' } as never)).toEqual([])
  })
})
