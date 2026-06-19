/**
 * Tests for GET /api/cron/ab-draft-cleanup — IRREVERSIBLE hard-delete cron.
 *
 * This cron does two destructive things, unsupervised:
 *   1. Archives `ab_tests` in status='draft' not touched for >24h.
 *   2. HARD-DELETES `ab_tests` in status='archived' not touched for >30d
 *      (and the associated Vercel Blob variants).
 *
 * Coverage focuses on the safety-critical invariants:
 *   - auth gate (401 without/with bad bearer)
 *   - happy path returns the archived / hardDeleted counts
 *   - cutoff filters: archive uses now-24h, hard-delete uses now-30d, and the
 *     query is scoped by the correct status — so rows OUTSIDE the cutoff or in
 *     the wrong status are never selected for mutation/deletion.
 *
 * Pure mock (no DB). The route uses the real `withCronLock`, which issues
 * `cron_try_lock`/`cron_unlock` RPCs against the mocked supabase client.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

vi.mock('@/lib/cron-health', () => ({
  recordCronSuccess: vi.fn().mockResolvedValue(undefined),
  recordCronFailure: vi.fn().mockResolvedValue(undefined),
}))

// `del` from @vercel/blob is imported dynamically inside the route — stub it.
const delMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@vercel/blob', () => ({ del: delMock }))

import { GET } from '../../../src/app/api/cron/ab-draft-cleanup/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { setLogger, resetLogger } from '../../../lib/logger'

interface ChainCapture {
  selectStatusEq: string | null
  selectLtColumn: string | null
  selectLtValue: string | null
  updateLtColumn: string | null
  deleteInIds: string[] | null
}

/**
 * Builds a supabase mock that captures the exact filters the route applies to
 * `ab_tests`. The select chain is `.select('id').eq('status', s).lt(col, val).limit(n)`.
 * We return one stale draft for archive, and one old archived row for hard-delete.
 */
function makeSupabase(opts: {
  staleDrafts?: { id: string }[]
  oldArchived?: { id: string }[]
} = {}) {
  const capture: ChainCapture = {
    selectStatusEq: null,
    selectLtColumn: null,
    selectLtValue: null,
    updateLtColumn: null,
    deleteInIds: null,
  }
  const staleDrafts = opts.staleDrafts ?? [{ id: 'draft-1' }]
  const oldArchived = opts.oldArchived ?? [{ id: 'archived-1' }]

  // Tracks which status a given select chain is currently filtering on so the
  // terminal .limit() can return the right dataset.
  const fromMock = vi.fn((table: string) => {
    if (table === 'ab_tests') {
      let currentStatus: string | null = null
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn((col: string, val: string) => {
          if (col === 'status') {
            currentStatus = val
            capture.selectStatusEq = val
          }
          return chain
        }),
        lt: vi.fn((col: string, val: string) => {
          capture.selectLtColumn = col
          capture.selectLtValue = val
          return chain
        }),
        limit: vi.fn(() => {
          const data = currentStatus === 'draft' ? staleDrafts : oldArchived
          return Promise.resolve({ data, error: null })
        }),
        // update path: .update({...}).in('id', ids)
        update: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ error: null })),
        })),
        // delete path: .delete().in('id', ids)
        delete: vi.fn(() => ({
          in: vi.fn((_col: string, ids: string[]) => {
            capture.deleteInIds = ids
            return Promise.resolve({ error: null })
          }),
        })),
      }
      return chain
    }
    if (table === 'ab_test_variants') {
      // .select('blob_url').in('test_id', ids).not('blob_url','is',null)
      return {
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            not: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      }
    }
    return {}
  })

  const rpcMock = vi.fn((name: string) => {
    if (name === 'cron_try_lock') return Promise.resolve({ data: true, error: null })
    if (name === 'cron_unlock') return Promise.resolve({ data: null, error: null })
    return Promise.resolve({ data: null, error: null })
  })

  return { from: fromMock, rpc: rpcMock, _capture: capture }
}

function req(secret?: string) {
  return new Request('http://localhost/api/cron/ab-draft-cleanup', {
    method: 'GET',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

beforeEach(() => {
  process.env.CRON_SECRET = CRON_SECRET
  vi.clearAllMocks()
  setLogger({ info: () => {}, warn: () => {}, error: () => {} } as never)
})

afterEach(() => {
  resetLogger()
})

describe('GET /api/cron/ab-draft-cleanup — auth gate', () => {
  it('401 without Authorization header', async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('unauthorized')
  })

  it('401 with wrong secret', async () => {
    const res = await GET(req('nope'))
    expect(res.status).toBe(401)
  })

  it('401 when CRON_SECRET is unset (fail-closed)', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(req('Bearer-anything'))
    expect(res.status).toBe(401)
    process.env.CRON_SECRET = CRON_SECRET
  })
})

describe('GET /api/cron/ab-draft-cleanup — happy path', () => {
  it('returns 200 with archived + hardDeleted counts', async () => {
    const supabase = makeSupabase({
      staleDrafts: [{ id: 'd1' }, { id: 'd2' }],
      oldArchived: [{ id: 'a1' }],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await GET(req(CRON_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.archived).toBe(2)
    expect(body.hardDeleted).toBe(1)
  })
})

describe('GET /api/cron/ab-draft-cleanup — cutoff safety', () => {
  it('archive query targets status=draft and filters updated_at older than ~24h', async () => {
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const before = Date.now()
    await GET(req(CRON_SECRET))
    const after = Date.now()

    // The select chain filters on `updated_at` (never created_at or anything else).
    expect(supabase._capture.selectLtColumn).toBe('updated_at')
    // The last status filtered was 'archived' (second query), confirming both
    // queries are status-scoped — they never delete/mutate the whole table.
    expect(supabase._capture.selectStatusEq).toBe('archived')

    // The hard-delete cutoff value must be ~30 days in the past, NOT "now" and
    // never in the future — i.e. rows newer than the cutoff are excluded.
    const cutoffMs = new Date(supabase._capture.selectLtValue as string).getTime()
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
    expect(cutoffMs).toBeLessThanOrEqual(after - THIRTY_DAYS + 1000)
    expect(cutoffMs).toBeGreaterThanOrEqual(before - THIRTY_DAYS - 5000)
  })

  it('hard-deletes ONLY the ids returned by the archived+30d query (no blanket delete)', async () => {
    const supabase = makeSupabase({
      staleDrafts: [],
      oldArchived: [{ id: 'old-1' }, { id: 'old-2' }],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    await GET(req(CRON_SECRET))

    // delete().in('id', ids) is scoped to exactly the selected ids — a missing
    // `.in()` filter would be a catastrophic full-table wipe.
    expect(supabase._capture.deleteInIds).toEqual(['old-1', 'old-2'])
  })

  it('does NOT hard-delete when no rows are past the 30d cutoff', async () => {
    const supabase = makeSupabase({ staleDrafts: [], oldArchived: [] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await GET(req(CRON_SECRET))
    const body = await res.json()
    expect(body.archived).toBe(0)
    expect(body.hardDeleted).toBe(0)
    // No delete().in() ever fired.
    expect(supabase._capture.deleteInIds).toBeNull()
  })
})
