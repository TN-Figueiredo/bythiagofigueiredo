// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── End-to-end SES delivery webhook test ─────────────────────────────────
// Unlike ses.test.ts (which mocks SesWebhookProcessor), this suite runs the
// REAL processor from @tn-figueiredo/email/webhooks against a realistic SNS
// Notification envelope wrapping a realistic SES `Delivery` event — the exact
// shape AWS POSTs to /api/webhooks/ses in production. Only the cryptographic
// signature check is stubbed (we don't hold AWS's SNS signing key); everything
// from body parsing → SNS envelope validation → SES event parsing →
// provider_message_id lookup → newsletter_sends update is exercised for real.
//
// Context: prod incident 2026-06 — newsletter_sends rows stayed status='sent'
// with delivered_at NULL forever. Root cause was AWS-side (no SES config-set
// event destination → SNS → webhook wiring), NOT a handler bug. This test
// pins the handler's correctness so the code path can be ruled out instantly
// next time delivery tracking looks dead.

const { mockCreateVerify, mockCaptureMessage } = vi.hoisted(() => ({
  mockCreateVerify: vi.fn(),
  mockCaptureMessage: vi.fn(),
}))

// NOTE: @tn-figueiredo/email/webhooks is intentionally NOT mocked — the
// `svix` optional peer dep it imports is stubbed via vitest.config.ts alias
// (same pattern as `resend`/`nodemailer`).

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>()
  return { ...actual, createVerify: mockCreateVerify }
})

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: mockCaptureMessage,
}))

vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({ SNS_EXPECTED_TOPIC_ARN: undefined }),
}))

// ── Table-aware Supabase mock (same pattern as ses.test.ts) ──────────────
type MockChain = {
  select: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  _lastUpdate: Record<string, unknown> | null
  _lastInsert: Record<string, unknown> | null
  _eqCalls: Array<[string, unknown]>
}

const tableMocks = new Map<string, MockChain>()

function getTableMock(table: string): MockChain {
  let chain = tableMocks.get(table)
  if (!chain) {
    chain = createTableChain()
    tableMocks.set(table, chain)
  }
  return chain
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

  const makeEqChain = () => {
    const eqObj: Record<string, unknown> = {
      data: null,
      error: null,
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const eqFn = vi.fn((...args: unknown[]) => {
      chain._eqCalls.push(args as [string, unknown])
      return eqObj
    })
    eqObj.eq = eqFn
    eqObj.neq = eqFn
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
    return Promise.resolve({ error: null })
  })

  return chain
}

const mockFrom = vi.fn((table: string) => getTableMock(table))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

import { POST } from '../../../src/app/api/webhooks/ses/route'

// ── Realistic fixtures ────────────────────────────────────────────────────
// SES MessageId in the exact format prod stores in provider_message_id
// (sa-east-1 SESv2): 16-hex prefix + uuid + '-000000'.
const SES_MESSAGE_ID =
  '0103019ea382357e-f67dcc04-f114-4d37-8b0b-6cef219a25f9-000000'
const SNS_MESSAGE_ID = '9d4ec8a1-7a17-5a4b-b1c2-5f3d2e8a9b01'
const MAIL_TIMESTAMP = '2026-06-07T19:14:37.886Z'

// Realistic SES event-publishing payload (configuration-set event destination
// → SNS), per AWS docs: eventType + mail + delivery objects.
const sesDeliveryEvent = {
  eventType: 'Delivery',
  mail: {
    timestamp: MAIL_TIMESTAMP,
    messageId: SES_MESSAGE_ID,
    source: 'Thiago Figueiredo <newsletter@bythiagofigueiredo.com>',
    sourceArn:
      'arn:aws:ses:sa-east-1:793477410088:identity/bythiagofigueiredo.com',
    sendingAccountId: '793477410088',
    destination: ['bythiagofigueiredo@gmail.com'],
    tags: { 'ses:configuration-set': ['bythiago-marketing'] },
  },
  delivery: {
    timestamp: '2026-06-07T19:14:39.123Z',
    processingTimeMillis: 1237,
    recipients: ['bythiagofigueiredo@gmail.com'],
    smtpResponse: '250 2.0.0 OK',
    reportingMTA: 'a8-50.smtp-out.amazonses.com',
  },
}

