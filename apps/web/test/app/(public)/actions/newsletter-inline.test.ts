import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-forwarded-for': '127.0.0.1' })),
}))

const mockRateCheck = vi.fn().mockResolvedValue({ data: true, error: null })
const mockInsert = vi.fn().mockResolvedValue({ data: { id: 'sub-1' }, error: null })
const mockUpdate = vi.fn().mockResolvedValue({ data: null, error: null })
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
const mockFrom = vi.fn()

function buildFromReturn(overrides?: { insert?: typeof mockInsert }) {
  const eqChain = { eq: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(), maybeSingle: mockMaybeSingle }
  return {
    select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(eqChain) }),
    insert: overrides?.insert ?? mockInsert,
    update: vi.fn().mockReturnValue({ eq: mockUpdate }),
  }
}

vi.mock('../../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    rpc: mockRateCheck,
    from: mockFrom.mockImplementation(() => buildFromReturn()),
  })),
}))

const mockSend = vi.fn().mockResolvedValue({ messageId: 'x', provider: 'ses' })
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
  captureException: vi.fn(),
  getClient: () => ({}),
}))

vi.mock('../../../../lib/request-ip', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  isValidInet: vi.fn().mockReturnValue(true),
}))

import { subscribeNewsletterInline } from '../../../../src/app/(public)/actions/newsletter-inline'

