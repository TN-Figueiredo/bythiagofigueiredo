import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ─── Mock chain builders ───
 * Call order mirrors ONE of the per-source queries in actions.ts:
 * select → eq(site_id) → eq(channel_id) → is(video_id) → eq(source)
 *        → not(coaching) → eq(type) → order → limit(1)
 *
 * The read is now COACHING_SOURCES.length queries, not one: migration 20260922000001
 * dropped the UNIQUE from idx_youtube_intelligence_channel_dedup so the channel analysis
 * accumulates a history, and "at most one row per source" — the invariant that made a single
 * `.limit(2)` exhaustive — is gone. Each source is asked for its own newest row instead.
 *
 * The chain is rebuilt per call (not a set of shared vi.fn()s) precisely so the two queries
 * can be told apart and asserted independently. There is deliberately NO `.in()` on it: if
 * the code ever regresses to the single allowlist read, the chain throws instead of quietly
 * passing.
 */

interface QueryResult { data: unknown[] | null; error: { message: string } | null }

/** Results handed to the reads in call order — reads run in COACHING_SOURCES order. */
const queued: QueryResult[] = []
/** One record per query issued, in call order: what was filtered, ordered and limited. */
const issued: Array<Record<string, unknown>> = []

function queue(...results: QueryResult[]): void {
  queued.length = 0
  queued.push(...results)
}

/** A single source's read, with just the links actions.ts is allowed to use. */
function makeChain(): Record<string, unknown> {
  const rec: Record<string, unknown> = {}
  issued.push(rec)
  const chain = {
    eq: vi.fn((col: string, val: unknown) => { rec[`eq:${col}`] = val; return chain }),
    is: vi.fn((col: string, val: unknown) => { rec[`is:${col}`] = val; return chain }),
    not: vi.fn((col: string, op: string, val: unknown) => { rec[`not:${col}`] = [op, val]; return chain }),
    order: vi.fn((col: string, opts: unknown) => { rec.order = [col, opts]; return chain }),
    limit: vi.fn((n: number) => {
      rec.limit = n
      return Promise.resolve(queued.shift() ?? { data: [], error: null })
    }),
    select: vi.fn(() => chain),
  }
  return chain as unknown as Record<string, unknown>
}

