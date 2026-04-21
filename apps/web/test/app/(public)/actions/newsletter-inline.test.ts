import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRateCheck = vi.fn().mockResolvedValue({ data: { allowed: true }, error: null })
const mockInsert = vi.fn().mockResolvedValue({ data: { id: 'sub-1' }, error: null })
const mockFrom = vi.fn()

vi.mock('../../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    rpc: mockRateCheck,
    from: mockFrom.mockReturnValue({ insert: mockInsert }),
  })),
}))

vi.mock('../../../../lib/email/service', () => ({
  getEmailService: () => ({ send: vi.fn().mockResolvedValue({ messageId: 'x', provider: 'resend' }) }),
}))

vi.mock('../../../../lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'test-site-uuid', orgId: 'org-1', defaultLocale: 'pt-BR' }),
}))

vi.mock('../../../../lib/turnstile', () => ({
  verifyTurnstileToken: vi.fn().mockResolvedValue(true),
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
    mockRateCheck.mockResolvedValueOnce({ data: { allowed: true }, error: null })
    mockFrom.mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ data: { id: 'sub-1' }, error: null }) })
    const fd = new FormData()
    fd.set('email', 'user@example.com')
    fd.set('newsletter_id', 'main-en')
    fd.set('locale', 'en')
    fd.set('turnstile_token', 'ok-token')

    const result = await subscribeNewsletterInline(undefined, fd)
    expect(result.success).toBe(true)
  })

  it('returns rate-limited error', async () => {
    mockRateCheck.mockResolvedValueOnce({ data: { allowed: false }, error: null })
    const fd = new FormData()
    fd.set('email', 'user@example.com')
    fd.set('newsletter_id', 'main-pt')
    fd.set('locale', 'pt-BR')
    fd.set('turnstile_token', 'ok-token')

    const result = await subscribeNewsletterInline(undefined, fd)
    expect(result.error).toMatch(/rate|limit|tente/i)
  })
})
