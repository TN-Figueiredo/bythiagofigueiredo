import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setLogger, resetLogger } from '../../../lib/logger'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET
process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
process.env.NEWSLETTER_FROM_DOMAIN = 'example.com'

const fromMock = vi.fn()
const rpcMock = vi.fn()

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}))

const mockSend = vi.fn().mockResolvedValue({ messageId: 'msg_1', provider: 'ses' })

vi.mock('../../../lib/email/service', () => ({
  getEmailService: () => ({
    send: mockSend,
  }),
}))

const mockCaptureException = vi.fn()
const mockCaptureMessage = vi.fn()
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}))

vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html><body>rendered</body></html>'),
}))

vi.mock('../../../../src/emails/newsletter', () => ({
  Newsletter: vi.fn().mockReturnValue(null),
}))

vi.mock('../../../lib/newsletter/link-tracking', () => ({
  rewriteLinksForTracking: vi.fn().mockImplementation((html: string) => html),
  rewriteLinksUnified: vi.fn().mockResolvedValue({ html: '<html>rewritten</html>' }),
}))

vi.mock('../../../lib/newsletter/email-sanitizer', () => ({
  sanitizeForEmail: vi.fn().mockImplementation((html: string) => html),
}))

vi.mock('../../../lib/newsletter/confirm-email', () => ({
  generateUnsubscribeToken: vi.fn().mockReturnValue({ raw: 'unsub-raw', hash: 'unsub-hash' }),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

import { POST } from '../../../src/app/api/cron/send-scheduled-newsletters/route'

function req(secret?: string) {
  return new Request('http://localhost/api/cron/send-scheduled-newsletters', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

// Helper: build a chainable mock for supabase query builder
function chainMock(resolvedValue: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const handler = {
    get(_target: unknown, prop: string) {
      if (prop === 'then') return undefined
      if (!chain[prop]) {
        chain[prop] = vi.fn().mockReturnValue(new Proxy({}, handler))
      }
      return chain[prop]
    },
  }
  const proxy = new Proxy({}, handler)
  // Terminal methods that return the value
  const terminalHandler = {
    get(_target: unknown, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve(resolvedValue)
      }
      if (!chain[prop]) {
        chain[prop] = vi.fn().mockReturnValue(new Proxy({}, terminalHandler))
      }
      return chain[prop]
    },
  }
  return new Proxy({}, terminalHandler)
}

const EDITION_FIXTURE = {
  id: 'ed-1',
  newsletter_type_id: 'main-pt',
  subject: 'Test Newsletter',
  preheader: 'Preview text',
  content_html: '<p>Hello</p>',
  content_mdx: null,
  segment: null,
  site_id: 'site-1',
}

const TYPE_FIXTURE = {
  name: 'Main PT',
  color: '#FF8240',
  sender_name: 'Thiago',
  sender_email: 'news@example.com',
  reply_to: null,
  max_bounce_rate_pct: 5,
}

// Standard newsletter_editions call sequence shared by the fan-out tests:
// 1: reconcile candidates (empty) · 2: stuck recovery · 3: scheduled editions
// (one EDITION_FIXTURE) · 4: CAS claim (success) · 5+: status updates (recorded
// into editionUpdates).
function editionsMock(state: { n: number }, editionUpdates: Array<Record<string, unknown>>) {
  state.n++
  if (state.n === 1) return chainMock({ data: [], error: null })
  if (state.n === 2) {
    return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lt: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }) }
  }
  if (state.n === 3) {
    return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lte: vi.fn().mockResolvedValue({ data: [EDITION_FIXTURE], error: null }) }) }) }
  }
  if (state.n === 4) {
    return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: 'ed-1' }], error: null }) }) }) }) }
  }
  return {
    update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
      editionUpdates.push(payload)
      return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) }
    }),
  }
}

