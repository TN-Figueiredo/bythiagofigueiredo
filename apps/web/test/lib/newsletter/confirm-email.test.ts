import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend, mockCaptureException } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({ messageId: 'msg-1', provider: 'ses' }),
  mockCaptureException: vi.fn(),
}))

vi.mock('../../../lib/email/service', () => ({
  getEmailService: () => ({ send: mockSend }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
  getClient: () => ({}),
}))

import {
  generateConfirmToken,
  hashConfirmToken,
  buildConfirmUrl,
  sendNewsletterConfirmEmail,
} from '../../../lib/newsletter/confirm-email'

describe('confirm-email shared module', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('generateConfirmToken', () => {
    it('returns a 64-char hex string', () => {
      const token = generateConfirmToken()
      expect(token).toMatch(/^[a-f0-9]{64}$/)
    })

    it('returns unique values on each call', () => {
      const a = generateConfirmToken()
      const b = generateConfirmToken()
      expect(a).not.toBe(b)
    })
  })

  describe('hashConfirmToken', () => {
    it('returns a 64-char hex SHA-256 hash', () => {
      const hash = hashConfirmToken('abc123')
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('is deterministic', () => {
      const a = hashConfirmToken('test')
      const b = hashConfirmToken('test')
      expect(a).toBe(b)
    })

    it('produces different hashes for different inputs', () => {
      const a = hashConfirmToken('one')
      const b = hashConfirmToken('two')
      expect(a).not.toBe(b)
    })
  })

  describe('buildConfirmUrl', () => {
    it('uses NEXT_PUBLIC_APP_URL env var', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
      const url = buildConfirmUrl('abc123', 'en')
      expect(url).toBe('https://example.com/newsletter/confirm/abc123')
      delete process.env.NEXT_PUBLIC_APP_URL
    })

    it('adds /pt prefix for pt-BR locale', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
      const url = buildConfirmUrl('abc123', 'pt-BR')
      expect(url).toBe('https://example.com/pt/newsletter/confirm/abc123')
      delete process.env.NEXT_PUBLIC_APP_URL
    })

    it('falls back to localhost when env var is unset', () => {
      delete process.env.NEXT_PUBLIC_APP_URL
      const url = buildConfirmUrl('abc123', 'en')
      expect(url).toBe('http://localhost:3000/newsletter/confirm/abc123')
    })
  })

  describe('sendNewsletterConfirmEmail', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
    })

    it('sends email with correct subject for en', async () => {
      await sendNewsletterConfirmEmail({ to: 'user@example.com', rawToken: 'abc', locale: 'en' })
      expect(mockSend).toHaveBeenCalledOnce()
      const arg = mockSend.mock.calls[0][0]
      expect(arg.to).toBe('user@example.com')
      expect(arg.subject).toBe('Confirm your subscription')
    })

    it('sends email with correct subject for pt-BR', async () => {
      await sendNewsletterConfirmEmail({ to: 'user@example.com', rawToken: 'abc', locale: 'pt-BR' })
      const arg = mockSend.mock.calls[0][0]
      expect(arg.subject).toBe('Confirme sua inscrição')
    })

    it('HTML contains confirm URL with token', async () => {
      await sendNewsletterConfirmEmail({ to: 'user@example.com', rawToken: 'abcdef1234', locale: 'en' })
      const html = mockSend.mock.calls[0][0].html as string
      expect(html).toContain('/newsletter/confirm/abcdef1234')
    })

    it('HTML escapes the confirm URL', async () => {
      await sendNewsletterConfirmEmail({ to: 'user@example.com', rawToken: 'abc', locale: 'en' })
      const html = mockSend.mock.calls[0][0].html as string
      expect(html).not.toContain('${')
      expect(html).toContain('<!DOCTYPE html>')
    })

    it('does not throw when email send fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('SMTP down'))
      await expect(
        sendNewsletterConfirmEmail({ to: 'user@example.com', rawToken: 'abc', locale: 'en' }),
      ).resolves.toBeUndefined()
    })

    it('captures email failure to Sentry', async () => {
      const err = new Error('SMTP down')
      mockSend.mockRejectedValueOnce(err)
      await sendNewsletterConfirmEmail({ to: 'user@example.com', rawToken: 'abc', locale: 'en' })
      expect(mockCaptureException).toHaveBeenCalledWith(err, expect.objectContaining({
        tags: expect.objectContaining({ action: 'newsletter_subscribe', branch: 'send_confirm_email' }),
      }))
    })
  })
})
