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

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ data: null, error: null }),
      }),
      insert: vi.fn().mockReturnValue({
        then: (ok?: () => void) => { ok?.(); return Promise.resolve() },
      }),
    })),
  }),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

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
      maybeSingleMock.mockResolvedValueOnce({ data: { id: 'existing' }, error: null })
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
})