const mockFrom = vi.fn((table: string) => {
  if (table === 'youtube_intelligence') {
    return { select: vi.fn(() => makeChain()) }
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

/** Shorthand: a successful read that returned `rows`. */
function ok(...rows: unknown[]): QueryResult { return { data: rows, error: null } }
/** Shorthand: the source was asked for and had nothing. */
const none: QueryResult = { data: [], error: null }

describe('fetchChannelCoaching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queued.length = 0
    issued.length = 0
  })

  it('asks each allowlisted source for its own newest row, scoped by site and channel', async () => {
    queue(none, ok(FORJA_ROW))
    const result = await fetchChannelCoaching(VALID_CHANNEL)
    expect(result).toEqual({
      coaching: FORJA_ROW.coaching, source: 'forja', generatedLabel: '22/09', cards: null,
    })

    // Two reads, one per allowlisted source — not one read over both.
    expect(issued).toHaveLength(2)
    expect(issued.map(q => q['eq:source'])).toEqual(['cowork', 'forja'])

    for (const q of issued) {
      expect(q['eq:site_id']).toBe('site-1')
      expect(q['eq:channel_id']).toBe(VALID_CHANNEL)
      expect(q['is:video_id']).toBeNull()
      expect(q['not:coaching']).toEqual(['is', null])
      expect(q['eq:type']).toBe('channel')
      expect(q.order).toEqual(['generated_at', { ascending: false }])
    }
  })

  it(
    'asks each source for exactly ONE row — history killed the old `.limit(2)` over both sources',
    async () => {
      // Before migration 20260922000001 the channel index was UNIQUE on
      // (site_id, channel_id, source) WHERE video_id IS NULL, so `.limit(COACHING_SOURCES
      // .length)` over both sources was exhaustive. With a history that bound becomes "the two
      // newest rows overall": after two forja runs it returns two forja rows and buries the
      // Cowork analysis. `.limit(1)` PER SOURCE is exhaustive again, and stays exhaustive.
      queue(ok(COWORK_ROW), ok(FORJA_ROW))
      await fetchChannelCoaching(VALID_CHANNEL)
      expect(issued.map(q => q.limit)).toEqual([1, 1])
    },
  )

  it(
    'HISTORY: the second run of a source does not bury the other source — the newest row of ' +
      'each is what competes, no matter how many older rows sit behind them',
    async () => {
      // The DB returns one row per source because each read is `.limit(1)` on
      // `generated_at DESC`. What this proves is the MERGE: the two per-source answers come
      // back in allowlist order (cowork first), and the result must still be recency-ordered.
      queue(ok(COWORK_ROW), ok(FORJA_ROW))
      const result = await fetchChannelCoaching(VALID_CHANNEL)
      expect(result!.source).toBe('forja')
      expect(result!.generatedLabel).toBe('22/09')
      expect(result!.cards!.source).toBe('cowork')
    },
  )

  it(
    'merges by recency, not by allowlist position — the cowork row wins when it is the newer one',
    async () => {
      // The mirror of the case above: if the merge ever degrades into "first source wins" or
      // "last source wins", one of these two tests goes red. Both directions, one invariant.
      queue(
        ok({ ...COWORK_ROW, generated_at: '2026-09-22T20:10:42Z' }),
        ok({ ...FORJA_ROW, generated_at: '2026-05-18T13:34:10Z' }),
      )
      const result = await fetchChannelCoaching(VALID_CHANNEL)
      expect(result!.source).toBe('cowork')
      expect(result!.generatedLabel).toBe('22/09')
    },
  )

  it(
    'THE REGRESSION: a new forja row with priorities:[] over an older cowork row with ' +
      'priorities — the banner is the forja, the cards stay the cowork analysis',
    async () => {
      queue(ok(COWORK_ROW), ok(FORJA_ROW))
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
    queue(ok(COWORK_ROW), none)
    const result = await fetchChannelCoaching(VALID_CHANNEL)
    expect(result!.source).toBe('cowork')
    expect(result!.coaching.priorities).toHaveLength(6)
    expect(result!.cards).toBeNull()
  })

  it('no row anywhere carries priorities: `cards` is null and the screen keeps today\'s behaviour', async () => {
    queue(ok({ ...COWORK_ROW, coaching: { summary: 'cowork vazio', priorities: [] } }), ok(FORJA_ROW))
    const result = await fetchChannelCoaching(VALID_CHANNEL)
    expect(result!.source).toBe('forja')
    expect(result!.cards).toBeNull()
  })

  it('a legacy row without a priorities key is not mistaken for one that has cards', async () => {
    // jsonb, not TypeScript: `priorities` can be absent on a row written before the schema.
    queue(ok({ ...COWORK_ROW, coaching: { summary: 'sem chave' } }), ok(FORJA_ROW))
    expect((await fetchChannelCoaching(VALID_CHANNEL))!.cards).toBeNull()
  })

  it('raises instead of reporting "no analysis" when a read fails', async () => {
    // A statement timeout used to be indistinguishable from a channel that was never
    // analysed: `const { data }` with no error check, and the heuristic diagnosis rendered
    // as if it were the whole truth. Same rule the rest of this phase closed in 02b4d7f9.
    queue({ data: null, error: { message: 'canceling statement due to statement timeout' } }, none)
    await expect(fetchChannelCoaching(VALID_CHANNEL)).rejects.toThrow(
      /Failed to read the channel coaching rows/,
    )
  })

  it(
    'one source failing is enough to raise — a partial answer would promote the survivor to ' +
      '"the newest analysis"',
    async () => {
      // Split reads bought a failure mode the single read did not have: if only the forja
      // query times out, the cowork row is still there and looks like a complete answer.
      queue(ok(COWORK_ROW), { data: null, error: { message: 'timeout' } })
      await expect(fetchChannelCoaching(VALID_CHANNEL)).rejects.toThrow(
        /Failed to read the channel coaching rows/,
      )
    },
  )

  /*
   * What a forja_retirada_* row really does in production is NOT tested here, on purpose:
   * the row never reaches this code, because each read is `.eq('source', <allowlisted>)` and
   * no query asks for it — the UI then falls back to the other allowlisted source or to the
   * heuristic branch. That is proven against a real PostgREST in
   * test/integration/youtube-intelligence-forja.test.ts ('a forja_retirada_* row is excluded
   * by the source allowlist even when it is the newest row'), and the heuristic half in
   * test/youtube/yt-analytics-tabs-coach.test.tsx, case C.
   *
   * This double hand-wires every link of the chain, so it cannot model a filter at all: it
   * can only prove the filter is REQUESTED (the `eq:source` assertions above) and that the
   * narrowing is fail-closed if those filters ever regress — which is what the case below
   * asserts, with a deliberately out-of-contract row the real query could not return.
   */
  it('drops a row whose source is outside the allowlist instead of badging it as cowork ' +
    '(defense in depth — the query already excludes it)', async () => {
    queue(none, ok({ ...FORJA_ROW, source: 'forja_retirada_202609181200' }))
    expect(await fetchChannelCoaching(VALID_CHANNEL)).toBeNull()
  })

  it('formats generatedLabel in Sao Paulo time — 01:30Z is the previous day', async () => {
    queue(ok({ ...FORJA_ROW, source: 'cowork', generated_at: '2026-09-19T01:30:00Z' }), none)
    expect((await fetchChannelCoaching(VALID_CHANNEL))!.generatedLabel).toBe('18/09')
  })

  it('returns the channel coaching row when it exists', async () => {
    queue(ok({
      coaching: {
        summary: 'Canal em boa forma geral',
        priorities: [
          { axis: 'ctr', score: 4, diagnosis: 'CTR baixo', action: 'Testar thumbnails' },
        ],
      },
      source: 'cowork',
      generated_at: '2026-08-01T12:00:00Z',
    }), none)

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
    queue(none, none)

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
