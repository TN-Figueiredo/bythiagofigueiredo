import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend, mockCaptureException, mockRender } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
  mockCaptureException: vi.fn(),
  mockRender: vi.fn().mockResolvedValue('<html>welcome</html>'),
}))

vi.mock('../../../lib/email/service', () => ({
  getEmailService: () => ({ send: mockSend }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
  getClient: () => ({}),
}))

vi.mock('@react-email/render', () => ({
  render: mockRender,
}))

import { sendWelcomeEmail } from '../../../lib/newsletter/welcome-email'

describe('sendWelcomeEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  const baseOpts = {
    to: 'user@test.com',
    locale: 'pt-BR',
    newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
    unsubscribeUrl: 'https://example.com/unsubscribe/token123',
  } as const

  it('sends email with correct from and to', async () => {
    process.env.NEWSLETTER_FROM_DOMAIN = 'example.com'
    await sendWelcomeEmail({ ...baseOpts })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        from: expect.objectContaining({ email: 'no-reply@example.com' }),
      })
    )
    delete process.env.NEWSLETTER_FROM_DOMAIN
  })

  it('uses pt-BR subject for pt-BR locale', async () => {
    await sendWelcomeEmail({ ...baseOpts })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Bem-vindo'),
      })
    )
  })

  it('uses English subject for en locale', async () => {
    await sendWelcomeEmail({ ...baseOpts, locale: 'en' })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Welcome'),
      })
    )
  })

  it('includes List-Unsubscribe headers', async () => {
    await sendWelcomeEmail({ ...baseOpts })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          headers: expect.objectContaining({
            'List-Unsubscribe': expect.stringContaining(baseOpts.unsubscribeUrl),
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }),
        }),
      })
    )
  })

  it('returns true on successful send', async () => {
    const result = await sendWelcomeEmail({ ...baseOpts })
    expect(result).toBe(true)
  })

  it('captures error on failure and returns false', async () => {
    mockSend.mockRejectedValueOnce(new Error('SES down'))
    const result = await sendWelcomeEmail({ ...baseOpts })
    expect(mockCaptureException).toHaveBeenCalled()
    expect(result).toBe(false)
  })
})
