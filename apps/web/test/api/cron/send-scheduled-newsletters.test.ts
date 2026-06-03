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
  })
  afterEach(() => { resetLogger() })

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
        if (callIndex.newsletter_editions === 2) {
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
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lt: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }) }
        }
        if (callIndex.newsletter_editions === 2) {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ lte: vi.fn().mockResolvedValue({ data: [EDITION_FIXTURE], error: null }) }) }) }
        }
        if (callIndex.newsletter_editions === 3) {
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
          // Paginated unsent query: .select().eq().is().range()
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ range: vi.fn().mockResolvedValue({ data: [{ id: 'send-1', subscriber_email: 'user@test.com' }], error: null }) }) }) }) }
        }
        if (callIndex.newsletter_sends === 3) {
          // update send row after email sent
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) }
        }
        // Call 4: totalSentCount query: .select('id', { count, head }).eq().not()
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
        if (callIndex.newsletter_editions === 2) {
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
        if (callIndex.newsletter_editions === 3) {
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
})
