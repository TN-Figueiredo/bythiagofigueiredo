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

  it('sends email with correct from and to', async () => {
    process.env.NEWSLETTER_FROM_DOMAIN = 'example.com'
    await sendWelcomeEmail({
      to: 'user@test.com',
      locale: 'pt-BR',
      newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
    })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        from: expect.objectContaining({ email: 'no-reply@example.com' }),
      })
    )
    delete process.env.NEWSLETTER_FROM_DOMAIN
  })

  it('uses pt-BR subject for pt-BR locale', async () => {
    await sendWelcomeEmail({
      to: 'user@test.com',
      locale: 'pt-BR',
      newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
    })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Bem-vindo'),
      })
    )
  })

  it('uses English subject for en locale', async () => {
    await sendWelcomeEmail({
      to: 'user@test.com',
      locale: 'en',
      newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
    })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Welcome'),
      })
    )
  })

  it('captures error on failure without rethrowing', async () => {
    mockSend.mockRejectedValueOnce(new Error('SES down'))
    await sendWelcomeEmail({
      to: 'user@test.com',
      locale: 'pt-BR',
      newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
    })
    expect(mockCaptureException).toHaveBeenCalled()
  })
})
