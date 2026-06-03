// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  mockHandleSubscriptionConfirmation,
  mockProcess,
  mockCreateVerify,
} = vi.hoisted(() => {
  const mockHandleSubscriptionConfirmation = vi.fn()
  const mockProcess = vi.fn()
  const mockCreateVerify = vi.fn()
  return { mockHandleSubscriptionConfirmation, mockProcess, mockCreateVerify }
})

vi.mock('@tn-figueiredo/email/webhooks', () => ({
  SesWebhookProcessor: vi.fn().mockImplementation(() => ({
    handleSubscriptionConfirmation: mockHandleSubscriptionConfirmation,
    process: mockProcess,
  })),
}))

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>()
  return { ...actual, createVerify: mockCreateVerify }
})

const maybeSingleMock = vi.fn()

// ── Table-aware Supabase mock ──────────────────────────────────────────
// Each table gets its own chain of mock fns so tests can assert which
// table received which .update()/.insert() and with which arguments.
type MockChain = {
  select: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  // Track what was passed to update/insert
  _lastUpdate: Record<string, unknown> | null
  _lastInsert: Record<string, unknown> | null
  _eqCalls: Array<[string, string]>
}

const tableMocks = new Map<string, MockChain>()

function getTableMock(table: string): MockChain {
  if (!tableMocks.has(table)) {
    const chain = createTableChain()
    tableMocks.set(table, chain)
    return chain
  }
  return tableMocks.get(table)!
}

function createTableChain(): MockChain {
  const chain: MockChain = {
    _lastUpdate: null,
    _lastInsert: null,
    _eqCalls: [],
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  }

  // Build a chainable .eq() that records calls and returns itself
  const makeEqChain = () => {
    const eqObj: Record<string, unknown> = {
      data: null,
      error: null,
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const eqFn = vi.fn((...args: unknown[]) => {
      chain._eqCalls.push(args as [string, string])
      return eqObj
    })
    eqObj.eq = eqFn
    return { eqFn, eqObj }
  }

  chain.select.mockImplementation(() => {
    const { eqObj, eqFn } = makeEqChain()
    return { eq: eqFn, ...eqObj }
  })

  chain.update.mockImplementation((data: Record<string, unknown>) => {
    chain._lastUpdate = data
    const { eqObj, eqFn } = makeEqChain()
    return { eq: eqFn, ...eqObj }
  })

  chain.insert.mockImplementation((data: Record<string, unknown>) => {
    chain._lastInsert = data
    return {
      then: (ok?: () => void) => { ok?.(); return Promise.resolve() },
    }
  })

  return chain
}

const mockFrom = vi.fn((table: string) => getTableMock(table))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: mockFrom,
  }),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({ SNS_EXPECTED_TOPIC_ARN: undefined }),
}))

import { POST } from '../../../src/app/api/webhooks/ses/route'

function validVerifier() {
  return { update: vi.fn(), verify: vi.fn().mockReturnValue(true) }
}

function invalidVerifier() {
  return { update: vi.fn(), verify: vi.fn().mockReturnValue(false) }
}

const originalFetch = globalThis.fetch
const mockFetch = vi.fn()

function snsNotification(
  messagePayload: Record<string, unknown> = {},
  overrides: Record<string, string> = {},
): Request {
  return new Request('http://localhost/api/webhooks/ses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      Type: 'Notification',
      MessageId: 'sns-msg-001',
      TopicArn: 'arn:aws:sns:sa-east-1:123:ses-bythiago-events',
      Message: JSON.stringify(messagePayload),
      Timestamp: '2026-04-29T10:00:00.000Z',
      SignatureVersion: '1',
      Signature: 'dGVzdA==',
      SigningCertURL: 'https://sns.sa-east-1.amazonaws.com/cert.pem',
      ...overrides,
    }),
  })
}

