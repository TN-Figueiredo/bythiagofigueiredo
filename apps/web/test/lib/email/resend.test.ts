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

import { sendTransactionalEmail } from '../../../lib/email/resend'

describe('sendTransactionalEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls resend with correct params', async () => {
    await sendTransactionalEmail({
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>World</p>',
    })
    expect(mockSend).toHaveBeenCalledWith({
      from: 'Thiago <no-reply@bythiagofigueiredo.com>',
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>World</p>',
    })
  })

  it('allows overriding the from address', async () => {
    await sendTransactionalEmail({
      to: 'a@b.com',
      subject: 'S',
      html: '<p/>',
      from: 'custom@domain.com',
    })
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ from: 'custom@domain.com' }))
  })

  it('throws when resend returns an error', async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: 'rate limited' } })
    await expect(
      sendTransactionalEmail({ to: 'x@y.com', subject: 'S', html: '<p/>' })
    ).rejects.toThrow('rate limited')
  })
})
