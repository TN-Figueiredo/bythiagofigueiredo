import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend, mockCaptureException, mockRender, mockWelcomeEmail } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
  mockCaptureException: vi.fn(),
  mockRender: vi.fn().mockResolvedValue('<html>welcome</html>'),
  mockWelcomeEmail: vi.fn().mockReturnValue(null),
}))

vi.mock('../../../src/emails/welcome', () => ({
  WelcomeEmail: mockWelcomeEmail,
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

  it('List-Unsubscribe advertises ONLY the https one-click URL (no dead mailto)', async () => {
    await sendWelcomeEmail({ ...baseOpts })
    const headers = mockSend.mock.calls[0][0].metadata.headers
    // Nothing processes an unsubscribe@ mailbox — a mailto here would silently
    // swallow unsubscribes and convert them into complaints.
    expect(headers['List-Unsubscribe']).toBe(`<${baseOpts.unsubscribeUrl}>`)
    expect(headers['List-Unsubscribe']).not.toContain('mailto:')
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('passes the sender email to the template for the add-to-contacts nudge', async () => {
    process.env.NEWSLETTER_FROM_DOMAIN = 'example.com'
    await sendWelcomeEmail({ ...baseOpts })
    expect(mockWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ senderEmail: 'no-reply@example.com' })
    )
    delete process.env.NEWSLETTER_FROM_DOMAIN
  })

  it('sets replyTo when provided (newsletter_types.reply_to)', async () => {
    await sendWelcomeEmail({ ...baseOpts, replyTo: 'thiago@example.com' })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: 'thiago@example.com' })
    )
  })

  it('omits replyTo entirely when the type has none', async () => {
    await sendWelcomeEmail({ ...baseOpts })
    const msg = mockSend.mock.calls[0][0]
    expect('replyTo' in msg).toBe(false)
  })

  it('FIX: passes canReply=true to the template when replyTo is set (reply invite renders)', async () => {
    await sendWelcomeEmail({ ...baseOpts, replyTo: 'thiago@example.com' })
    expect(mockWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ canReply: true })
    )
  })

  it('FIX: passes canReply=false when there is no replyTo — the no-reply@ from cannot receive replies', async () => {
    await sendWelcomeEmail({ ...baseOpts })
    expect(mockWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ canReply: false })
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