function snsSubscriptionConfirmation(overrides: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/webhooks/ses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      Type: 'SubscriptionConfirmation',
      MessageId: 'sns-sub-001',
      TopicArn: 'arn:aws:sns:sa-east-1:123:ses-bythiago-events',
      Token: 'confirm-token-123',
      Message: 'You have chosen to subscribe...',
      SubscribeURL: 'https://sns.sa-east-1.amazonaws.com/?Action=ConfirmSubscription&Token=xxx',
      Timestamp: '2026-04-29T10:00:00.000Z',
      SignatureVersion: '1',
      Signature: 'dGVzdA==',
      SigningCertURL: 'https://sns.sa-east-1.amazonaws.com/cert.pem',
      ...overrides,
    }),
  })
}

describe('POST /api/webhooks/ses', () => {
  beforeEach(() => {
    mockHandleSubscriptionConfirmation.mockReset().mockResolvedValue(undefined)
    mockProcess.mockReset().mockResolvedValue([])
    mockCreateVerify.mockReset().mockReturnValue(validVerifier())
    tableMocks.clear()
    mockFrom.mockClear()
    // Default: webhook_events dedup check returns no existing row
    maybeSingleMock.mockReset().mockResolvedValue({ data: null, error: null })
    mockFetch.mockReset().mockResolvedValue({
      text: () => Promise.resolve('-----BEGIN CERTIFICATE-----\nFAKE\n-----END CERTIFICATE-----'),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('signature verification', () => {
    it('returns 401 for invalid signature on Notification', async () => {
      mockCreateVerify.mockReturnValueOnce(invalidVerifier())
      const res = await POST(snsNotification())
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('invalid_signature')
    })

    it('rejects cert URL not matching AWS SNS pattern (SSRF protection)', async () => {
      const res = await POST(
        snsNotification({}, { SigningCertURL: 'https://evil.com/cert.pem' }),
      )
      expect(res.status).toBe(401)
    })

    it('rejects SignatureVersion !== 1', async () => {
      const res = await POST(snsNotification({}, { SignatureVersion: '2' }))
      expect(res.status).toBe(401)
    })
  })

  describe('SubscriptionConfirmation', () => {
    it('auto-confirms and returns 200', async () => {
      const res = await POST(snsSubscriptionConfirmation())
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.subscribed).toBe(true)
      expect(mockHandleSubscriptionConfirmation).toHaveBeenCalledOnce()
    })

    it('allows SubscriptionConfirmation even with invalid signature', async () => {
      mockCreateVerify.mockReturnValueOnce(invalidVerifier())
      const res = await POST(snsSubscriptionConfirmation())
      expect(res.status).toBe(200)
      expect(mockHandleSubscriptionConfirmation).toHaveBeenCalledOnce()
    })

    it('returns 500 when subscription confirmation fails', async () => {
      mockHandleSubscriptionConfirmation.mockRejectedValueOnce(new Error('bad URL'))
      const res = await POST(snsSubscriptionConfirmation())
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('subscription_failed')
    })
  })

  describe('Notification processing', () => {
    it('returns 200 and processes delivery event', async () => {
      mockProcess.mockResolvedValueOnce([
        {
          messageId: 'ses-email-001',
          type: 'delivered',
          timestamp: '2026-04-29T10:05:00Z',
        },
      ])
      const res = await POST(snsNotification())
      expect(res.status).toBe(200)
      expect(mockProcess).toHaveBeenCalledOnce()
    })

    it('returns 400 on invalid JSON body', async () => {
      const res = await POST(
        new Request('http://localhost/api/webhooks/ses', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: 'not json',
        }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('invalid_json')
    })

    it('returns dedup when MessageId already processed', async () => {
      // Pre-configure webhook_events table to return existing row
      const webhookChain = getTableMock('webhook_events')
      webhookChain.select.mockImplementation(() => {
        const eqObj: Record<string, unknown> = {
          data: null,
          error: null,
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'existing' }, error: null }),
        }
        eqObj.eq = vi.fn(() => eqObj)
        return { eq: vi.fn(() => eqObj), ...eqObj }
      })
      const res = await POST(snsNotification())
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.dedup).toBe(true)
      expect(mockProcess).not.toHaveBeenCalled()
    })

    it('returns 500 when processor.process throws', async () => {
      mockProcess.mockRejectedValueOnce(new Error('parse error'))
      const res = await POST(snsNotification())
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('process_failed')
    })

    it('ignores non-Notification, non-SubscriptionConfirmation types', async () => {
      const res = await POST(
        new Request('http://localhost/api/webhooks/ses', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            Type: 'UnsubscribeConfirmation',
            MessageId: 'x',
            SignatureVersion: '1',
            Signature: 'dGVzdA==',
            SigningCertURL: 'https://sns.sa-east-1.amazonaws.com/cert.pem',
          }),
        }),
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ignored).toBe(true)
    })
  })

  // ── processEvent DB update tests ─────────────────────────────────────
  // These let mockProcess return specific event types and verify the
  // correct Supabase table calls that processEvent() makes.

  describe('processEvent — DB updates per event type', () => {
    const FAKE_SEND = {
      id: 'send-001',
      edition_id: 'ed-001',
      subscriber_email: 'alice@example.com',
      link_rewrite_enabled: false,
      newsletter_editions: {
        site_id: 'site-001',
        newsletter_type_id: 'nl-type-001',
      },
    }

    /** Wire newsletter_sends and newsletter_subscriptions selects to return data */
    function setupSendLookup(
      send: typeof FAKE_SEND | null = FAKE_SEND,
      trackingConsent = true,
    ) {
      // newsletter_sends: .select(...).eq('provider_message_id', X).maybeSingle()
      const sendsChain = getTableMock('newsletter_sends')
      sendsChain.select.mockImplementation(() => {
        const obj: Record<string, unknown> = {
          maybeSingle: vi.fn().mockResolvedValue({ data: send, error: null }),
        }
        obj.eq = vi.fn(() => obj)
        return obj
      })

      // newsletter_subscriptions: .select('tracking_consent').eq(...).eq(...).maybeSingle()
      const subsChain = getTableMock('newsletter_subscriptions')
      subsChain.select.mockImplementation(() => {
        const obj: Record<string, unknown> = {
          maybeSingle: vi.fn().mockResolvedValue({
            data: { tracking_consent: trackingConsent },
            error: null,
          }),
        }
        obj.eq = vi.fn(() => obj)
        return obj
      })
    }

    it('hard bounce — updates newsletter_sends AND newsletter_subscriptions', async () => {
      setupSendLookup()
      mockProcess.mockResolvedValueOnce([
        {
          messageId: 'ses-bounce-001',
          type: 'bounced',
          timestamp: '2026-04-29T10:10:00Z',
          metadata: { bounceType: 'hard' },
        },
      ])

      const res = await POST(snsNotification())
      expect(res.status).toBe(200)

      // newsletter_sends should have been updated with status='bounced', bounce_type='Permanent'
      const sendsChain = getTableMock('newsletter_sends')
      expect(sendsChain.update).toHaveBeenCalledWith({
        status: 'bounced',
        bounce_type: 'Permanent',
      })

      // newsletter_subscriptions should have been updated with status='bounced'
      const subsChain = getTableMock('newsletter_subscriptions')
      expect(subsChain.update).toHaveBeenCalledWith({ status: 'bounced' })
    })

    it('soft bounce — updates newsletter_sends with Transient, does NOT update subscription status', async () => {
      setupSendLookup()
      mockProcess.mockResolvedValueOnce([
        {
          messageId: 'ses-bounce-002',
          type: 'bounced',
          timestamp: '2026-04-29T10:10:00Z',
          metadata: { bounceType: 'soft' },
        },
      ])

      const res = await POST(snsNotification())
      expect(res.status).toBe(200)

      // newsletter_sends should have bounce_type='Transient'
      const sendsChain = getTableMock('newsletter_sends')
      expect(sendsChain.update).toHaveBeenCalledWith({
        status: 'bounced',
        bounce_type: 'Transient',
      })

      // newsletter_subscriptions should NOT have been updated (only hard bounces change sub status)
      const subsChain = getTableMock('newsletter_subscriptions')
      expect(subsChain.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: 'bounced' }),
      )
    })

    it('complaint — updates newsletter_sends AND newsletter_subscriptions', async () => {
      setupSendLookup()
      mockProcess.mockResolvedValueOnce([
        {
          messageId: 'ses-complaint-001',
          type: 'complained',
          timestamp: '2026-04-29T10:15:00Z',
        },
      ])

      const res = await POST(snsNotification())
      expect(res.status).toBe(200)

      // newsletter_sends should have status='complained'
      const sendsChain = getTableMock('newsletter_sends')
      expect(sendsChain.update).toHaveBeenCalledWith({ status: 'complained' })

      // newsletter_subscriptions should also have status='complained'
      const subsChain = getTableMock('newsletter_subscriptions')
      expect(subsChain.update).toHaveBeenCalledWith({ status: 'complained' })
    })

    it('delivered — updates newsletter_sends status and delivered_at', async () => {
      setupSendLookup()
      const timestamp = '2026-04-29T10:05:00Z'
      mockProcess.mockResolvedValueOnce([
        {
          messageId: 'ses-del-001',
          type: 'delivered',
          timestamp,
        },
      ])

      const res = await POST(snsNotification())
      expect(res.status).toBe(200)

      const sendsChain = getTableMock('newsletter_sends')
      expect(sendsChain.update).toHaveBeenCalledWith({
        status: 'delivered',
        delivered_at: timestamp,
      })
    })

    it('opened — updates newsletter_sends with opened_at, ip, and user agent when tracking consented', async () => {
      setupSendLookup(FAKE_SEND, true)
      const timestamp = '2026-04-29T10:20:00Z'
      mockProcess.mockResolvedValueOnce([
        {
          messageId: 'ses-open-001',
          type: 'opened',
          timestamp,
          metadata: { ip: '203.0.113.42', userAgent: 'Mozilla/5.0' },
        },
      ])

      const res = await POST(snsNotification())
      expect(res.status).toBe(200)

      const sendsChain = getTableMock('newsletter_sends')
      expect(sendsChain.update).toHaveBeenCalledWith({
        status: 'opened',
        opened_at: timestamp,
        open_ip: '203.0.113.42',
        open_user_agent: 'Mozilla/5.0',
      })
    })

    it('opened — omits PII fields when tracking_consent is false', async () => {
      setupSendLookup(FAKE_SEND, false)
      const timestamp = '2026-04-29T10:21:00Z'
      mockProcess.mockResolvedValueOnce([
        {
          messageId: 'ses-open-002',
          type: 'opened',
          timestamp,
          metadata: { ip: '203.0.113.42', userAgent: 'Mozilla/5.0' },
        },
      ])

      const res = await POST(snsNotification())
      expect(res.status).toBe(200)

      const sendsChain = getTableMock('newsletter_sends')
      expect(sendsChain.update).toHaveBeenCalledWith({
        status: 'opened',
        opened_at: timestamp,
      })
    })

    it('processEvent skips silently when no matching send row found', async () => {
      setupSendLookup(null) // no send found
      mockProcess.mockResolvedValueOnce([
        {
          messageId: 'ses-unknown-001',
          type: 'delivered',
          timestamp: '2026-04-29T10:30:00Z',
        },
      ])

      const res = await POST(snsNotification())
      expect(res.status).toBe(200)

      // newsletter_sends should NOT have been updated
      const sendsChain = getTableMock('newsletter_sends')
      expect(sendsChain.update).not.toHaveBeenCalled()
    })

    it('hard bounce marks newsletter_editions.stats_stale = true', async () => {
      setupSendLookup()
      mockProcess.mockResolvedValueOnce([
        {
          messageId: 'ses-bounce-stale-001',
          type: 'bounced',
          timestamp: '2026-04-29T10:10:00Z',
          metadata: { bounceType: 'hard' },
        },
      ])

      const res = await POST(snsNotification())
      expect(res.status).toBe(200)

      const editionsChain = getTableMock('newsletter_editions')
      expect(editionsChain.update).toHaveBeenCalledWith({ stats_stale: true })
    })
  })
})
