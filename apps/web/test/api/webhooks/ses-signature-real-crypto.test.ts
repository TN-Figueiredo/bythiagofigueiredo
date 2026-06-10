// REAL-crypto regression test for the SNS signature verification.
//
// Every other webhook test stubs `crypto`, which is exactly how the production bug
// hid: `createVerify('SHA1withRSA')` (a JAVA algorithm name, invalid in Node) THREW
// "Invalid digest" on every call, the caller's `.catch(() => false)` turned that into
// a 401 for EVERY SNS message — so no event was ever recorded and new subscriptions
// could never confirm. This suite signs realistic SNS envelopes with a real RSA key
// and asserts the route's verification path accepts them (and rejects tampering),
// with NO crypto stubbing.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateKeyPairSync, createSign } from 'crypto'

// Mock ONLY supabase + sentry + server env — never crypto.
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/env', () => ({ getServerEnv: () => ({ SNS_EXPECTED_TOPIC_ARN: undefined }) }))

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { POST } from '@/app/api/webhooks/ses/route'

// Self-signed-ish: we only need a cert PEM whose public key matches our private key.
// `crypto.verify` accepts a public key PEM where a certificate is expected, so we use
// the public key directly as the "cert" body served from the mocked cert URL.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }) as string

const CERT_URL = 'https://sns.sa-east-1.amazonaws.com/SimpleNotificationService-test.pem'

function signedNotification(overrides: Record<string, string> = {}): Record<string, string> {
  const base: Record<string, string> = {
    Type: 'Notification',
    MessageId: 'real-crypto-test-1',
    TopicArn: 'arn:aws:sns:sa-east-1:793477410088:ses-bythiago-events',
    Message: 'ping',
    Timestamp: '2026-06-10T20:00:00.000Z',
    SignatureVersion: '1',
    SigningCertURL: CERT_URL,
    ...overrides,
  }
  const fields = ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
  const stringToSign = fields
    .filter((f) => base[f] !== undefined)
    .map((f) => `${f}\n${base[f]}\n`)
    .join('')
  const signer = createSign(base.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1')
  signer.update(stringToSign)
  base.Signature = signer.sign(privateKey, 'base64')
  return base
}

function mockSupabase() {
  // webhook_events dedup select → none; insert → ok. processor.process('ping') will
  // throw/no-op depending on the package — we only need the request to clear the
  // signature gate, so a minimal chain suffices.
  const chain: Record<string, unknown> = {}
  const self = () => chain
  Object.assign(chain, {
    select: vi.fn(self), eq: vi.fn(self), maybeSingle: vi.fn(async () => ({ data: null })),
    insert: vi.fn(() => ({ then: (res: (v: unknown) => void) => res({}) })),
    update: vi.fn(self), in: vi.fn(self), single: vi.fn(async () => ({ data: null })),
  })
  return { from: vi.fn(() => chain) }
}

function makeReq(body: unknown): Request {
  return new Request('https://example.com/api/webhooks/ses', {
    method: 'POST',
    headers: { 'content-type': 'text/plain; charset=UTF-8' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase() as never)
  // Serve our public key from the (regex-valid) cert URL.
  vi.stubGlobal('fetch', vi.fn(async () => new Response(publicPem)))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('SNS signature verification — REAL crypto (no stubs)', () => {
  it('accepts a genuinely RSA-SHA1-signed Notification (SignatureVersion 1)', async () => {
    const res = await POST(makeReq(signedNotification()))
    // Anything but 401 means the signature gate passed (the 'ping' Message is not a
    // valid SES event, so the route may 200-noop or 500 in process — both prove the
    // verification itself worked; the production bug 401'd EVERYTHING).
    expect(res.status).not.toBe(401)
  })

  it('accepts a genuinely RSA-SHA256-signed Notification (SignatureVersion 2)', async () => {
    const res = await POST(makeReq(signedNotification({ SignatureVersion: '2', MessageId: 'real-crypto-test-2' })))
    expect(res.status).not.toBe(401)
  })

  it('rejects a tampered payload (Message changed after signing)', async () => {
    const msg = signedNotification({ MessageId: 'real-crypto-test-3' })
    msg.Message = 'tampered'
    const res = await POST(makeReq(msg))
    expect(res.status).toBe(401)
  })

  it('rejects an unsupported SignatureVersion', async () => {
    const res = await POST(makeReq(signedNotification({ SignatureVersion: '3', MessageId: 'real-crypto-test-4' })))
    expect(res.status).toBe(401)
  })
})
