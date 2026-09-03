/**
 * Tests for POST /api/cron/notification-deliver — mutates notification
 * delivery state (pending → sent / failed / dead).
 *
 * The route delegates to lib/notifications/cron/deliver#processDeliveryQueue:
 *   1. Selects pending deliveries whose next_retry_at <= now (oldest first, ≤50).
 *   2. Marks each 'sent' (scoped by .eq('id', delivery.id)).
 *   3. On send failure: increments attempts, schedules exponential backoff,
 *      flips to 'dead' after maxAttempts (5).
 *
 * Coverage focuses on:
 *   - auth gate (401 without / with bad bearer / with CRON_SECRET unset)
 *   - happy path returns processed/total counts
 *   - idempotency: only status='pending' rows are selected (sent ones excluded)
 *     and every mutation is scoped by .eq('id', ...) — never a blanket update
 *   - failure handling: failed retry scheduling + dead-lettering at maxAttempts
 *   - error propagation: a thrown query surfaces as HTTP 500
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

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

// processDeliveryQueue's email adapter resolves a real SES client via
// getEmailService() — stub it so a happy-path send never touches AWS and
// always succeeds (EmailAdapter#send only cares that this doesn't throw).
vi.mock('@/lib/email/service', () => ({
  getEmailService: vi.fn(() => ({ send: vi.fn().mockResolvedValue({}) })),
}))

import { POST } from '../../../src/app/api/cron/notification-deliver/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

interface DeliverCapture {
  selectStatusEq: string | null
  lteCol: string | null
  lteVal: string | null
  orderCol: string | null
  limitN: number | null
  updates: Array<{
    status: unknown
    attempts: unknown
    next_retry_at: unknown
    col: string
    val: unknown
  }>
}

/**
 * Supabase mock for `notification_deliveries`.
 *   select chain: .select('*..').eq('status','pending').lte('next_retry_at',now)
 *                 .order('next_retry_at').limit(50)  → { data: pending }
 *   update chain: .update({...}).eq('id', id)        → { error: null }
 * `failSend` makes the initial 'sent' update reject so the catch/retry path runs.
 * `selectThrows` makes the select reject so the route-level 500 path runs.
 * `auth.admin.getUserById` backs processDeliveryQueue's user-profile lookup —
 * every fixture that reaches send() needs `notifications: { user_id }` to
 * resolve here, or getUserProfile returns null and the delivery fails.
 */
function makeDeliverSupabase(opts: {
  pending?: Array<Record<string, unknown>>
  failSend?: boolean
  selectThrows?: boolean
  userEmail?: string | null
} = {}) {
  const pending = opts.pending ?? []
  const capture: DeliverCapture = {
    selectStatusEq: null,
    lteCol: null,
    lteVal: null,
    orderCol: null,
    limitN: null,
    updates: [],
  }

  const build = () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn(() => chain),
      eq: vi.fn((c: string, v: unknown) => {
        if (c === 'status') capture.selectStatusEq = v as string
        return chain
      }),
      lte: vi.fn((c: string, v: string) => {
        capture.lteCol = c
        capture.lteVal = v
        return chain
      }),
      order: vi.fn((c: string) => {
        capture.orderCol = c
        return chain
      }),
      limit: vi.fn((n: number) => {
        capture.limitN = n
        if (opts.selectThrows) return Promise.reject(new Error('select boom'))
        return Promise.resolve({ data: pending, error: null })
      }),
      update: vi.fn((payload: Record<string, unknown>) => ({
        eq: vi.fn((col: string, val: unknown) => {
          capture.updates.push({
            status: payload.status,
            attempts: payload.attempts,
            next_retry_at: payload.next_retry_at,
            col,
            val,
          })
          if (payload.status === 'sent' && opts.failSend) {
            return Promise.reject(new Error('adapter down'))
          }
          return Promise.resolve({ error: null })
        }),
      })),
    }
    return chain
  }

  const from = vi.fn((table: string) =>
    table === 'notification_deliveries' ? build() : {},
  )
  const rpc = vi.fn((name: string) =>
    name === 'cron_try_lock'
      ? Promise.resolve({ data: true, error: null })
      : Promise.resolve({ data: null, error: null }),
  )
  const userEmail = opts.userEmail === undefined ? 'user@example.com' : opts.userEmail
  const auth = {
    admin: {
      getUserById: vi.fn((id: string) =>
        Promise.resolve({
          data: userEmail === null ? null : { user: { id, email: userEmail } },
          error: null,
        }),
      ),
    },
  }
  return { from, rpc, auth, _capture: capture }
}

