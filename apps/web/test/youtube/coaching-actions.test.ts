import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ─── Mock chain builders ───
 * Call order mirrors the query in actions.ts:
 * select → eq(site_id) → eq(channel_id) → is(video_id) → in(source)
 *        → not(coaching) → eq(type) → order → limit
 *
 * `.limit()` is now the awaited terminal (it was `.maybeSingle()` before the fix): the read
 * returns the whole channel-level history — at most one row per allowlisted source, by the
 * UNIQUE idx_youtube_intelligence_channel_dedup — so the banner and the cards can come from
 * different rows.
 */

const mockLimit = vi.fn()
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

const PRIORITIES = AXES.map((axis, i) => ({ axis, score: i, diagnosis: `d${i}`, action: `a${i}` }))

/** The row the forja writes by design: a summary, and no priorities at all. */
const FORJA_ROW = {
  coaching: { summary: 'resumo da forja', priorities: [] },
  source: 'forja',
  generated_at: '2026-09-22T20:10:42Z',
}
/** The Cowork analysis of May: six priorities, which the screen turns into three cards. */
const COWORK_ROW = {
  coaching: { summary: 'analise de maio', priorities: PRIORITIES },
  source: 'cowork',
  generated_at: '2026-05-18T13:34:10Z',
}

describe('fetchChannelCoaching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries the cowork+forja allowlist, scoped by site and channel, newest first', async () => {
    mockLimit.mockResolvedValueOnce({ data: [FORJA_ROW], error: null })
    const result = await fetchChannelCoaching(VALID_CHANNEL)
    expect(result).toEqual({
      coaching: FORJA_ROW.coaching, source: 'forja', generatedLabel: '22/09', cards: null,
    })
    expect(mockEqSite).toHaveBeenCalledWith('site_id', 'site-1')
    expect(mockEqChannel).toHaveBeenCalledWith('channel_id', VALID_CHANNEL)
    expect(mockIs).toHaveBeenCalledWith('video_id', null)
    expect(mockIn).toHaveBeenCalledWith('source', ['cowork', 'forja'])
    expect(mockNot).toHaveBeenCalledWith('coaching', 'is', null)
    expect(mockEqType).toHaveBeenCalledWith('type', 'channel')
    expect(mockOrder).toHaveBeenCalledWith('generated_at', { ascending: false })
  })

  it('asks for the whole channel-level history, not a single row — one row per allowlisted source', async () => {
    // The regression was `.limit(1)`: the forja row buried the Cowork analysis the second it
    // landed. The bound is not a guess — idx_youtube_intelligence_channel_dedup is UNIQUE on
    // (site_id, channel_id, source) WHERE video_id IS NULL, so two sources mean two rows max.
    mockLimit.mockResolvedValueOnce({ data: [FORJA_ROW, COWORK_ROW], error: null })
    await fetchChannelCoaching(VALID_CHANNEL)
    expect(mockLimit).toHaveBeenCalledWith(2)
  })

  it(
    'THE REGRESSION: a new forja row with priorities:[] over an older cowork row with ' +
      'priorities — the banner is the forja, the cards stay the cowork analysis',
    async () => {
      mockLimit.mockResolvedValueOnce({ data: [FORJA_ROW, COWORK_ROW], error: null })
      const result = await fetchChannelCoaching(VALID_CHANNEL)

      // Banner: today's forja summary, badged as forja.
      expect(result!.source).toBe('forja')
      expect(result!.generatedLabel).toBe('22/09')
      expect(result!.coaching.summary).toBe('resumo da forja')

      // Cards: the May analysis, with its own date label — not buried, not relabelled.
      expect(result!.cards).not.toBeNull()
      expect(result!.cards!.source).toBe('cowork')
      expect(result!.cards!.generatedLabel).toBe('18/05')
      expect(result!.cards!.coaching.priorities).toHaveLength(6)
    },
  )

  it('same row: the newest row already carries the priorities — `cards` stays null, nothing duplicates', async () => {
    mockLimit.mockResolvedValueOnce({ data: [COWORK_ROW], error: null })
    const result = await fetchChannelCoaching(VALID_CHANNEL)
    expect(result!.source).toBe('cowork')
    expect(result!.coaching.priorities).toHaveLength(6)
    expect(result!.cards).toBeNull()
  })

  it('no row anywhere carries priorities: `cards` is null and the screen keeps today\'s behaviour', async () => {
    mockLimit.mockResolvedValueOnce({
      data: [FORJA_ROW, { ...COWORK_ROW, coaching: { summary: 'cowork vazio', priorities: [] } }],
      error: null,
    })
    const result = await fetchChannelCoaching(VALID_CHANNEL)
    expect(result!.source).toBe('forja')
    expect(result!.cards).toBeNull()
  })

  it('a legacy row without a priorities key is not mistaken for one that has cards', async () => {
    // jsonb, not TypeScript: `priorities` can be absent on a row written before the schema.
    mockLimit.mockResolvedValueOnce({
      data: [FORJA_ROW, { ...COWORK_ROW, coaching: { summary: 'sem chave' } }],
      error: null,
    })
    expect((await fetchChannelCoaching(VALID_CHANNEL))!.cards).toBeNull()
  })

  it('raises instead of reporting "no analysis" when the read fails', async () => {
    // A statement timeout used to be indistinguishable from a channel that was never
    // analysed: `const { data }` with no error check, and the heuristic diagnosis rendered
    // as if it were the whole truth. Same rule the rest of this phase closed in 02b4d7f9.
    mockLimit.mockResolvedValueOnce({
      data: null,
      error: { message: 'canceling statement due to statement timeout' },
    })
    await expect(fetchChannelCoaching(VALID_CHANNEL)).rejects.toThrow(
      /Failed to read the channel coaching rows/,
    )
  })

  /*
   * What a forja_retirada_* row really does in production is NOT tested here, on purpose:
   * the row never reaches this code, because `.in('source', COACHING_SOURCES)` excludes it
   * in the database — the UI then falls back to the next allowlisted row (the dedup index
   * allows one cowork + one forja row per channel) or to the heuristic branch. That is
   * proven against a real PostgREST `.in()` in test/integration/youtube-intelligence-forja
   * .test.ts, case 7 ('a forja_retirada_* row is excluded by the source allowlist even when
   * it is the newest row'), and the heuristic half in
   * test/youtube/yt-analytics-tabs-coach.test.tsx, case C ('no row falls back to the
   * heuristic label').
   *
   * This double hand-wires every link of the chain, so it cannot model a filter at all: it
   * can only prove the filter is REQUESTED (the `.in()` assertion above) and that the
   * narrowing is fail-closed if that filter ever regresses — which is what the case below
   * asserts, with a deliberately out-of-contract row the real query could not return.
   */
  it('drops a row whose source is outside the allowlist instead of badging it as cowork ' +
    '(defense in depth — the query already excludes it)', async () => {
    mockLimit.mockResolvedValueOnce({
      data: [{ ...FORJA_ROW, source: 'forja_retirada_202609181200' }],
      error: null,
    })
    expect(await fetchChannelCoaching(VALID_CHANNEL)).toBeNull()
  })

  it('formats generatedLabel in Sao Paulo time — 01:30Z is the previous day', async () => {
    mockLimit.mockResolvedValueOnce({
      data: [{ ...FORJA_ROW, source: 'cowork', generated_at: '2026-09-19T01:30:00Z' }],
      error: null,
    })
    expect((await fetchChannelCoaching(VALID_CHANNEL))!.generatedLabel).toBe('18/09')
  })

  it('returns the channel coaching row when it exists', async () => {
    mockLimit.mockResolvedValueOnce({
      data: [{
        coaching: {
          summary: 'Canal em boa forma geral',
          priorities: [
            { axis: 'ctr', score: 4, diagnosis: 'CTR baixo', action: 'Testar thumbnails' },
          ],
        },
        source: 'cowork',
        generated_at: '2026-08-01T12:00:00Z',
      }],
      error: null,
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
      cards: null,
    })
  })

  it('returns null when no channel coaching row exists', async () => {
    mockLimit.mockResolvedValueOnce({ data: [], error: null })

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

  it('a summary-only newest analysis still gets its cards from the older one that has them', () => {
    const videos = [videoWithAllAxesAt(0)]
    const forja = { summary: 'resumo da forja', priorities: [] }
    const cowork = {
      summary: 'analise de maio',
      priorities: AXES.map((axis, i) => ({ axis, score: i, diagnosis: `d${i}`, action: `a${i}` })),
    }
    const cards = computeCoachingCards(videos, forja, cowork)
    expect(cards).toHaveLength(3)
    expect(cards.map(c => c.diagnosis)).toEqual(['d0', 'd1', 'd2'])
    // Still never the heuristic: a real analysis exists, so no invented card slips in.
    expect(cards.every(c => c.source === 'cowork')).toBe(true)
  })
})
