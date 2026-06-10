// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  mockHandleSubscriptionConfirmation,
  mockProcess,
  mockCreateVerify,
  mockCaptureMessage,
  envState,
} = vi.hoisted(() => {
  const mockHandleSubscriptionConfirmation = vi.fn()
  const mockProcess = vi.fn()
  const mockCreateVerify = vi.fn()
  const mockCaptureMessage = vi.fn()
  // Mutable env so individual tests can set SNS_EXPECTED_TOPIC_ARN.
  const envState: { SNS_EXPECTED_TOPIC_ARN: string | undefined } = {
    SNS_EXPECTED_TOPIC_ARN: undefined,
  }
  return {
    mockHandleSubscriptionConfirmation,
    mockProcess,
    mockCreateVerify,
    mockCaptureMessage,
    envState,
  }
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
  // Result the next/each insert resolves to ({ error } shape the route
  // destructures). Defaults to success; tests override to simulate a
  // PostgREST insert failure (e.g. PGRST204).
  _insertResult: { error: { code?: string; message?: string } | null }
  _eqCalls: Array<[string, string]>
  _neqCalls: Array<[string, string]>
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
    _insertResult: { error: null },
    _eqCalls: [],
    _neqCalls: [],
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  }

  // Build a chainable .eq()/.neq() that records calls and returns itself.
  // Mirrors supabase-js: both .eq() and .neq() are chainable filter builders,
  // so the route's `.update(...).eq(...).eq(...).neq('status','unsubscribed')`
  // resolves against a single thenable object.
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
    const neqFn = vi.fn((...args: unknown[]) => {
      chain._neqCalls.push(args as [string, string])
      return eqObj
    })
    eqObj.eq = eqFn
    eqObj.neq = neqFn
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
    // Return a real Promise so both consumers work:
    //   • link_clicks: `const { error } = await supabase...insert(...)`
    //     (destructures the resolved value — defaults to { error: null },
    //     overridable per-table via _insertResult to simulate PGRST204).
    //   • webhook_events: `.insert(...).then(ok, err)` (fire-and-forget).
    return Promise.resolve(chain._insertResult)
  })

  return chain
}

const mockFrom = vi.fn((table: string) => getTableMock(table))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: mockFrom,
  }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: mockCaptureMessage,
}))

vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({ SNS_EXPECTED_TOPIC_ARN: envState.SNS_EXPECTED_TOPIC_ARN }),
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
    mockCaptureMessage.mockReset()
    envState.SNS_EXPECTED_TOPIC_ARN = undefined
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

    it('rejects an unsupported SignatureVersion (1=SHA1 and 2=SHA256 are accepted)', async () => {
      const res = await POST(snsNotification({}, { SignatureVersion: '3' }))
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

    it('rejects SubscriptionConfirmation with invalid signature', async () => {
      // Hardened: an unsigned/invalidly-signed SubscriptionConfirmation must be
      // rejected (401) before the handler runs — otherwise an attacker could
      // forge a SubscribeURL and trigger a blind SSRF confirmation.
      mockCreateVerify.mockReturnValueOnce(invalidVerifier())
      const res = await POST(snsSubscriptionConfirmation())
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('invalid_signature')
      expect(mockHandleSubscriptionConfirmation).not.toHaveBeenCalled()
    })

    it('returns 500 when subscription confirmation fails', async () => {
      mockHandleSubscriptionConfirmation.mockRejectedValueOnce(new Error('bad URL'))
      const res = await POST(snsSubscriptionConfirmation())
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('subscription_failed')
    })
  })

  describe('TopicArn validation', () => {
    it('rejects a Notification whose TopicArn does not match the expected ARN (403)', async () => {
      envState.SNS_EXPECTED_TOPIC_ARN =
        'arn:aws:sns:sa-east-1:999:expected-topic'
      const res = await POST(
        snsNotification(
          {},
          { TopicArn: 'arn:aws:sns:sa-east-1:123:attacker-topic' },
        ),
      )
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('topic_arn_mismatch')
      expect(mockProcess).not.toHaveBeenCalled()
    })

    it('rejects a SubscriptionConfirmation whose TopicArn does not match (403)', async () => {
      envState.SNS_EXPECTED_TOPIC_ARN =
        'arn:aws:sns:sa-east-1:999:expected-topic'
      const res = await POST(
        snsSubscriptionConfirmation({
          TopicArn: 'arn:aws:sns:sa-east-1:123:attacker-topic',
        }),
      )
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('topic_arn_mismatch')
      expect(mockHandleSubscriptionConfirmation).not.toHaveBeenCalled()
    })

    it('accepts a Notification whose TopicArn matches the expected ARN', async () => {
      envState.SNS_EXPECTED_TOPIC_ARN =
        'arn:aws:sns:sa-east-1:123:ses-bythiago-events'
      const res = await POST(snsNotification())
      expect(res.status).toBe(200)
      expect(mockProcess).toHaveBeenCalledOnce()
    })

    it('stays non-breaking (200) but warns when SNS_EXPECTED_TOPIC_ARN is unset in production', async () => {
      // Hardening is opt-in: an unset ARN must NOT break the webhook (that would
      // silently drop bounce/complaint/delivery handling). It still processes
      // the already signature-verified event and emits a warning to opt in.
      envState.SNS_EXPECTED_TOPIC_ARN = undefined
      const prevVercelEnv = process.env.VERCEL_ENV
      process.env.VERCEL_ENV = 'production'
      try {
        const res = await POST(snsNotification())
        expect(res.status).toBe(200)
        expect(mockProcess).toHaveBeenCalledOnce()
        expect(mockCaptureMessage).toHaveBeenCalledWith(
          expect.stringContaining('SNS_EXPECTED_TOPIC_ARN unset'),
          expect.objectContaining({ level: 'warning' }),
        )
      } finally {
        process.env.VERCEL_ENV = prevVercelEnv
      }
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

      // GLOBAL suppression: the suppression update is scoped by email + site_id
      // (NOT by newsletter_id) and excludes already-unsubscribed rows, so every
      // non-unsubscribed list for this subscriber on this site is suppressed.
      expect(subsChain._eqCalls).toContainEqual(['email', 'alice@example.com'])
      expect(subsChain._eqCalls).toContainEqual(['site_id', 'site-001'])
      expect(
        subsChain._eqCalls.some(([col]) => col === 'newsletter_id'),
      ).toBe(false)
      expect(subsChain._neqCalls).toContainEqual(['status', 'unsubscribed'])
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

      // GLOBAL suppression: scoped by email + site_id (NOT newsletter_id),
      // excluding already-unsubscribed rows.
      expect(subsChain._eqCalls).toContainEqual(['email', 'alice@example.com'])
      expect(subsChain._eqCalls).toContainEqual(['site_id', 'site-001'])
      expect(
        subsChain._eqCalls.some(([col]) => col === 'newsletter_id'),
      ).toBe(false)
      expect(subsChain._neqCalls).toContainEqual(['status', 'unsubscribed'])
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

    it('opened — fail-closed: omits PII when subscription row is missing (data:null)', async () => {
      // newsletter_sends resolves, but the subscription lookup returns no row.
      // trackPii must be false (fail-closed) — never default to tracking when
      // the consent record was erased/never existed.
      const sendsChain = getTableMock('newsletter_sends')
      sendsChain.select.mockImplementation(() => {
        const obj: Record<string, unknown> = {
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: FAKE_SEND, error: null }),
        }
        obj.eq = vi.fn(() => obj)
        return obj
      })
      const subsChain = getTableMock('newsletter_subscriptions')
      subsChain.select.mockImplementation(() => {
        const obj: Record<string, unknown> = {
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
        obj.eq = vi.fn(() => obj)
        return obj
      })

      const timestamp = '2026-04-29T10:22:00Z'
      mockProcess.mockResolvedValueOnce([
        {
          messageId: 'ses-open-003',
          type: 'opened',
          timestamp,
          metadata: { ip: '203.0.113.42', userAgent: 'Mozilla/5.0' },
        },
      ])

      const res = await POST(snsNotification())
      expect(res.status).toBe(200)

      // PII fields must be absent — only status + opened_at written.
      expect(sendsChain.update).toHaveBeenCalledWith({
        status: 'opened',
        opened_at: timestamp,
      })
    })

    it('clicked — legacy send: never inserts into newsletter_click_events, emits Sentry warning', async () => {
      // link_rewrite_enabled false => genuinely legacy path. Must NOT write to
      // the broken (non-updatable) newsletter_click_events view; instead emit a
      // Sentry warning and rely on clicked_at already recorded on the send.
      setupSendLookup({ ...FAKE_SEND, link_rewrite_enabled: false }, true)
      mockProcess.mockResolvedValueOnce([
        {
          messageId: 'ses-click-legacy-001',
          type: 'clicked',
          timestamp: '2026-04-29T10:25:00Z',
          metadata: {
            url: 'https://bythiagofigueiredo.com/blog/post',
            ip: '203.0.113.42',
            userAgent: 'Mozilla/5.0',
          },
        },
      ])

      const res = await POST(snsNotification())
      expect(res.status).toBe(200)

      // newsletter_sends still gets clicked status
      const sendsChain = getTableMock('newsletter_sends')
      expect(sendsChain.update).toHaveBeenCalledWith({
        status: 'clicked',
        clicked_at: '2026-04-29T10:25:00Z',
      })

      // The broken view must never receive an insert.
      const clickEventsChain = getTableMock('newsletter_click_events')
      expect(clickEventsChain.insert).not.toHaveBeenCalled()

      // Loss is made visible via a Sentry warning.
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        expect.stringContaining('legacy newsletter click'),
        expect.objectContaining({ level: 'warning' }),
      )
    })

    it('clicked — unified send with missing tracked_link: does NOT synthesize a tracked_link or insert link_clicks; warns', async () => {
      // link_rewrite_enabled true, but the tracked_links lookup resolves empty.
      // A unified send creates its tracked_link (with a NOT NULL generated `code`)
      // at send time, so a miss is an edge case — we must NOT upsert a tracked_link
      // (it would violate NOT NULL code / the (site_id,code) unique), must NOT
      // insert link_clicks (no link_id), and must NOT touch the broken view.
      setupSendLookup({ ...FAKE_SEND, link_rewrite_enabled: true }, true)

      const trackedChain = getTableMock('tracked_links')
      trackedChain.select.mockImplementation(() => {
        const obj: Record<string, unknown> = {
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
        obj.eq = vi.fn(() => obj)
        return obj
      })
      ;(trackedChain as unknown as { upsert: ReturnType<typeof vi.fn> }).upsert =
        vi.fn()

      mockProcess.mockResolvedValueOnce([
        {
          messageId: 'ses-click-unified-001',
          type: 'clicked',
          timestamp: '2026-04-29T10:26:00Z',
          metadata: {
            url: 'https://bythiagofigueiredo.com/blog/post',
            ip: '203.0.113.42',
            userAgent: 'Mozilla/5.0',
          },
        },
      ])

      const res = await POST(snsNotification())
      expect(res.status).toBe(200)

      // No tracked_link synthesized, no link_clicks insert, no view insert.
      expect(
        (trackedChain as unknown as { upsert: ReturnType<typeof vi.fn> }).upsert,
      ).not.toHaveBeenCalled()
      expect(getTableMock('link_clicks').insert).not.toHaveBeenCalled()
      expect(getTableMock('newsletter_click_events').insert).not.toHaveBeenCalled()

      // The per-link attribution skip is surfaced via Sentry warning.
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        expect.stringContaining('no tracked_link for destination'),
        expect.objectContaining({ level: 'warning' }),
      )
    })

    it('clicked — unified send with resolved tracked_link: inserts a real link_clicks row (link_id + site_id + clicked_at, NO source_type/source_id)', async () => {
      // Positive persistence path: link_rewrite_enabled true and the
      // tracked_links lookup returns a row → recordLinkClick must insert into
      // link_clicks with the REAL schema. This guards the fixed bug where the
      // helper inserted source_type/source_id (non-existent) and omitted the
      // NOT NULL site_id, silently dropping every newsletter click.
      setupSendLookup({ ...FAKE_SEND, link_rewrite_enabled: true }, true)

      const trackedChain = getTableMock('tracked_links')
      trackedChain.select.mockImplementation(() => {
        const obj: Record<string, unknown> = {
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: { id: 'tl-001' }, error: null }),
        }
        obj.eq = vi.fn(() => obj)
        return obj
      })

      const timestamp = '2026-04-29T10:27:00Z'
      mockProcess.mockResolvedValueOnce([
        {
          messageId: 'ses-click-unified-ok-001',
          type: 'clicked',
          timestamp,
          metadata: {
            url: 'https://bythiagofigueiredo.com/blog/post',
            ip: '203.0.113.42',
            userAgent: 'Mozilla/5.0',
          },
        },
      ])

      const res = await POST(snsNotification())
      expect(res.status).toBe(200)

      // A row actually lands in link_clicks.
      const clicksChain = getTableMock('link_clicks')
      expect(clicksChain.insert).toHaveBeenCalledOnce()

      const payload = clicksChain._lastInsert as Record<string, unknown>
      expect(payload).toMatchObject({
        link_id: 'tl-001',
        site_id: 'site-001',
        clicked_at: timestamp,
      })
      // The columns that caused the silent PGRST204 failure must be absent.
      expect(payload).not.toHaveProperty('source_type')
      expect(payload).not.toHaveProperty('source_id')

      // The broken view must never receive an insert.
      const clickEventsChain = getTableMock('newsletter_click_events')
      expect(clickEventsChain.insert).not.toHaveBeenCalled()
    })

    it('clicked — link_clicks insert failure (PGRST204) is surfaced via a Sentry warning, not swallowed', async () => {
      // Negative path: even on the resolved-tracked_link branch, if the
      // link_clicks insert returns an error the loss must be made visible
      // (Sentry warning) instead of silently lost.
      setupSendLookup({ ...FAKE_SEND, link_rewrite_enabled: true }, true)

      const trackedChain = getTableMock('tracked_links')
      trackedChain.select.mockImplementation(() => {
        const obj: Record<string, unknown> = {
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: { id: 'tl-002' }, error: null }),
        }
        obj.eq = vi.fn(() => obj)
        return obj
      })

      // Make the link_clicks insert resolve with an error.
      const clicksChain = getTableMock('link_clicks')
      clicksChain._insertResult = {
        error: { code: 'PGRST204', message: "column not found" },
      }

      mockProcess.mockResolvedValueOnce([
        {
          messageId: 'ses-click-unified-err-001',
          type: 'clicked',
          timestamp: '2026-04-29T10:28:00Z',
          metadata: {
            url: 'https://bythiagofigueiredo.com/blog/post',
            ip: '203.0.113.42',
            userAgent: 'Mozilla/5.0',
          },
        },
      ])

      const res = await POST(snsNotification())
      expect(res.status).toBe(200)

      // Insert was attempted but failed → warning emitted.
      expect(clicksChain.insert).toHaveBeenCalledOnce()
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        expect.stringContaining('failed to record newsletter click into link_clicks'),
        expect.objectContaining({ level: 'warning' }),
      )
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