function snsDeliveryNotification(): Request {
  return new Request('https://bythiagofigueiredo.com/api/webhooks/ses', {
    method: 'POST',
    headers: { 'content-type': 'text/plain; charset=UTF-8' },
    body: JSON.stringify({
      Type: 'Notification',
      MessageId: SNS_MESSAGE_ID,
      TopicArn: 'arn:aws:sns:sa-east-1:793477410088:ses-bythiago-events',
      Message: JSON.stringify(sesDeliveryEvent),
      Timestamp: '2026-06-07T19:14:39.500Z',
      SignatureVersion: '1',
      Signature: 'ZmFrZS1zaWduYXR1cmU=',
      SigningCertURL:
        'https://sns.sa-east-1.amazonaws.com/SimpleNotificationService-9c6465fa7f48f5cacd23014631ec1136.pem',
      UnsubscribeURL:
        'https://sns.sa-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:sa-east-1:793477410088:ses-bythiago-events:abc',
    }),
  })
}

const originalFetch = globalThis.fetch
const mockFetch = vi.fn()

describe('POST /api/webhooks/ses — end-to-end Delivery event (real processor)', () => {
  beforeEach(() => {
    tableMocks.clear()
    mockFrom.mockClear()
    mockCaptureMessage.mockReset()
    mockCreateVerify.mockReset().mockReturnValue({
      update: vi.fn(),
      verify: vi.fn().mockReturnValue(true),
    })
    mockFetch.mockReset().mockResolvedValue({
      text: () =>
        Promise.resolve(
          '-----BEGIN CERTIFICATE-----\nFAKE\n-----END CERTIFICATE-----',
        ),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function setupSendRow() {
    const sendsChain = getTableMock('newsletter_sends')
    const sendRow = {
      id: 'send-001',
      edition_id: 'ed-001',
      subscriber_email: 'bythiagofigueiredo@gmail.com',
      link_rewrite_enabled: true,
      newsletter_editions: {
        site_id: 'site-001',
        newsletter_type_id: 'nl-type-001',
      },
    }
    sendsChain.select.mockImplementation(() => {
      const obj: Record<string, unknown> = {
        maybeSingle: vi.fn().mockResolvedValue({ data: sendRow, error: null }),
      }
      obj.eq = vi.fn((...args: unknown[]) => {
        sendsChain._eqCalls.push(args as [string, unknown])
        return obj
      })
      return obj
    })
    return sendsChain
  }

  it('maps a realistic SNS-wrapped SES Delivery event into a newsletter_sends update', async () => {
    const sendsChain = setupSendRow()

    const res = await POST(snsDeliveryNotification())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.dedup).toBeUndefined()

    // The send row is looked up by the SES mail.messageId — the exact value
    // the cron stored in provider_message_id at send time.
    expect(sendsChain._eqCalls).toContainEqual([
      'provider_message_id',
      SES_MESSAGE_ID,
    ])

    // status='sent' → 'delivered' with delivered_at = mail.timestamp.
    expect(sendsChain.update).toHaveBeenCalledWith({
      status: 'delivered',
      delivered_at: MAIL_TIMESTAMP,
    })
    // ...scoped to the matched row.
    expect(sendsChain._eqCalls).toContainEqual(['id', 'send-001'])

    // Edition stats are flagged stale for the aggregation sweep.
    const editionsChain = getTableMock('newsletter_editions')
    expect(editionsChain.update).toHaveBeenCalledWith({ stats_stale: true })
    expect(editionsChain._eqCalls).toContainEqual(['id', 'ed-001'])

    // Idempotency record keyed on the SNS MessageId (dedup for SNS retries).
    const webhookChain = getTableMock('webhook_events')
    expect(webhookChain._lastInsert).toMatchObject({
      idempotency_key: SNS_MESSAGE_ID,
      event_type: 'delivered',
    })
  })

  it('does not touch newsletter_sends when no row matches the messageId (event for unknown send)', async () => {
    // Default table mock: maybeSingle resolves { data: null } → no send row.
    const res = await POST(snsDeliveryNotification())
    expect(res.status).toBe(200)

    const sendsChain = getTableMock('newsletter_sends')
    expect(sendsChain.update).not.toHaveBeenCalled()

    // Still records idempotency so SNS retries of the same MessageId dedup.
    const webhookChain = getTableMock('webhook_events')
    expect(webhookChain._lastInsert).toMatchObject({
      idempotency_key: SNS_MESSAGE_ID,
    })
  })
})