function req(secret?: string) {
  return new Request('http://localhost/api/cron/notification-deliver', {
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

describe('POST /api/cron/notification-deliver — auth gate', () => {
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
    const supabase = makeDeliverSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    await POST(req())
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('POST /api/cron/notification-deliver — happy path', () => {
  it('returns 200 with processed + total when all sends succeed', async () => {
    const supabase = makeDeliverSupabase({
      pending: [
        {
          id: 'd1',
          attempts: 0,
          channel: 'email',
          notifications: { user_id: 'u1', title: 'Hello', message: 'World' },
        },
        {
          id: 'd2',
          attempts: 0,
          channel: 'email',
          notifications: { user_id: 'u2', title: 'Hello', message: 'World' },
        },
      ],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.processed).toBe(2)
    expect(body.total).toBe(2)
    // Both deliveries actually resolved a user via auth.admin.getUserById —
    // not just fell through to 'sent' unconditionally.
    expect(supabase.auth.admin.getUserById).toHaveBeenCalledTimes(2)
    const sent = supabase._capture.updates.filter((u) => u.status === 'sent')
    expect(sent).toHaveLength(2)
  })

  it('returns processed:0 when the queue is empty', async () => {
    const supabase = makeDeliverSupabase({ pending: [] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(0)
    // No update fired against an empty queue.
    expect(supabase._capture.updates).toHaveLength(0)
  })
})

describe('POST /api/cron/notification-deliver — idempotency / safety', () => {
  it('only selects status=pending rows (already-sent are never re-processed)', async () => {
    const supabase = makeDeliverSupabase({ pending: [{ id: 'd1', attempts: 0 }] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    await POST(req(CRON_SECRET))
    expect(supabase._capture.selectStatusEq).toBe('pending')
    // Retry gate + capped batch — bounds work and prevents thundering herd.
    expect(supabase._capture.lteCol).toBe('next_retry_at')
    expect(supabase._capture.orderCol).toBe('next_retry_at')
    expect(supabase._capture.limitN).toBe(50)
  })

  it('scopes every mutation by .eq(id, ...) — never a blanket update', async () => {
    const supabase = makeDeliverSupabase({
      pending: [
        { id: 'd1', attempts: 0 },
        { id: 'd2', attempts: 0 },
      ],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    await POST(req(CRON_SECRET))
    expect(supabase._capture.updates.length).toBeGreaterThan(0)
    for (const u of supabase._capture.updates) {
      expect(u.col).toBe('id')
      expect(['d1', 'd2']).toContain(u.val)
    }
  })
})

describe('POST /api/cron/notification-deliver — failure handling', () => {
  it('schedules a backoff retry (status=failed) when a send fails below maxAttempts', async () => {
    const supabase = makeDeliverSupabase({
      pending: [{ id: 'd1', attempts: 0 }],
      failSend: true,
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Send failed → not processed, but still counted in total.
    expect(body.processed).toBe(0)
    expect(body.total).toBe(1)

    // Two updates: the failing 'sent' attempt, then the 'failed' retry write.
    const failed = supabase._capture.updates.find((u) => u.status === 'failed')
    expect(failed).toBeDefined()
    expect(failed?.attempts).toBe(1)
    expect(failed?.next_retry_at).toBeTruthy() // backoff scheduled
    expect(failed?.col).toBe('id')
  })

  it('dead-letters (status=dead, no next_retry_at) once attempts reach maxAttempts', async () => {
    const supabase = makeDeliverSupabase({
      pending: [{ id: 'd1', attempts: 4 }], // 4 → +1 = 5 = maxAttempts
      failSend: true,
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    await POST(req(CRON_SECRET))
    const dead = supabase._capture.updates.find((u) => u.status === 'dead')
    expect(dead).toBeDefined()
    expect(dead?.attempts).toBe(5)
    expect(dead?.next_retry_at).toBeNull() // no further retries
  })
})

describe('POST /api/cron/notification-deliver — error propagation', () => {
  it('returns 500 when the delivery query throws', async () => {
    const supabase = makeDeliverSupabase({ selectThrows: true })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('select boom')
  })
})
