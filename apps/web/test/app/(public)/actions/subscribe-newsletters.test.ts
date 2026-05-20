import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ------------------------------------------------------------------ */
/*  Mocks — vi.hoisted ensures these are available in vi.mock factories */
/* ------------------------------------------------------------------ */

const {
  mockRateCheck,
  mockInsert,
  mockFrom,
  mockSend,
  mockCaptureException,
} = vi.hoisted(() => ({
  mockRateCheck: vi.fn(),
  mockInsert: vi.fn(),
  mockFrom: vi.fn(),
  mockSend: vi.fn(),
  mockCaptureException: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(
    new Headers({
      'x-forwarded-for': '203.0.113.42, 10.0.0.1',
      'user-agent': 'TestAgent/1.0',
    }),
  ),
}))

vi.mock('../../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    rpc: mockRateCheck,
    from: mockFrom,
  })),
}))

vi.mock('../../../../lib/email/service', () => ({
  getEmailService: () => ({ send: mockSend }),
}))

vi.mock('../../../../lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'test-site-uuid', orgId: 'org-1', defaultLocale: 'pt-BR' }),
}))

vi.mock('../../../../lib/turnstile', () => ({
  verifyTurnstileToken: vi.fn().mockResolvedValue(true),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
}))

vi.mock('@/lib/newsletter/suggestions', () => ({
  getFilteredSuggestionsForSubscriber: vi.fn().mockResolvedValue([]),
}))

/* ------------------------------------------------------------------ */
/*  Import SUT after mocks are in place                               */
/* ------------------------------------------------------------------ */

