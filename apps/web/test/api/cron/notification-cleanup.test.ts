/**
 * Tests for POST /api/cron/notification-cleanup — IRREVERSIBLE delete cron.
 *
 * The route delegates to lib/notifications/cron/cleanup#processCleanup, which:
 *   1. Soft-expires notifications: set expired_at WHERE expired_at IS NULL
 *      AND created_at < now-90d.
 *   2. HARD-DELETES notifications WHERE expired_at IS NOT NULL
 *      AND expired_at < now-90d.
 *
 * We test BOTH the route (auth gate + happy path) and processCleanup directly
 * (the cutoff filters live there — that's where a wrong window would silently
 * delete the wrong rows).
 *
 * Pure mock (no DB). The route uses the real withCronLock → cron_try_lock/unlock
 * RPCs on the mocked supabase client.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { POST } from '../../../src/app/api/cron/notification-cleanup/route'
import { processCleanup } from '@/lib/notifications/cron/cleanup'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { setLogger, resetLogger } from '../../../lib/logger'

interface CleanupCapture {
  updateIsCol: string | null
  updateLtCol: string | null
  updateLtVal: string | null
  deleteNotArgs: [string, string, unknown] | null
  deleteLtCol: string | null
  deleteLtVal: string | null
}

/**
 * Supabase mock that captures the filter chain used by processCleanup.
 *   update: .update(...).is('expired_at', null).lt('created_at', cutoff)
 *   delete: .delete(...).not('expired_at','is',null).lt('expired_at', cutoff)
 * Both terminal builders resolve to { count }.
 */
function makeSupabase(opts: { expired?: number; deleted?: number } = {}) {
  const capture: CleanupCapture = {
    updateIsCol: null,
    updateLtCol: null,
    updateLtVal: null,
    deleteNotArgs: null,
    deleteLtCol: null,
    deleteLtVal: null,
  }
  const expired = opts.expired ?? 4
  const deleted = opts.deleted ?? 2

  const fromMock = vi.fn((table: string) => {
    if (table !== 'notifications') return {}
    return {
      update: vi.fn(() => ({
        is: vi.fn((col: string) => {
          capture.updateIsCol = col
          return {
            lt: vi.fn((c: string, v: string) => {
              capture.updateLtCol = c
              capture.updateLtVal = v
              return Promise.resolve({ count: expired, error: null })
            }),
          }
        }),
      })),
      delete: vi.fn(() => ({
        not: vi.fn((col: string, op: string, val: unknown) => {
          capture.deleteNotArgs = [col, op, val]
          return {
            lt: vi.fn((c: string, v: string) => {
              capture.deleteLtCol = c
              capture.deleteLtVal = v
              return Promise.resolve({ count: deleted, error: null })
            }),
          }
        }),
      })),
    }
  })

  // withCronLock needs cron_try_lock/cron_unlock on the same client.
  const rpcMock = vi.fn((name: string) => {
    if (name === 'cron_try_lock') return Promise.resolve({ data: true, error: null })
    if (name === 'cron_unlock') return Promise.resolve({ data: null, error: null })
    return Promise.resolve({ data: null, error: null })
  })

  return { from: fromMock, rpc: rpcMock, _capture: capture }
}

function req(secret?: string) {
  return new Request('http://localhost/api/cron/notification-cleanup', {
    method: 'POST',
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

describe('POST /api/cron/notification-cleanup — auth gate', () => {
  it('401 without Authorization header', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('unauthorized')
  })

  it('401 with wrong secret', async () => {
    const res = await POST(req('wrong'))
    expect(res.status).toBe(401)
  })

  it('401 when CRON_SECRET unset (fail-closed)', async () => {
    delete process.env.CRON_SECRET
    const res = await POST(req('Bearer x'))
    expect(res.status).toBe(401)
    process.env.CRON_SECRET = CRON_SECRET
  })
})

describe('POST /api/cron/notification-cleanup — happy path', () => {
  it('returns 200 with expired + deleted counts', async () => {
    const supabase = makeSupabase({ expired: 7, deleted: 3 })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.expired).toBe(7)
    expect(body.deleted).toBe(3)
  })
})

describe('processCleanup — cutoff safety (90-day retention)', () => {
  it('soft-expire targets expired_at IS NULL and created_at < now-90d', async () => {
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const before = Date.now()
    await processCleanup()
    const after = Date.now()

    expect(supabase._capture.updateIsCol).toBe('expired_at')
    expect(supabase._capture.updateLtCol).toBe('created_at')

    const NINETY = 90 * 24 * 60 * 60 * 1000
    const cutoff = new Date(supabase._capture.updateLtVal as string).getTime()
    expect(cutoff).toBeLessThanOrEqual(after - NINETY + 1000)
    expect(cutoff).toBeGreaterThanOrEqual(before - NINETY - 5000)
  })

  it('hard-delete targets expired_at IS NOT NULL and expired_at < now-90d', async () => {
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const before = Date.now()
    await processCleanup()
    const after = Date.now()

    // Only already-expired rows are deletable — never live/un-expired ones.
    expect(supabase._capture.deleteNotArgs).toEqual(['expired_at', 'is', null])
    expect(supabase._capture.deleteLtCol).toBe('expired_at')

    const NINETY = 90 * 24 * 60 * 60 * 1000
    const cutoff = new Date(supabase._capture.deleteLtVal as string).getTime()
    expect(cutoff).toBeLessThanOrEqual(after - NINETY + 1000)
    expect(cutoff).toBeGreaterThanOrEqual(before - NINETY - 5000)
  })

  it('returns zeros when supabase reports null counts (no rows matched)', async () => {
    const supabase = makeSupabase({ expired: 0, deleted: 0 })
    // Force null counts to exercise the ?? 0 fallback.
    supabase.from = vi.fn((table: string) => {
      if (table !== 'notifications') return {} as never
      return {
        update: () => ({ is: () => ({ lt: () => Promise.resolve({ count: null }) }) }),
        delete: () => ({ not: () => ({ lt: () => Promise.resolve({ count: null }) }) }),
      } as never
    }) as never
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const result = await processCleanup()
    expect(result).toEqual({ expired: 0, deleted: 0 })
  })
})