describe('POST /api/cron/send-scheduled-newsletters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setLogger({ info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never)
    rpcMock.mockResolvedValue({ data: true, error: null })
    // Re-establish the default happy-path send (tests that need failures
    // override this with mockReset + mockRejectedValue).
    mockSend.mockReset()
    mockSend.mockResolvedValue({ messageId: 'msg_1', provider: 'ses' })
    // Permit sends in the test env (the route otherwise only sends from the
    // production Vercel deployment) and enable delivery reconciliation so the
    // reconcile-candidates mock prepended to each flow test stays aligned.
    process.env.ALLOW_LOCAL_NEWSLETTER_SEND = '1'
    process.env.NEWSLETTER_DELIVERY_RECONCILE = '1'
  })
  afterEach(() => {
    resetLogger()
    delete process.env.ALLOW_LOCAL_NEWSLETTER_SEND
    delete process.env.NEWSLETTER_DELIVERY_RECONCILE
  })

  it('skips (does not send) when invoked outside production without override', async () => {
    delete process.env.ALLOW_LOCAL_NEWSLETTER_SEND
    const prevVercelEnv = process.env.VERCEL_ENV
    delete process.env.VERCEL_ENV
    try {
      const res = await POST(req(CRON_SECRET))
      expect(res.status).toBe(200)
      // withCronLock strips `status` and returns the extra fields.
      expect(await res.json()).toMatchObject({ skipped: true, sent: 0 })
      // Guard returns before any edition is queried/claimed.
      expect(fromMock).not.toHaveBeenCalled()
    } finally {
      if (prevVercelEnv !== undefined) process.env.VERCEL_ENV = prevVercelEnv
    }
  })

  it('returns 401 without auth', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong secret', async () => {
    const res = await POST(req('wrong'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with no scheduled editions', async () => {
    // stuck-edition recovery: newsletter_editions update (sending -> scheduled)
    // then select scheduled editions
    const callSequence: string[] = []
    fromMock.mockImplementation((table: string) => {
      callSequence.push(table)
      if (table === 'newsletter_editions') {
        // First call: stuck recovery update
        // Second call: select scheduled editions
        const callCount = callSequence.filter(t => t === 'newsletter_editions').length
        if (callCount === 1) {
          // stuck recovery — UPDATE ... SET status='scheduled' WHERE status='sending' AND updated_at < 2h
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lt: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }
        }
        // editions query — SELECT ... WHERE status='scheduled' AND scheduled_at <= now()
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }
      return chainMock({ data: [], error: null })
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(0)
  })

  it('handles CAS claim race (edition already claimed by another instance)', async () => {
    const callIndex = { newsletter_editions: 0 }
    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_editions') {
        callIndex.newsletter_editions++
        if (callIndex.newsletter_editions === 1) {
          // reconcileDeliveries candidates query — empty so it early-returns
          return chainMock({ data: [], error: null })
        }
        if (callIndex.newsletter_editions === 2) {
          // stuck recovery
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lt: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }
        }
        if (callIndex.newsletter_editions === 3) {
          // select scheduled editions
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lte: vi.fn().mockResolvedValue({
                  data: [EDITION_FIXTURE],
                  error: null,
                }),
              }),
            }),
          }
        }
        // CAS claim — returns empty (already claimed)
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }
      }
      return chainMock({ data: [], error: null })
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(0)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('sends email to subscriber and updates edition to sent', async () => {
    const callIndex = { newsletter_editions: 0, newsletter_sends: 0 }
    const editionUpdates: Array<Record<string, unknown>> = []

    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_editions') {
        callIndex.newsletter_editions++
        if (callIndex.newsletter_editions === 1) {
          // reconcileDeliveries candidates query — empty so it early-returns
          return chainMock({ data: [], error: null })
        }
        if (callIndex.newsletter_editions === 2) {
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lt: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }) }
        }
        if (callIndex.newsletter_editions === 3) {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lte: vi.fn().mockResolvedValue({ data: [EDITION_FIXTURE], error: null }) }) }) }
        }
        if (callIndex.newsletter_editions === 4) {
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: 'ed-1' }], error: null }) }) }) }) }
        }
        return { update: vi.fn().mockImplementation((payload: Record<string, unknown>) => { editionUpdates.push(payload); return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) } }) }
      }

      if (table === 'newsletter_subscriptions') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ range: vi.fn().mockResolvedValue({ data: [{ email: 'user@test.com', locale: 'pt-BR' }], error: null }) }) }) }) }) }
      }

      if (table === 'newsletter_sends') {
        callIndex.newsletter_sends++
        if (callIndex.newsletter_sends === 1) {
          return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
        }
        if (callIndex.newsletter_sends === 2) {
          // Paginated unsent query: .select().eq().is().or().range()
          return chainMock({ data: [{ id: 'send-1', subscriber_email: 'user@test.com' }], error: null })
        }
        if (callIndex.newsletter_sends === 3) {
          // last_attempt_at update (before send): .update().eq()
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) }
        }
        if (callIndex.newsletter_sends === 4) {
          // provider_message_id update (after send): .update().eq()
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) }
        }
        // Call 5: totalSentCount query: .select('id', { count, head }).eq().not()
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ not: vi.fn().mockResolvedValue({ count: 1, data: null, error: null }) }) }) }
      }

      if (table === 'newsletter_types') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: TYPE_FIXTURE, error: null }) }) }) }
      }

      if (table === 'unsubscribe_tokens') {
        return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
      }

      return chainMock({ data: null, error: null })
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    expect(mockSend).toHaveBeenCalledTimes(1)

    const sendCall = mockSend.mock.calls[0][0]
    expect(sendCall.to).toBe('user@test.com')
    expect(sendCall.subject).toBe('Test Newsletter')
    expect(sendCall.from.name).toBe('Thiago')
    expect(sendCall.from.email).toBe('news@example.com')
    expect(sendCall.metadata.headers['List-Unsubscribe']).toBeDefined()
    expect(sendCall.metadata.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('recovers stuck editions sending for >2 hours', async () => {
    const callIndex = { newsletter_editions: 0 }
    let stuckRecoveryData: unknown[] | null = null

    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_editions') {
        callIndex.newsletter_editions++
        if (callIndex.newsletter_editions === 1) {
          // reconcileDeliveries candidates query — empty so it early-returns
          return chainMock({ data: [], error: null })
        }
        if (callIndex.newsletter_editions === 2) {
          // stuck recovery — returns 1 recovered edition
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lt: vi.fn().mockReturnValue({
                  select: vi.fn().mockImplementation(() => {
                    stuckRecoveryData = [{ id: 'stuck-ed-1' }]
                    return Promise.resolve({ data: stuckRecoveryData, error: null })
                  }),
                }),
              }),
            }),
          }
        }
        // select scheduled editions — empty (the recovered one needs another cycle)
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }
      return chainMock({ data: [], error: null })
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining('Recovered 1 stuck edition'),
      expect.objectContaining({ level: 'warning' }),
    )
  })

  it('sets edition to sent with send_count=0 when no confirmed subscribers', async () => {
    const callIndex = { newsletter_editions: 0 }
    const editionUpdates: Array<Record<string, unknown>> = []

    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_editions') {
        callIndex.newsletter_editions++
        if (callIndex.newsletter_editions === 1) {
          // reconcileDeliveries candidates query — empty so it early-returns
          return chainMock({ data: [], error: null })
        }
        if (callIndex.newsletter_editions === 2) {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lt: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }
        }
        if (callIndex.newsletter_editions === 3) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lte: vi.fn().mockResolvedValue({
                  data: [EDITION_FIXTURE],
                  error: null,
                }),
              }),
            }),
          }
        }
        if (callIndex.newsletter_editions === 4) {
          // CAS claim success
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({ data: [{ id: 'ed-1' }], error: null }),
                }),
              }),
            }),
          }
        }
        // Final status update
        return {
          update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
            editionUpdates.push(payload)
            return {
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }
          }),
        }
      }
      if (table === 'newsletter_subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }
      }
      return chainMock({ data: null, error: null })
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    expect(mockSend).not.toHaveBeenCalled()
    expect(editionUpdates.length).toBeGreaterThanOrEqual(1)
    const lastUpdate = editionUpdates[editionUpdates.length - 1]
    expect(lastUpdate.status).toBe('sent')
    expect(lastUpdate.send_count).toBe(0)
  })

  it('alerts when an edition delivered 0 after send', async () => {
    const callIndex = { newsletter_editions: 0, newsletter_sends: 0 }
    const editionUpdates: Array<Record<string, unknown>> = []

    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_editions') {
        callIndex.newsletter_editions++
        if (callIndex.newsletter_editions === 1) {
          // reconcileDeliveries candidates query — one sent edition to reconcile
          return chainMock({ data: [{ id: 'ed-x', subject: 'S' }], error: null })
        }
        if (callIndex.newsletter_editions === 2) {
          // reconcile: editions update setting delivery_alerted
          return {
            update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              editionUpdates.push(payload)
              return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) }
            }),
          }
        }
        if (callIndex.newsletter_editions === 3) {
          // stuck recovery
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lt: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }) }
        }
        // main editions select — empty so the run ends cleanly with sent:0
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lte: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }
      }

      if (table === 'newsletter_sends') {
        callIndex.newsletter_sends++
        if (callIndex.newsletter_sends === 1) {
          // sentTotal count query → 3 accepted sends
          return chainMock({ count: 3, data: null, error: null })
        }
        // deliveredCount query → 0 delivered
        return chainMock({ count: 0, data: null, error: null })
      }

      return chainMock({ data: [], error: null })
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(0)

    expect(mockCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining('0 deliveries recorded'),
      expect.objectContaining({ level: 'error' }),
    )
    expect(editionUpdates.some((u) => u.delivery_alerted === true)).toBe(true)
  })

  it('send rejection is captured and does not abort the edition', async () => {
    const callIndex = { newsletter_editions: 0, newsletter_sends: 0 }
    const editionUpdates: Array<Record<string, unknown>> = []

    // Two subscribers; first send rejects, second succeeds.
    mockSend.mockReset()
    mockSend
      .mockRejectedValueOnce(new Error('ses throttle'))
      .mockResolvedValue({ messageId: 'msg_ok', provider: 'ses' })

    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_editions') {
        callIndex.newsletter_editions++
        if (callIndex.newsletter_editions === 1) return chainMock({ data: [], error: null }) // reconcile candidates
        if (callIndex.newsletter_editions === 2) {
          // stuck recovery
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lt: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }) }
        }
        if (callIndex.newsletter_editions === 3) {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lte: vi.fn().mockResolvedValue({ data: [EDITION_FIXTURE], error: null }) }) }) }
        }
        if (callIndex.newsletter_editions === 4) {
          // CAS claim success
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: 'ed-1' }], error: null }) }) }) }) }
        }
        // final status update(s)
        return {
          update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
            editionUpdates.push(payload)
            return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) }
          }),
        }
      }

      if (table === 'newsletter_subscriptions') {
        return chainMock({ data: [
          { email: 'a@test.com', locale: null },
          { email: 'b@test.com', locale: null },
        ], error: null })
      }

      if (table === 'newsletter_sends') {
        callIndex.newsletter_sends++
        if (callIndex.newsletter_sends === 1) return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
        if (callIndex.newsletter_sends === 2) {
          // unsent select → two rows
          return chainMock({ data: [
            { id: 'send-a', subscriber_email: 'a@test.com' },
            { id: 'send-b', subscriber_email: 'b@test.com' },
          ], error: null })
        }
        // last_attempt_at + provider updates (count query handled by .not terminal too)
        return {
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ not: vi.fn().mockResolvedValue({ count: 1, data: null, error: null }) }) }),
        }
      }

      if (table === 'newsletter_types') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: TYPE_FIXTURE, error: null }) }) }) }
      }
      if (table === 'unsubscribe_tokens') {
        return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
      }
      return chainMock({ data: null, error: null })
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    // a@ fails in the main loop, b@ still gets its email, then the in-run
    // retry pass re-attempts a@ and succeeds → 3 send calls total.
    expect(mockSend).toHaveBeenCalledTimes(3)
    expect(mockSend.mock.calls[0][0].to).toBe('a@test.com')
    expect(mockSend.mock.calls[1][0].to).toBe('b@test.com')
    expect(mockSend.mock.calls[2][0].to).toBe('a@test.com')
    expect(mockCaptureException).toHaveBeenCalled()
    // Retry recovered the transient failure — no "still failing" alert.
    expect(mockCaptureMessage).not.toHaveBeenCalledWith(
      expect.stringContaining('still failing'),
      expect.anything(),
    )
    // Edition still progressed to 'sent' despite the one rejected send.
    expect(editionUpdates.some((u) => u.status === 'sent')).toBe(true)
  })

  it('aborts edition to failed and alerts when send-error rate exceeds threshold', async () => {
    const callIndex = { newsletter_editions: 0, newsletter_sends: 0 }
    const editionUpdates: Array<Record<string, unknown>> = []

    // 10 subscribers, every send rejects → 100% error rate.
    mockSend.mockReset()
    mockSend.mockRejectedValue(new Error('ses throttle'))

    const subs = Array.from({ length: 10 }, (_, i) => ({ email: `u${i}@test.com`, locale: null }))
    const unsentRows = subs.map((s, i) => ({ id: `send-${i}`, subscriber_email: s.email }))

    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_editions') {
        callIndex.newsletter_editions++
        if (callIndex.newsletter_editions === 1) return chainMock({ data: [], error: null }) // reconcile candidates
        if (callIndex.newsletter_editions === 2) {
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lt: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }) }
        }
        if (callIndex.newsletter_editions === 3) {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lte: vi.fn().mockResolvedValue({ data: [EDITION_FIXTURE], error: null }) }) }) }
        }
        if (callIndex.newsletter_editions === 4) {
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: 'ed-1' }], error: null }) }) }) }) }
        }
        // circuit-breaker status update(s)
        return {
          update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
            editionUpdates.push(payload)
            return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) }
          }),
        }
      }

      if (table === 'newsletter_subscriptions') {
        return chainMock({ data: subs, error: null })
      }

      if (table === 'newsletter_sends') {
        callIndex.newsletter_sends++
        if (callIndex.newsletter_sends === 1) return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
        if (callIndex.newsletter_sends === 2) return chainMock({ data: unsentRows, error: null })
        // last_attempt_at updates for each subscriber
        return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) }
      }

      if (table === 'newsletter_types') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { ...TYPE_FIXTURE, max_bounce_rate_pct: 1 }, error: null }) }) }) }
      }
      if (table === 'unsubscribe_tokens') {
        return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
      }
      return chainMock({ data: null, error: null })
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    expect(editionUpdates.some((u) => u.status === 'failed')).toBe(true)
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining('aborted'),
      expect.objectContaining({ level: 'error' }),
    )
  })

  it('excludes recently-attempted rows from re-send via the 90-minute last_attempt_at window', async () => {
    // At-least-once dedup window: the unsent-rows resume query must filter out
    // rows whose provider_message_id is NULL but were attempted within the last
    // 90 minutes (last_attempt_at recent). We capture the .or() argument and
    // assert it encodes `last_attempt_at.is.null,last_attempt_at.lt.<cutoff>`
    // with a cutoff ~90min in the past — so a recently-attempted row is excluded.
    const callIndex = { newsletter_editions: 0, newsletter_sends: 0 }
    const orArgs: string[] = []

    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_editions') {
        callIndex.newsletter_editions++
        if (callIndex.newsletter_editions === 1) return chainMock({ data: [], error: null }) // reconcile candidates
        if (callIndex.newsletter_editions === 2) {
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lt: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }) }
        }
        if (callIndex.newsletter_editions === 3) {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lte: vi.fn().mockResolvedValue({ data: [EDITION_FIXTURE], error: null }) }) }) }
        }
        if (callIndex.newsletter_editions === 4) {
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: 'ed-1' }], error: null }) }) }) }) }
        }
        return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) }
      }

      if (table === 'newsletter_subscriptions') {
        return chainMock({ data: [{ email: 'user@test.com', locale: null }], error: null })
      }

      if (table === 'newsletter_sends') {
        callIndex.newsletter_sends++
        if (callIndex.newsletter_sends === 1) return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
        if (callIndex.newsletter_sends === 2) {
          // Unsent resume query: .select().eq().is().or(<filter>).range()
          // Capture the .or() argument; return an EMPTY page so the recently-
          // attempted row is treated as excluded (no send issued for it).
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  or: vi.fn().mockImplementation((arg: string) => {
                    orArgs.push(arg)
                    return { range: vi.fn().mockResolvedValue({ data: [], error: null }) }
                  }),
                }),
              }),
            }),
          }
        }
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ not: vi.fn().mockResolvedValue({ count: 0, data: null, error: null }) }) }) }
      }

      if (table === 'newsletter_types') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: TYPE_FIXTURE, error: null }) }) }) }
      }
      if (table === 'unsubscribe_tokens') {
        return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
      }
      return chainMock({ data: null, error: null })
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)

    // The resume query was built with the dedup filter.
    expect(orArgs.length).toBe(1)
    const filter = orArgs[0]
    expect(filter).toContain('last_attempt_at.is.null')
    expect(filter).toMatch(/last_attempt_at\.lt\.(.+)$/)

    // The cutoff encoded in the filter is ~90 minutes in the past — i.e. a row
    // attempted just now (last_attempt_at > cutoff) is excluded from re-send.
    const cutoffIso = filter.match(/last_attempt_at\.lt\.(.+)$/)![1]
    const cutoffMs = Date.parse(cutoffIso)
    const expected = Date.now() - 90 * 60 * 1000
    // Within a generous tolerance for test execution time.
    expect(Math.abs(cutoffMs - expected)).toBeLessThan(60 * 1000)

    // Because the only unsent row is inside the 90-min window, nothing is sent.
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('stamps last_attempt_at before sending', async () => {
    const callIndex = { newsletter_editions: 0, newsletter_sends: 0 }
    // Capture the ORDER + payloads of newsletter_sends updates.
    const sendUpdatePayloads: Array<Record<string, unknown>> = []

    mockSend.mockReset()
    mockSend.mockResolvedValue({ messageId: 'msg_ok', provider: 'ses' })

    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_editions') {
        callIndex.newsletter_editions++
        if (callIndex.newsletter_editions === 1) return chainMock({ data: [], error: null }) // reconcile candidates
        if (callIndex.newsletter_editions === 2) {
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lt: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }) }
        }
        if (callIndex.newsletter_editions === 3) {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lte: vi.fn().mockResolvedValue({ data: [EDITION_FIXTURE], error: null }) }) }) }
        }
        if (callIndex.newsletter_editions === 4) {
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: 'ed-1' }], error: null }) }) }) }) }
        }
        return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) }
      }

      if (table === 'newsletter_subscriptions') {
        return chainMock({ data: [{ email: 'user@test.com', locale: null }], error: null })
      }

      if (table === 'newsletter_sends') {
        callIndex.newsletter_sends++
        if (callIndex.newsletter_sends === 1) return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
        if (callIndex.newsletter_sends === 2) {
          return chainMock({ data: [{ id: 'send-1', subscriber_email: 'user@test.com' }], error: null })
        }
        if (callIndex.newsletter_sends === 3) {
          // last_attempt_at update (before send)
          return {
            update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              sendUpdatePayloads.push(payload)
              return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) }
            }),
          }
        }
        if (callIndex.newsletter_sends === 4) {
          // provider_message_id update (after send)
          return {
            update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              sendUpdatePayloads.push(payload)
              return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) }
            }),
          }
        }
        // totalSentCount
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ not: vi.fn().mockResolvedValue({ count: 1, data: null, error: null }) }) }) }
      }

      if (table === 'newsletter_types') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: TYPE_FIXTURE, error: null }) }) }) }
      }
      if (table === 'unsubscribe_tokens') {
        return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
      }
      return chainMock({ data: null, error: null })
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    expect(mockSend).toHaveBeenCalledTimes(1)
    // First newsletter_sends update must stamp last_attempt_at, BEFORE the
    // provider_message_id update.
    expect(sendUpdatePayloads.length).toBeGreaterThanOrEqual(2)
    expect(sendUpdatePayloads[0]).toHaveProperty('last_attempt_at')
    expect(sendUpdatePayloads[0].last_attempt_at).toBeTruthy()
    expect(sendUpdatePayloads[1]).toHaveProperty('provider_message_id')
  })

  // ── Audit: completeness ───────────────────────────────────────────────────

  it('fans out to EVERY confirmed subscriber — paginates past the 500-row page with exact status/newsletter/site filters', async () => {
    const state = { n: 0 }
    const editionUpdates: Array<Record<string, unknown>> = []
    const rangeArgs: Array<[number, number]> = []
    const eqArgs: Array<[string, unknown]> = []
    const upsertedChunks: Array<Array<Record<string, unknown>>> = []

    // 620 confirmed subscribers: a full first page (500) + a partial second (120).
    const page1 = Array.from({ length: 500 }, (_, i) => ({ email: `u${i}@test.com`, locale: null }))
    const page2 = Array.from({ length: 120 }, (_, i) => ({ email: `v${i}@test.com`, locale: null }))
    const pages = [page1, page2]

    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_editions') return editionsMock(state, editionUpdates)

      if (table === 'newsletter_subscriptions') {
        const builder: Record<string, ReturnType<typeof vi.fn>> = {}
        builder.select = vi.fn().mockReturnValue(builder)
        builder.eq = vi.fn().mockImplementation((col: string, val: unknown) => {
          eqArgs.push([col, val])
          return builder
        })
        builder.range = vi.fn().mockImplementation((from: number, to: number) => {
          rangeArgs.push([from, to])
          return Promise.resolve({ data: pages.shift() ?? [], error: null })
        })
        return builder
      }

      if (table === 'newsletter_sends') {
        return {
          upsert: vi.fn().mockImplementation((rows: Array<Record<string, unknown>>) => {
            upsertedChunks.push(rows)
            return Promise.resolve({ data: null, error: null })
          }),
          // Unsent resume query → empty: this test audits only the fan-out
          // (rows created for everyone), not the dispatch loop.
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue({ range: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }) }),
        }
      }

      return chainMock({ data: null, error: null })
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)

    // Pagination: two pages requested with correct windows — no 500/1000-row truncation.
    expect(rangeArgs).toEqual([[0, 499], [500, 999]])

    // Exact filters on every page: right newsletter, right site, confirmed only
    // (pending_confirmation / unsubscribed / bounced / complained excluded).
    expect(eqArgs).toEqual(expect.arrayContaining([
      ['newsletter_id', 'main-pt'],
      ['site_id', 'site-1'],
      ['status', 'confirmed'],
    ]))

    // One queued send row per subscriber — all 620, chunked under the body limit.
    const allRows = upsertedChunks.flat()
    expect(allRows).toHaveLength(620)
    expect(allRows.every((r) => r.status === 'queued' && r.edition_id === 'ed-1')).toBe(true)
    expect(new Set(allRows.map((r) => r.subscriber_email)).size).toBe(620)

    // Edition completed with the full subscriber count.
    const lastUpdate = editionUpdates[editionUpdates.length - 1]
    expect(lastUpdate.status).toBe('sent')
    expect(lastUpdate.send_count).toBe(620)
  })

  it('aborts (edition NOT marked sent) when the subscriber fetch errors mid-pagination', async () => {
    const state = { n: 0 }
    const editionUpdates: Array<Record<string, unknown>> = []

    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_editions') return editionsMock(state, editionUpdates)
      if (table === 'newsletter_subscriptions') {
        // PostgREST error: data null + error set. Treating this as "end of
        // list" would silently truncate the fan-out — the route must throw.
        return chainMock({ data: null, error: { message: 'statement timeout' } })
      }
      return chainMock({ data: null, error: null })
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ sent: 0 })

    expect(mockSend).not.toHaveBeenCalled()
    expect(mockCaptureException).toHaveBeenCalled()
    // Edition was never finalized: it stays 'sending' so stuck-recovery
    // re-schedules it — nobody is silently skipped.
    expect(editionUpdates.some((u) => u.status === 'sent')).toBe(false)
  })

  it('aborts (edition NOT marked sent) when the newsletter_sends fan-out upsert errors', async () => {
    const state = { n: 0 }
    const editionUpdates: Array<Record<string, unknown>> = []

    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_editions') return editionsMock(state, editionUpdates)
      if (table === 'newsletter_subscriptions') {
        return chainMock({ data: [{ email: 'user@test.com', locale: null }], error: null })
      }
      if (table === 'newsletter_sends') {
        // Failed upsert = subscribers without send rows = they would be
        // invisible to the unsent selector. Must abort, not continue.
        return { upsert: vi.fn().mockResolvedValue({ data: null, error: { message: 'permission denied' } }) }
      }
      return chainMock({ data: null, error: null })
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    expect(mockSend).not.toHaveBeenCalled()
    expect(mockCaptureException).toHaveBeenCalled()
    expect(editionUpdates.some((u) => u.status === 'sent')).toBe(false)
  })

  // ── Audit: suppression ────────────────────────────────────────────────────

  it('does not mail a queued row whose subscriber unsubscribed after fan-out (resume suppression)', async () => {
    const state = { n: 0 }
    const sendsState = { n: 0 }
    const editionUpdates: Array<Record<string, unknown>> = []

    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_editions') return editionsMock(state, editionUpdates)

      if (table === 'newsletter_subscriptions') {
        // Fresh confirmed set contains ONLY a@ — b@ unsubscribed (or bounced/
        // complained via webhook) after the queued rows were created.
        return chainMock({ data: [{ email: 'a@test.com', locale: null }], error: null })
      }

      if (table === 'newsletter_sends') {
        sendsState.n++
        if (sendsState.n === 1) return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
        if (sendsState.n === 2) {
          // Queued rows from the original fan-out still include b@.
          return chainMock({ data: [
            { id: 'send-a', subscriber_email: 'a@test.com' },
            { id: 'send-b', subscriber_email: 'b@test.com' },
          ], error: null })
        }
        return {
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ not: vi.fn().mockResolvedValue({ count: 1, data: null, error: null }) }) }),
        }
      }

      if (table === 'newsletter_types') {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: TYPE_FIXTURE, error: null }) }) }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        }
      }
      if (table === 'unsubscribe_tokens') {
        return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
      }
      return chainMock({ data: null, error: null })
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ sent: 1 })

    // Only the still-confirmed subscriber is mailed; b@'s row stays queued.
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockSend.mock.calls[0][0].to).toBe('a@test.com')
    expect(editionUpdates.some((u) => u.status === 'sent')).toBe(true)
  })

  // ── Audit: crash recovery ─────────────────────────────────────────────────

  it('resumes after a crash: ON CONFLICT skips existing rows, only not-yet-sent rows are dispatched, true total from DB', async () => {
    const state = { n: 0 }
    const sendsState = { n: 0 }
    const editionUpdates: Array<Record<string, unknown>> = []
    const upsertOptions: Array<Record<string, unknown>> = []
    const isArgs: Array<[string, unknown]> = []

    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_editions') return editionsMock(state, editionUpdates)

      if (table === 'newsletter_subscriptions') {
        return chainMock({ data: [
          { email: 'a@test.com', locale: null },
          { email: 'b@test.com', locale: null },
        ], error: null })
      }

      if (table === 'newsletter_sends') {
        sendsState.n++
        if (sendsState.n === 1) {
          return {
            upsert: vi.fn().mockImplementation((_rows: unknown, opts: Record<string, unknown>) => {
              upsertOptions.push(opts)
              return Promise.resolve({ data: null, error: null })
            }),
          }
        }
        if (sendsState.n === 2) {
          // Resume query: a@ was already sent before the crash
          // (provider_message_id recorded) → only b@ comes back.
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockImplementation((col: string, val: unknown) => {
                  isArgs.push([col, val])
                  return { or: vi.fn().mockReturnValue({ range: vi.fn().mockResolvedValue({ data: [{ id: 'send-b', subscriber_email: 'b@test.com' }], error: null }) }) }
                }),
              }),
            }),
          }
        }
        return {
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
          // True total comes from the DB (a@ from the pre-crash run + b@ now).
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ not: vi.fn().mockResolvedValue({ count: 2, data: null, error: null }) }) }),
        }
      }

      if (table === 'newsletter_types') {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: TYPE_FIXTURE, error: null }) }) }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        }
      }
      if (table === 'unsubscribe_tokens') {
        return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
      }
      return chainMock({ data: null, error: null })
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ sent: 1 })

    // Crash-safe fan-out: duplicate rows ignored on conflict of the
    // (edition_id, subscriber_email) unique key.
    expect(upsertOptions[0]).toMatchObject({ onConflict: 'edition_id,subscriber_email', ignoreDuplicates: true })
    // Resume selector targets rows never handed to the provider.
    expect(isArgs).toEqual([['provider_message_id', null]])
    // a@ already got the edition pre-crash — only b@ is mailed now (no dupes).
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockSend.mock.calls[0][0].to).toBe('b@test.com')
    // send_count reflects the DB truth across both runs, not just this run.
    const lastUpdate = editionUpdates.filter((u) => u.status === 'sent').pop()
    expect(lastUpdate?.send_count).toBe(2)
  })

  // ── Audit: partial failure / retry exhaustion ─────────────────────────────

  it('surfaces (Sentry error) sends that are still failing after the in-run retries — never silently lost', async () => {
    const state = { n: 0 }
    const sendsState = { n: 0 }
    const editionUpdates: Array<Record<string, unknown>> = []

    // One subscriber whose send fails deterministically.
    mockSend.mockReset()
    mockSend.mockRejectedValue(new Error('address rejected'))

    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_editions') return editionsMock(state, editionUpdates)
      if (table === 'newsletter_subscriptions') {
        return chainMock({ data: [{ email: 'a@test.com', locale: null }], error: null })
      }
      if (table === 'newsletter_sends') {
        sendsState.n++
        if (sendsState.n === 1) return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
        if (sendsState.n === 2) {
          return chainMock({ data: [{ id: 'send-a', subscriber_email: 'a@test.com' }], error: null })
        }
        return {
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ not: vi.fn().mockResolvedValue({ count: 0, data: null, error: null }) }) }),
        }
      }
      if (table === 'newsletter_types') {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: TYPE_FIXTURE, error: null }) }) }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        }
      }
      if (table === 'unsubscribe_tokens') {
        return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
      }
      return chainMock({ data: null, error: null })
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)

    // 1 main attempt + 2 retry passes = 3 attempts before giving up.
    expect(mockSend).toHaveBeenCalledTimes(3)
    // The loss is loudly recorded (level error + the failed send ids).
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining('still failing'),
      expect.objectContaining({
        level: 'error',
        extra: expect.objectContaining({ failedSendIds: ['send-a'] }),
      }),
    )
    // Edition completes for everyone else (single bad address can't wedge it).
    expect(editionUpdates.some((u) => u.status === 'sent')).toBe(true)
  })
})
