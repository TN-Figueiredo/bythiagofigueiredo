/**
 * Tests for POST /api/cron/notification-unsnooze — reactivates snoozed
 * notifications whose snooze window has elapsed.
 *
 * The route delegates to lib/notifications/cron/unsnooze#processUnsnooze:
 *   UPDATE notifications SET snoozed_until = NULL
 *   WHERE snoozed_until IS NOT NULL AND snoozed_until <= now
 *   (count: 'exact')  → returns { unsnoozed: count }
 *
 * Coverage focuses on:
 *   - auth gate (401 without / with bad bearer / with CRON_SECRET unset)
 *   - happy path returns the unsnoozed count
 *   - no-op: 0 rows when nothing is past due
 *   - safety: the update is scoped to snoozed_until IS NOT NULL AND <= now
 *     (relative cutoff) — it never clears still-active snoozes
 *
 * Pure mock (no DB). The route uses the real web/lib/logger#withCronLock, which
 * issues cron_try_lock/cron_unlock RPCs against the mocked supabase client.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { POST } from '../../../src/app/api/cron/notification-unsnooze/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

interface UnsnoozeCapture {
  updatePayload: Record<string, unknown> | null
  updateOptions: unknown
  notArgs: [string, string, unknown] | null
  lteCol: string | null
  lteVal: string | null
}

/**
 * Supabase mock for `notifications`.
 *   .update({snoozed_until:null}, {count:'exact'})
 *   .not('snoozed_until','is',null)
 *   .lte('snoozed_until', now)  → { count }
 */
function makeUnsnoozeSupabase(opts: { count?: number | null } = {}) {
  const capture: UnsnoozeCapture = {
    updatePayload: null,
    updateOptions: null,
    notArgs: null,
    lteCol: null,
    lteVal: null,
  }

  const from = vi.fn((table: string) => {
    if (table !== 'notifications') return {}
    return {
      update: vi.fn((payload: Record<string, unknown>, options: unknown) => {
        capture.updatePayload = payload
        capture.updateOptions = options
        return {
          not: vi.fn((col: string, op: string, val: unknown) => {
            capture.notArgs = [col, op, val]
            return {
              lte: vi.fn((c: string, v: string) => {
                capture.lteCol = c
                capture.lteVal = v
                return Promise.resolve({ count: opts.count ?? 0, error: null })
              }),
            }
          }),
        }
      }),
    }
  })

  const rpc = vi.fn((name: string) =>
    name === 'cron_try_lock'
      ? Promise.resolve({ data: true, error: null })
      : Promise.resolve({ data: null, error: null }),
  )
  return { from, rpc, _capture: capture }
}

function req(secret?: string) {
  return new Request('http://localhost/api/cron/notification-unsnooze', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

beforeEach(() => {
  process.env.CRON_SECRET = CRON_SECRET
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/cron/notification-unsnooze — auth gate', () => {
  it('401 without Authorization header', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('unauthorized')
  })

  it('401 with wrong secret', async () => {
    const res = await POST(req('nope'))
    expect(res.status).toBe(401)
  })

  it('401 when CRON_SECRET is unset (fail-closed)', async () => {
    delete process.env.CRON_SECRET
    const res = await POST(req('Bearer-anything'))
    expect(res.status).toBe(401)
    process.env.CRON_SECRET = CRON_SECRET
  })

  it('does not touch supabase on an unauthorized request', async () => {
    const supabase = makeUnsnoozeSupabase({ count: 3 })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    await POST(req())
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('POST /api/cron/notification-unsnooze — happy path', () => {
  it('returns 200 with the unsnoozed count', async () => {
    const supabase = makeUnsnoozeSupabase({ count: 3 })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.unsnoozed).toBe(3)
  })

  it('clears snoozed_until (sets it to null) with an exact count request', async () => {
    const supabase = makeUnsnoozeSupabase({ count: 1 })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    await POST(req(CRON_SECRET))
    expect(supabase._capture.updatePayload).toEqual({ snoozed_until: null })
    expect(supabase._capture.updateOptions).toEqual({ count: 'exact' })
  })
})

describe('POST /api/cron/notification-unsnooze — no-op', () => {
  it('returns unsnoozed:0 when nothing is past due', async () => {
    const supabase = makeUnsnoozeSupabase({ count: 0 })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET))
    const body = await res.json()
    expect(body.unsnoozed).toBe(0)
  })

  it('coerces a null count to 0 (no rows matched)', async () => {
    const supabase = makeUnsnoozeSupabase({ count: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET))
    const body = await res.json()
    expect(body.unsnoozed).toBe(0)
  })
})

describe('POST /api/cron/notification-unsnooze — cutoff safety', () => {
  it('only clears snoozes that are IS NOT NULL and past due (<= now)', async () => {
    const supabase = makeUnsnoozeSupabase({ count: 5 })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const before = Date.now()
    await POST(req(CRON_SECRET))
    const after = Date.now()

    // Never touches already-cleared rows.
    expect(supabase._capture.notArgs).toEqual(['snoozed_until', 'is', null])
    // Past-due gate is on snoozed_until, with a cutoff ~ now (relative, not future).
    expect(supabase._capture.lteCol).toBe('snoozed_until')
    const cutoff = new Date(supabase._capture.lteVal as string).getTime()
    expect(cutoff).toBeGreaterThanOrEqual(before - 1000)
    expect(cutoff).toBeLessThanOrEqual(after + 1000)
  })
})
