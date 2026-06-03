import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { fromMock, rpcMock, sendMock, captureServerActionErrorSpy, getSiteContextMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  sendMock: vi.fn().mockResolvedValue(undefined),
  captureServerActionErrorSpy: vi.fn(),
  getSiteContextMock: vi.fn(),
}))

// ─── Module mocks (paths relative to test file → resolve to same module) ────

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}))

vi.mock('next/headers', () => ({
  headers: () =>
    Promise.resolve({
      get: (key: string) => {
        if (key === 'x-forwarded-for') return '127.0.0.1'
        return null
      },
    }),
}))

vi.mock('../../../lib/turnstile', () => ({
  verifyTurnstileToken: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../../lib/email/service', () => ({
  getEmailService: () => ({ send: sendMock }),
}))

vi.mock('../../../lib/cms/site-context', () => ({
  getSiteContext: getSiteContextMock,
}))

vi.mock('../../../lib/request-ip', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  isValidInet: vi.fn().mockReturnValue(true),
}))

vi.mock('../../../src/lib/sentry-wrap', () => ({
  captureServerActionError: captureServerActionErrorSpy,
}))

// consent: pass-through to real constant
vi.mock('../../../src/app/newsletter/consent', async () => {
  const actual = await vi.importActual<
    typeof import('../../../src/app/newsletter/consent')
  >('../../../src/app/newsletter/consent')
  return { NEWSLETTER_CONSENT_VERSION: actual.NEWSLETTER_CONSENT_VERSION }
})

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { subscribeToNewsletter } from '../../../src/app/newsletter/subscribe/actions'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v)
  }
  return fd
}

const VALID_FIELDS = {
  email: 'user@example.com',
  consent_processing: 'on',
  consent_marketing: 'on',
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  // Re-apply default mock implementations after clearAllMocks
  getSiteContextMock.mockResolvedValue({
    siteId: 'site-1',
    orgId: 'org-1',
    defaultLocale: 'pt-BR',
  })
  rpcMock.mockResolvedValue({ data: true, error: null })
  sendMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('subscribeToNewsletter', () => {
  it('returns invalid_email for malformed email', async () => {
    const fd = makeFormData({ ...VALID_FIELDS, email: 'not-an-email' })
    const result = await subscribeToNewsletter(fd)
    expect(result).toEqual({ status: 'error', code: 'invalid_email' })
  })

  it('returns consent_required when consent is missing', async () => {
    const fd = makeFormData({ email: 'user@example.com' })
    const result = await subscribeToNewsletter(fd)
    expect(result).toEqual({ status: 'error', code: 'consent_required' })
  })

  it('happy path: new subscription returns ok and sends confirm email', async () => {
    const notFoundChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    fromMock
      // select existing by email -> not found
      .mockReturnValueOnce(notFoundChain)
      // select existing by hash -> not found
      .mockReturnValueOnce(notFoundChain)
      // insert -> success
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      })

    const fd = makeFormData(VALID_FIELDS)
    const result = await subscribeToNewsletter(fd)

    expect(result).toEqual({ status: 'ok' })
    expect(sendMock).toHaveBeenCalledOnce()

    // Confirm URL must contain the /newsletter/confirm/ path
    const callArgs = sendMock.mock.calls[0]![0] as { html: string }
    expect(callArgs.html).toContain('/newsletter/confirm/')
  })

  it('falls back to localhost:3000 when NEXT_PUBLIC_APP_URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL

    const notFoundChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    fromMock
      .mockReturnValueOnce(notFoundChain)
      .mockReturnValueOnce(notFoundChain)
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      })

    const fd = makeFormData(VALID_FIELDS)
    await subscribeToNewsletter(fd)

    expect(sendMock).toHaveBeenCalledOnce()
    const callArgs = sendMock.mock.calls[0]![0] as { html: string }
    expect(callArgs.html).toContain('http://localhost:3000')
  })

  it('returns ok (stealth, no oracle) when rate-limited', async () => {
    rpcMock.mockResolvedValueOnce({ data: false, error: null })

    const fd = makeFormData(VALID_FIELDS)
    const result = await subscribeToNewsletter(fd)

    expect(result).toEqual({ status: 'ok' })
    // Must NOT send email or touch DB further
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('returns ok without sending email when already confirmed', async () => {
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'sub-1', status: 'confirmed', email: 'user@example.com' },
        error: null,
      }),
    })

    const fd = makeFormData(VALID_FIELDS)
    const result = await subscribeToNewsletter(fd)

    expect(result).toEqual({ status: 'ok' })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('rotates token and resends confirm email for existing pending subscription', async () => {
    const updateMock = vi.fn().mockReturnThis()
    const updateEqMock = vi.fn().mockResolvedValue({ data: null, error: null })

    fromMock
      // select by email -> pending found
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'sub-2', status: 'pending_confirmation', email: 'user@example.com' },
          error: null,
        }),
      })
      // update -> eq chain
      .mockReturnValueOnce({
        update: updateMock,
        eq: updateEqMock,
      })

    const fd = makeFormData(VALID_FIELDS)
    const result = await subscribeToNewsletter(fd)

    expect(result).toEqual({ status: 'ok' })
    expect(updateMock).toHaveBeenCalledOnce()
    expect(sendMock).toHaveBeenCalledOnce()

    const payload = updateMock.mock.calls[0]![0] as Record<string, unknown>
    expect(payload.status).toBe('pending_confirmation')
    expect(payload.confirmation_token_hash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/))
  })

  it('returns db_error when update fails', async () => {
    const updateMock = vi.fn().mockReturnThis()
    const updateEqMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'timeout', code: '57014' } })

    fromMock
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'sub-2', status: 'pending_confirmation', email: 'user@example.com' },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        update: updateMock,
        eq: updateEqMock,
      })

    const fd = makeFormData(VALID_FIELDS)
    const result = await subscribeToNewsletter(fd)

    expect(result).toEqual({ status: 'error', code: 'db_error' })
    expect(sendMock).not.toHaveBeenCalled()
    expect(captureServerActionErrorSpy).toHaveBeenCalled()
  })

  it('returns email_failed error when email send fails', async () => {
    const notFoundChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    fromMock
      .mockReturnValueOnce(notFoundChain)
      .mockReturnValueOnce(notFoundChain)
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      })
    sendMock.mockRejectedValueOnce(new Error('SMTP timeout'))

    const fd = makeFormData(VALID_FIELDS)
    const result = await subscribeToNewsletter(fd)

    expect(result).toEqual({ status: 'error', code: 'email_failed' })
  })

  it('catches unexpected errors via outer try/catch', async () => {
    getSiteContextMock.mockRejectedValueOnce(new Error('network failure'))

    const fd = makeFormData(VALID_FIELDS)
    const result = await subscribeToNewsletter(fd)

    expect(result).toEqual({ status: 'error', code: 'internal' })
    expect(captureServerActionErrorSpy).toHaveBeenCalled()
  })
})