describe('subscribeNewsletterInline', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error for invalid email', async () => {
    const fd = new FormData()
    fd.set('email', 'not-an-email')
    fd.set('newsletter_id', 'main-pt')
    fd.set('locale', 'pt-BR')

    const result = await subscribeNewsletterInline(undefined, fd)
    expect(result.error).toBeDefined()
    expect(result.success).toBeFalsy()
  })

  it('returns success for valid email', async () => {
    mockRateCheck.mockResolvedValueOnce({ data: true, error: null })
    const fd = new FormData()
    fd.set('email', 'user@example.com')
    fd.set('newsletter_id', 'main-en')
    fd.set('locale', 'en')
    fd.set('turnstile_token', 'ok-token')

    const result = await subscribeNewsletterInline(undefined, fd)
    expect(result.success).toBe(true)
  })

  it('returns rate-limited error', async () => {
    mockRateCheck.mockResolvedValueOnce({ data: false, error: null })
    const fd = new FormData()
    fd.set('email', 'user@example.com')
    fd.set('newsletter_id', 'main-pt')
    fd.set('locale', 'pt-BR')
    fd.set('turnstile_token', 'ok-token')

    const result = await subscribeNewsletterInline(undefined, fd)
    expect(result.error).toMatch(/rate|limit|tente/i)
  })

  it('builds confirmation URL with /newsletter/confirm/{token} path', async () => {
    mockRateCheck.mockResolvedValueOnce({ data: true, error: null })
    mockSend.mockResolvedValueOnce({ messageId: 'x', provider: 'ses' })

    const fd = new FormData()
    fd.set('email', 'user@example.com')
    fd.set('newsletter_id', 'main-en')
    fd.set('locale', 'en')
    fd.set('turnstile_token', 'ok-token')

    await subscribeNewsletterInline(undefined, fd)

    expect(mockSend).toHaveBeenCalledOnce()
    const html = mockSend.mock.calls[0][0].html as string
    expect(html).toMatch(/\/newsletter\/confirm\/[a-f0-9]+/)
    expect(html).not.toContain('?token=')
  })

  it('insert payload includes ip and user_agent', async () => {
    mockRateCheck.mockResolvedValueOnce({ data: true, error: null })
    mockSend.mockResolvedValueOnce({ messageId: 'x', provider: 'ses' })

    const fd = new FormData()
    fd.set('email', 'user@example.com')
    fd.set('newsletter_id', 'main-en')
    fd.set('locale', 'en')
    fd.set('turnstile_token', 'ok-token')

    await subscribeNewsletterInline(undefined, fd)

    expect(mockInsert).toHaveBeenCalledOnce()
    const payload = mockInsert.mock.calls[0][0]
    expect(payload).toHaveProperty('ip')
    expect(payload).toHaveProperty('user_agent')
  })

  it('insert payload includes sanitized utm attribution + referrer', async () => {
    mockRateCheck.mockResolvedValueOnce({ data: true, error: null })
    mockSend.mockResolvedValueOnce({ messageId: 'x', provider: 'ses' })

    const fd = new FormData()
    fd.set('email', 'user@example.com')
    fd.set('newsletter_id', 'main-en')
    fd.set('locale', 'en')
    fd.set('turnstile_token', 'ok-token')
    fd.set('utm_source', 'newsletter')
    fd.set('utm_campaign', 'ai-empire')
    fd.set('utm_medium', 'email')

    await subscribeNewsletterInline(undefined, fd)

    expect(mockInsert).toHaveBeenCalledOnce()
    const payload = mockInsert.mock.calls[0][0]
    expect(payload.utm_campaign).toBe('ai-empire')
    expect(payload.utm_source).toBe('newsletter')
    expect(payload.utm_medium).toBe('email')
    // unset UTM params are stored as null
    expect(payload.utm_term).toBeNull()
    expect(payload).toHaveProperty('referrer')
  })

  it('caps overly long utm values at 200 chars and drops control chars', async () => {
    mockRateCheck.mockResolvedValueOnce({ data: true, error: null })
    mockSend.mockResolvedValueOnce({ messageId: 'x', provider: 'ses' })

    const fd = new FormData()
    fd.set('email', 'user@example.com')
    fd.set('newsletter_id', 'main-en')
    fd.set('locale', 'en')
    fd.set('turnstile_token', 'ok-token')
    fd.set('utm_campaign', 'a'.repeat(500) + '\n\tinjected')

    await subscribeNewsletterInline(undefined, fd)

    const payload = mockInsert.mock.calls[0][0]
    expect((payload.utm_campaign as string).length).toBe(200)
    expect(payload.utm_campaign).not.toContain('\n')
    expect(payload.utm_campaign).not.toContain('\t')
  })

  it('rate check receives p_ip', async () => {
    mockRateCheck.mockResolvedValueOnce({ data: true, error: null })
    mockSend.mockResolvedValueOnce({ messageId: 'x', provider: 'ses' })

    const fd = new FormData()
    fd.set('email', 'user@example.com')
    fd.set('newsletter_id', 'main-en')
    fd.set('locale', 'en')
    fd.set('turnstile_token', 'ok-token')

    await subscribeNewsletterInline(undefined, fd)

    expect(mockRateCheck).toHaveBeenCalledWith('newsletter_rate_check', expect.objectContaining({ p_ip: expect.any(String) }))
  })

  it('returns email_failed error when email send fails', async () => {
    mockRateCheck.mockResolvedValueOnce({ data: true, error: null })
    mockSend.mockRejectedValueOnce(new Error('SMTP timeout'))

    const fd = new FormData()
    fd.set('email', 'user@example.com')
    fd.set('newsletter_id', 'main-en')
    fd.set('locale', 'en')
    fd.set('turnstile_token', 'ok-token')

    const result = await subscribeNewsletterInline(undefined, fd)
    expect(result.success).toBeFalsy()
    expect(result.error).toBe('email_failed')
  })

  it('returns success without email for already-confirmed subscription', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'existing-1', status: 'confirmed' }, error: null })

    const fd = new FormData()
    fd.set('email', 'user@example.com')
    fd.set('newsletter_id', 'main-en')
    fd.set('locale', 'en')
    fd.set('turnstile_token', 'ok-token')

    const result = await subscribeNewsletterInline(undefined, fd)
    expect(result.success).toBe(true)
    expect(mockSend).not.toHaveBeenCalled()
  })
})
