/**
 * Tests for POST /api/cron/snapshot-cleanup — IRREVERSIBLE delete cron.
 *
 * Destructive operations, unsupervised:
 *   1. DELETE playlist_snapshots where expires_at < now (and expires_at IS NOT NULL).
 *   2. Per-playlist overcap pruning via RPC cleanup_excess_auto_snapshots(p_max=100).
 *
 * Safety-critical invariants under test:
 *   - auth gate (401 without/with bad bearer)
 *   - happy path sums deleted = expired.length + overcap count
 *   - the delete is filtered by `expires_at < now` AND `expires_at IS NOT NULL`
 *     — a snapshot with NULL expires_at (a permanent/manual snapshot) must NOT
 *     be eligible, and the cutoff is "now", never the future.
 *
 * Pure mock (no DB). Route uses next/server NextRequest/NextResponse.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { POST } from '../../../src/app/api/cron/snapshot-cleanup/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

interface DeleteCapture {
  ltColumn: string | null
  ltValue: string | null
  notArgs: [string, string, unknown] | null
}

function makeSupabase(opts: {
  expired?: { id: string }[]
  overcap?: number
} = {}) {
  const capture: DeleteCapture = { ltColumn: null, ltValue: null, notArgs: null }
  const expired = opts.expired ?? [{ id: 's1' }, { id: 's2' }]
  const overcap = opts.overcap ?? 3

  const fromMock = vi.fn((table: string) => {
    if (table === 'playlist_snapshots') {
      // .delete().lt('expires_at', now).not('expires_at','is',null).select('id')
      const chain = {
        delete: vi.fn(() => chain),
        lt: vi.fn((col: string, val: string) => {
          capture.ltColumn = col
          capture.ltValue = val
          return chain
        }),
        not: vi.fn((col: string, op: string, val: unknown) => {
          capture.notArgs = [col, op, val]
          return chain
        }),
        select: vi.fn(() => Promise.resolve({ data: expired, error: null })),
      }
      return chain
    }
    return {}
  })

  const rpcMock = vi.fn((name: string) => {
    if (name === 'cleanup_excess_auto_snapshots') {
      return Promise.resolve({ data: overcap, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })

  return { from: fromMock, rpc: rpcMock, _capture: capture }
}

function req(secret?: string) {
  return new Request('http://localhost/api/cron/snapshot-cleanup', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  }) as never
}

beforeEach(() => {
  process.env.CRON_SECRET = CRON_SECRET
  vi.clearAllMocks()
})

describe('POST /api/cron/snapshot-cleanup — auth gate', () => {
  it('401 without Authorization header', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
  })

  it('401 with wrong secret', async () => {
    const res = await POST(req('wrong'))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/cron/snapshot-cleanup — happy path', () => {
  it('returns 200 with deleted = expired count + overcap count', async () => {
    const supabase = makeSupabase({ expired: [{ id: 'a' }, { id: 'b' }], overcap: 5 })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.deleted).toBe(7) // 2 expired + 5 overcap
  })

  it('passes p_max_per_playlist=100 to the overcap RPC', async () => {
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    await POST(req(CRON_SECRET))
    expect(supabase.rpc).toHaveBeenCalledWith('cleanup_excess_auto_snapshots', {
      p_max_per_playlist: 100,
    })
  })
})

describe('POST /api/cron/snapshot-cleanup — cutoff safety', () => {
  it('deletes only rows whose expires_at < now AND expires_at IS NOT NULL', async () => {
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const before = Date.now()
    await POST(req(CRON_SECRET))
    const after = Date.now()

    // The delete is filtered by expires_at, never an unfiltered table wipe.
    expect(supabase._capture.ltColumn).toBe('expires_at')

    // The cutoff is "now" — not the future. Rows expiring later are excluded.
    const cutoffMs = new Date(supabase._capture.ltValue as string).getTime()
    expect(cutoffMs).toBeGreaterThanOrEqual(before - 1000)
    expect(cutoffMs).toBeLessThanOrEqual(after + 1000)

    // NULL expires_at (permanent snapshots) must be excluded via .not(...is...null).
    expect(supabase._capture.notArgs).toEqual(['expires_at', 'is', null])
  })

  it('reports deleted=0 when nothing is expired and overcap is null', async () => {
    const supabase = makeSupabase({ expired: [], overcap: 0 })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET))
    const body = await res.json()
    expect(body.deleted).toBe(0)
  })
})
