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
    expect(mockSend).toHaveBeenCalledTimes(2)
    expect(mockCaptureException).toHaveBeenCalled()
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
})