import { subscribeToNewsletters, getPostSubscribeSuggestions } from '../../../../src/app/(public)/actions/subscribe-newsletters'

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('subscribeToNewsletters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore happy-path defaults
    mockRateCheck.mockResolvedValue({ data: true, error: null })
    mockInsert.mockResolvedValue({ data: { id: 'sub-1' }, error: null })
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockSend.mockResolvedValue({ messageId: 'msg-1', provider: 'ses' })
    // Ensure Turnstile env var is NOT set by default (skip verification path)
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    process.env.NEXT_PUBLIC_APP_URL = 'https://bythiagofigueiredo.com'
  })

  /* ====== Validation ====== */

  it('returns error for invalid email (en)', async () => {
    const result = await subscribeToNewsletters('not-an-email', ['nl-1'], 'en')
    expect(result.error).toBe('Invalid email.')
    expect(result.success).toBeUndefined()
  })

  it('returns error for invalid email (pt-BR)', async () => {
    const result = await subscribeToNewsletters('bad@@email', ['nl-1'], 'pt-BR')
    expect(result.error).toBe('E-mail inválido.')
  })

  it('returns error for empty newsletter_ids', async () => {
    const result = await subscribeToNewsletters('user@example.com', [], 'en')
    expect(result.error).toBe('Invalid email.')
  })

  it('returns error for too many newsletter_ids (>8)', async () => {
    const ids = Array.from({ length: 9 }, (_, i) => `nl-${i}`)
    const result = await subscribeToNewsletters('user@example.com', ids, 'en')
    expect(result.error).toBe('Invalid email.')
  })

  /* ====== Happy path ====== */

  it('returns success with subscribedIds for valid subscription', async () => {
    const result = await subscribeToNewsletters('user@example.com', ['nl-1', 'nl-2'], 'en')
    expect(result).toEqual({
      success: true,
      subscribedIds: ['nl-1', 'nl-2'],
    })
  })

  it('sends confirmation email on successful subscription', async () => {
    await subscribeToNewsletters('user@example.com', ['nl-1'], 'en')
    expect(mockSend).toHaveBeenCalledOnce()
    const sendArg = mockSend.mock.calls[0][0]
    expect(sendArg.to).toBe('user@example.com')
    expect(sendArg.subject).toBe('Confirm your subscription')
  })

  it('sends pt-BR confirmation email when locale is pt-BR', async () => {
    await subscribeToNewsletters('user@example.com', ['nl-1'], 'pt-BR')
    expect(mockSend).toHaveBeenCalledOnce()
    const sendArg = mockSend.mock.calls[0][0]
    expect(sendArg.subject).toBe('Confirme sua inscrição')
  })

  /* ====== CRITICAL: Confirmation URL format ====== */

  it('confirmation URL uses path segment /newsletter/confirm/{token}, NOT query param', async () => {
    await subscribeToNewsletters('user@example.com', ['nl-1'], 'en')
    expect(mockSend).toHaveBeenCalledOnce()
    const html = mockSend.mock.calls[0][0].html as string
    // Must contain path-based URL: /newsletter/confirm/<hex-token>
    expect(html).toMatch(/\/newsletter\/confirm\/[a-f0-9]{64}/)
    // Must NOT use query param format
    expect(html).not.toMatch(/\?token=/)
  })

  it('confirmation URL includes locale prefix for pt-BR', async () => {
    await subscribeToNewsletters('user@example.com', ['nl-1'], 'pt-BR')
    const html = mockSend.mock.calls[0][0].html as string
    expect(html).toMatch(/https:\/\/bythiagofigueiredo\.com\/pt\/newsletter\/confirm\/[a-f0-9]{64}/)
  })

  it('confirmation URL has no locale prefix for en', async () => {
    await subscribeToNewsletters('user@example.com', ['nl-1'], 'en')
    const html = mockSend.mock.calls[0][0].html as string
    // Should be /newsletter/confirm/{token} with NO /pt or /en prefix
    expect(html).toMatch(/https:\/\/bythiagofigueiredo\.com\/newsletter\/confirm\/[a-f0-9]{64}/)
    expect(html).not.toMatch(/\/en\/newsletter\/confirm/)
  })

  /* ====== Rate limiting ====== */

  it('returns rate-limited error when RPC returns false (en)', async () => {
    mockRateCheck.mockResolvedValueOnce({ data: false, error: null })
    const result = await subscribeToNewsletters('user@example.com', ['nl-1'], 'en')
    expect(result.error).toBe('Too many attempts. Try again later.')
    expect(result.success).toBeUndefined()
  })

  it('returns rate-limited error when RPC returns false (pt-BR)', async () => {
    mockRateCheck.mockResolvedValueOnce({ data: false, error: null })
    const result = await subscribeToNewsletters('user@example.com', ['nl-1'], 'pt-BR')
    expect(result.error).toBe('Muitas tentativas. Tente novamente em breve.')
  })

  it('rate check passes all 3 required params: p_site_id, p_ip, p_email', async () => {
    await subscribeToNewsletters('user@example.com', ['nl-1'], 'en')
    expect(mockRateCheck).toHaveBeenCalledWith('newsletter_rate_check', {
      p_site_id: 'test-site-uuid',
      p_ip: '203.0.113.42',
      p_email: 'user@example.com',
    })
  })

  /* ====== IP extraction ====== */

  it('extracts first IP from x-forwarded-for header', async () => {
    await subscribeToNewsletters('user@example.com', ['nl-1'], 'en')
    // The insert call should have ip = first IP from XFF
    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.ip).toBe('203.0.113.42')
  })

  it('passes user-agent from headers to insert', async () => {
    await subscribeToNewsletters('user@example.com', ['nl-1'], 'en')
    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.user_agent).toBe('TestAgent/1.0')
  })

  /* ====== Duplicate insert handling ====== */

  it('treats duplicate insert as success (does not fail)', async () => {
    mockInsert.mockResolvedValue({
      data: null,
      error: { message: 'duplicate key value violates unique constraint "newsletter_subscriptions_pkey"', code: '23505' },
    })
    const result = await subscribeToNewsletters('user@example.com', ['nl-1'], 'en')
    expect(result.success).toBe(true)
    expect(result.subscribedIds).toContain('nl-1')
  })

  it('returns internal error when all inserts fail with non-duplicate error', async () => {
    mockInsert.mockResolvedValue({
      data: null,
      error: { message: 'connection refused', code: '08001' },
    })
    const result = await subscribeToNewsletters('user@example.com', ['nl-1'], 'en')
    expect(result.error).toBe('Internal error. Try again.')
    expect(result.subscribedIds).toBeUndefined()
  })

  /* ====== Email send failure (non-fatal) ====== */

  it('returns success even when email send fails', async () => {
    const sendError = new Error('SMTP connection timeout')
    mockSend.mockRejectedValueOnce(sendError)
    const result = await subscribeToNewsletters('user@example.com', ['nl-1'], 'en')
    expect(result.success).toBe(true)
    expect(result.subscribedIds).toEqual(['nl-1'])
  })

  it('logs email send failure to Sentry', async () => {
    const sendError = new Error('SMTP connection timeout')
    mockSend.mockRejectedValueOnce(sendError)
    await subscribeToNewsletters('user@example.com', ['nl-1'], 'en')
    expect(mockCaptureException).toHaveBeenCalledWith(sendError, {
      tags: { component: 'newsletter-subscribe', action: 'send-confirmation' },
    })
  })

  /* ====== Turnstile verification ====== */

  it('returns verification-required error when Turnstile is enabled but no token given (en)', async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-site-key'
    const result = await subscribeToNewsletters('user@example.com', ['nl-1'], 'en')
    expect(result.error).toBe('Verification required.')
  })

  it('returns verification-required error when Turnstile is enabled but no token given (pt-BR)', async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-site-key'
    const result = await subscribeToNewsletters('user@example.com', ['nl-1'], 'pt-BR')
    expect(result.error).toBe('Verificação necessária.')
  })

  it('returns verification-failed error when Turnstile token is invalid', async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-site-key'
    const { verifyTurnstileToken } = await import('../../../../lib/turnstile')
    vi.mocked(verifyTurnstileToken).mockResolvedValueOnce(false)
    const result = await subscribeToNewsletters('user@example.com', ['nl-1'], 'en', 'bad-token')
    expect(result.error).toBe('Verification failed.')
  })

  /* ====== Insert correctness ====== */

  it('inserts one row per newsletter_id', async () => {
    await subscribeToNewsletters('user@example.com', ['nl-1', 'nl-2', 'nl-3'], 'en')
    expect(mockInsert).toHaveBeenCalledTimes(3)
  })

  it('insert payload has correct shape', async () => {
    await subscribeToNewsletters('user@example.com', ['nl-1'], 'pt-BR')
    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg).toMatchObject({
      site_id: 'test-site-uuid',
      email: 'user@example.com',
      status: 'pending_confirmation',
      newsletter_id: 'nl-1',
      locale: 'pt-BR',
      consent_text_version: 'newsletter-v1-2026-04',
      ip: '203.0.113.42',
      user_agent: 'TestAgent/1.0',
    })
    // Token hash and expiry must be present
    expect(insertArg.confirmation_token_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(insertArg.confirmation_expires_at).toBeDefined()
  })

  /* ====== Unexpected exception ====== */

  it('catches unexpected errors and returns internal error', async () => {
    mockRateCheck.mockRejectedValueOnce(new Error('DB down'))
    const result = await subscribeToNewsletters('user@example.com', ['nl-1'], 'en')
    expect(result.error).toBe('Internal error. Try again.')
    expect(mockCaptureException).toHaveBeenCalled()
  })
})

/* ------------------------------------------------------------------ */
/*  getPostSubscribeSuggestions                                       */
/* ------------------------------------------------------------------ */

describe('getPostSubscribeSuggestions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty array on error', async () => {
    const { getFilteredSuggestionsForSubscriber } = await import('@/lib/newsletter/suggestions')
    vi.mocked(getFilteredSuggestionsForSubscriber).mockRejectedValueOnce(new Error('fail'))
    const result = await getPostSubscribeSuggestions('my-post', 'en', 'user@example.com')
    expect(result).toEqual([])
  })

  it('returns suggestions from the underlying service', async () => {
    const { getFilteredSuggestionsForSubscriber } = await import('@/lib/newsletter/suggestions')
    const fakeSuggestions = [{ newsletterId: 'nl-1', score: 0.9, name: 'Test' }]
    vi.mocked(getFilteredSuggestionsForSubscriber).mockResolvedValueOnce(fakeSuggestions as never)
    const result = await getPostSubscribeSuggestions('my-post', 'en', 'user@example.com')
    expect(result).toEqual(fakeSuggestions)
  })
})
