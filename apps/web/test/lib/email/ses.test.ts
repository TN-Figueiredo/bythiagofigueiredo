import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockClientSend } = vi.hoisted(() => {
  const mockClientSend = vi.fn().mockResolvedValue({ MessageId: 'ses-msg-001' })
  return { mockClientSend }
})

vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: vi.fn().mockImplementation(() => ({
    send: mockClientSend,
  })),
  SendEmailCommand: vi.fn().mockImplementation((input: unknown) => input),
}))

import { createSesEmailService } from '../../../lib/email/ses'

function setSesEnv() {
  process.env.AWS_SES_REGION = 'sa-east-1'
  process.env.AWS_SES_ACCESS_KEY_ID = 'AKIATEST'
  process.env.AWS_SES_SECRET_ACCESS_KEY = 'secret123'
}

describe('createSesEmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSesEnv()
  })

  it('throws when AWS credentials are missing', () => {
    delete process.env.AWS_SES_REGION
    expect(() => createSesEmailService()).toThrow('AWS SES credentials not configured')
  })

  it('throws when only partial credentials are set', () => {
    delete process.env.AWS_SES_SECRET_ACCESS_KEY
    expect(() => createSesEmailService()).toThrow('AWS SES credentials not configured')
  })

  it('send() passes correct params to SendEmailCommand', async () => {
    const svc = createSesEmailService()
    const result = await svc.send({
      from: { name: 'Thiago', email: 'newsletter@bythiagofigueiredo.com' },
      to: 'reader@example.com',
      subject: 'Weekly Update',
      html: '<p>Content here</p>',
    })

    expect(mockClientSend).toHaveBeenCalledOnce()
    const cmd = mockClientSend.mock.calls[0][0]
    expect(cmd.FromEmailAddress).toBe('Thiago <newsletter@bythiagofigueiredo.com>')
    expect(cmd.Destination.ToAddresses).toEqual(['reader@example.com'])
    expect(cmd.Content.Simple.Subject.Data).toBe('Weekly Update')
    expect(cmd.Content.Simple.Body.Html.Data).toBe('<p>Content here</p>')
    expect(result.messageId).toBe('ses-msg-001')
    expect(result.provider).toBe('ses')
  })

  it('send() handles array of recipients', async () => {
    const svc = createSesEmailService()
    await svc.send({
      from: { name: 'T', email: 'x@y.com' },
      to: ['a@b.com', 'c@d.com'],
      subject: 'S',
      html: '<p/>',
    })
    const cmd = mockClientSend.mock.calls[0][0]
    expect(cmd.Destination.ToAddresses).toEqual(['a@b.com', 'c@d.com'])
  })

  it('send() includes text body when provided', async () => {
    const svc = createSesEmailService()
    await svc.send({
      from: { name: 'T', email: 'x@y.com' },
      to: 'a@b.com',
      subject: 'S',
      html: '<p>html</p>',
      text: 'plain text',
    })
    const cmd = mockClientSend.mock.calls[0][0]
    expect(cmd.Content.Simple.Body.Text.Data).toBe('plain text')
  })

  it('send() omits text body when not provided', async () => {
    const svc = createSesEmailService()
    await svc.send({
      from: { name: 'T', email: 'x@y.com' },
      to: 'a@b.com',
      subject: 'S',
      html: '<p/>',
    })
    const cmd = mockClientSend.mock.calls[0][0]
    expect(cmd.Content.Simple.Body.Text).toBeUndefined()
  })

  it('send() uses per-call configurationSet override', async () => {
    const svc = createSesEmailService('default-config')
    await svc.send({
      from: { name: 'T', email: 'x@y.com' },
      to: 'a@b.com',
      subject: 'S',
      html: '<p/>',
      metadata: { configurationSet: 'marketing-config' },
    })
    const cmd = mockClientSend.mock.calls[0][0]
    expect(cmd.ConfigurationSetName).toBe('marketing-config')
  })

  it('send() falls back to defaultConfigSet when no per-call override', async () => {
    const svc = createSesEmailService('bythiago-transactional')
    await svc.send({
      from: { name: 'T', email: 'x@y.com' },
      to: 'a@b.com',
      subject: 'S',
      html: '<p/>',
    })
    const cmd = mockClientSend.mock.calls[0][0]
    expect(cmd.ConfigurationSetName).toBe('bythiago-transactional')
  })

  it('send() omits ConfigurationSetName when neither provided', async () => {
    const svc = createSesEmailService()
    await svc.send({
      from: { name: 'T', email: 'x@y.com' },
      to: 'a@b.com',
      subject: 'S',
      html: '<p/>',
    })
    const cmd = mockClientSend.mock.calls[0][0]
    expect(cmd.ConfigurationSetName).toBeUndefined()
  })

  it('send() passes custom headers (List-Unsubscribe)', async () => {
    const svc = createSesEmailService()
    await svc.send({
      from: { name: 'T', email: 'x@y.com' },
      to: 'a@b.com',
      subject: 'S',
      html: '<p/>',
      metadata: {
        headers: {
          'List-Unsubscribe': '<https://example.com/unsub>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      },
    })
    const cmd = mockClientSend.mock.calls[0][0]
    expect(cmd.Content.Simple.Headers).toEqual([
      { Name: 'List-Unsubscribe', Value: '<https://example.com/unsub>' },
      { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
    ])
  })

  it('send() omits Headers when empty object', async () => {
    const svc = createSesEmailService()
    await svc.send({
      from: { name: 'T', email: 'x@y.com' },
      to: 'a@b.com',
      subject: 'S',
      html: '<p/>',
      metadata: { headers: {} },
    })
    const cmd = mockClientSend.mock.calls[0][0]
    expect(cmd.Content.Simple.Headers).toBeUndefined()
  })

  it('send() includes replyTo when provided', async () => {
    const svc = createSesEmailService()
    await svc.send({
      from: { name: 'T', email: 'x@y.com' },
      to: 'a@b.com',
      subject: 'S',
      html: '<p/>',
      replyTo: 'reply@example.com',
    })
    const cmd = mockClientSend.mock.calls[0][0]
    expect(cmd.ReplyToAddresses).toEqual(['reply@example.com'])
  })

  it('send() throws when SES returns no MessageId', async () => {
    mockClientSend.mockResolvedValueOnce({ MessageId: undefined })
    const svc = createSesEmailService()
    await expect(
      svc.send({
        from: { name: 'T', email: 'x@y.com' },
        to: 'a@b.com',
        subject: 'S',
        html: '<p/>',
      }),
    ).rejects.toThrow('SES returned no MessageId')
  })

  it('send() propagates SES SDK errors', async () => {
    mockClientSend.mockRejectedValueOnce(new Error('Access Denied'))
    const svc = createSesEmailService()
    await expect(
      svc.send({
        from: { name: 'T', email: 'x@y.com' },
        to: 'a@b.com',
        subject: 'S',
        html: '<p/>',
      }),
    ).rejects.toThrow('Access Denied')
  })

  it('send() quotes sender name with special characters (RFC 5322)', async () => {
    const svc = createSesEmailService()
    await svc.send({
      from: { name: 'Figueiredo, Thiago', email: 'x@y.com' },
      to: 'a@b.com',
      subject: 'S',
      html: '<p/>',
    })
    const cmd = mockClientSend.mock.calls[0][0]
    expect(cmd.FromEmailAddress).toBe('"Figueiredo, Thiago" <x@y.com>')
  })

  it('sendTemplate() renders template then calls send', async () => {
    const svc = createSesEmailService()
    const template = {
      name: 'welcome',
      render: vi.fn().mockResolvedValue({
        subject: 'Welcome!',
        html: '<p>Hello</p>',
        text: 'Hello',
      }),
    }
    const result = await svc.sendTemplate(
      template as never,
      { name: 'Thiago', email: 'noreply@bythiagofigueiredo.com' },
      'new-sub@example.com',
      { name: 'Reader' },
      'pt-BR',
    )
    expect(template.render).toHaveBeenCalledWith({ name: 'Reader' }, 'pt-BR')
    const cmd = mockClientSend.mock.calls[0][0]
    expect(cmd.Content.Simple.Subject.Data).toBe('Welcome!')
    expect(result.messageId).toBe('ses-msg-001')
    expect(result.provider).toBe('ses')
  })

  it('sendTemplate() defaults to en locale', async () => {
    const svc = createSesEmailService()
    const template = {
      name: 'test',
      render: vi.fn().mockResolvedValue({ subject: 'S', html: '<p/>', text: '' }),
    }
    await svc.sendTemplate(
      template as never,
      { name: 'T', email: 'x@y.com' },
      'a@b.com',
      {},
    )
    expect(template.render).toHaveBeenCalledWith({}, 'en')
  })
})
