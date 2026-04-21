import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend } = vi.hoisted(() => {
  const mockSend = vi.fn().mockResolvedValue({ data: { id: 'test-123' }, error: null })
  return { mockSend }
})

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}))

import { createResendEmailService } from '../../../lib/email/resend'

describe('createResendEmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = 're_test_key'
  })

  it('throws when RESEND_API_KEY is not configured', () => {
    delete process.env.RESEND_API_KEY
    expect(() => createResendEmailService()).toThrow('RESEND_API_KEY is not configured')
  })

  it('send() calls resend with correct params', async () => {
    const svc = createResendEmailService()
    const result = await svc.send({
      from: { name: 'Thiago', email: 'no-reply@bythiagofigueiredo.com' },
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>World</p>',
    })
    expect(mockSend).toHaveBeenCalledWith({
      from: 'Thiago <no-reply@bythiagofigueiredo.com>',
      to: ['test@example.com'],
      subject: 'Hello',
      html: '<p>World</p>',
      text: undefined,
      replyTo: undefined,
      headers: undefined,
    })
    expect(result.messageId).toBe('test-123')
    expect(result.provider).toBe('resend')
  })

  it('send() throws when resend returns an error', async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: 'rate limited' } })
    const svc = createResendEmailService()
    await expect(
      svc.send({
        from: { name: 'T', email: 'x@y.com' },
        to: 'a@b.com',
        subject: 'S',
        html: '<p/>',
      })
    ).rejects.toThrow('rate limited')
  })

  it('sendTemplate() renders template and calls send', async () => {
    const svc = createResendEmailService()
    const template = {
      render: vi.fn().mockReturnValue({
        subject: 'Rendered Subject',
        html: '<p>Rendered HTML</p>',
        text: 'Rendered text',
      }),
    }
    const result = await svc.sendTemplate(
      template as never,
      { name: 'Thiago', email: 'noreply@example.com' },
      'recipient@example.com',
      { foo: 'bar' },
      'pt-BR',
    )
    expect(template.render).toHaveBeenCalledWith({ foo: 'bar' }, 'pt-BR')
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'Rendered Subject',
      html: '<p>Rendered HTML</p>',
      text: 'Rendered text',
    }))
    expect(result.messageId).toBe('test-123')
  })
})
