import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))
vi.mock('@/lib/email/service', () => ({ getEmailService: () => ({ send: sendMock }) }))

import { EmailAdapter } from '../../../src/lib/notifications/adapters/email'
import type { INotification } from '../../../src/lib/notifications/types'

function notif(title: string, message: string | null): INotification {
  return { title, message } as unknown as INotification
}
const user = { email: 'dono@exemplo.invalid' } as never

beforeEach(() => { sendMock.mockReset(); sendMock.mockResolvedValue(undefined) })

describe('EmailAdapter: escape do HTML e do assunto', () => {
  it('não deixa marca viva no html e mantém o texto simples legível', async () => {
    const evil = '<script>alert(1)</script> <img src=x onerror=alert(1)> "><a href="https://exemplo.invalid">clique</a> & fim'
    await new EmailAdapter().send(notif(evil, evil), user)
    const arg = sendMock.mock.calls[0]![0] as { html: string; text: string; subject: string }
    expect(arg.html).not.toContain('<script')
    expect(arg.html).not.toContain('<img')
    expect(arg.html).not.toContain('<a ')
    expect(arg.html).not.toContain('"><')
    expect(arg.html).toContain('&lt;script&gt;')
    expect(arg.html).toContain('&quot;&gt;&lt;a href=&quot;')
    expect(arg.html).toContain('&amp; fim')
    expect(arg.html.startsWith('<p>') && arg.html.endsWith('</p>')).toBe(true)
    expect(arg.text).toBe(evil)
  })

  it('entrada sem caractere especial gera o mesmo e-mail de antes (token_expired)', async () => {
    await new EmailAdapter().send(notif('Token do Instagram expirou', 'Reconecte a conta em 3 dias.'), user)
    const arg = sendMock.mock.calls[0]![0] as Record<string, unknown>
    expect(arg.subject).toBe('Token do Instagram expirou')
    expect(arg.html).toBe('<p>Reconecte a conta em 3 dias.</p>')
    expect(arg.text).toBe('Reconecte a conta em 3 dias.')
  })

  it('sem message usa o título, também escapado', async () => {
    await new EmailAdapter().send(notif('a <b> c', null), user)
    expect((sendMock.mock.calls[0]![0] as { html: string }).html).toBe('<p>a &lt;b&gt; c</p>')
  })

  it('assunto sem quebra de linha nem caractere de controle (injeção de cabeçalho)', async () => {
    await new EmailAdapter().send(notif('Canal X\r\nBcc: alguem@exemplo.invalid\u0000\u0007 fim', 'corpo'), user)
    const subject = (sendMock.mock.calls[0]![0] as { subject: string }).subject
    expect(subject).not.toMatch(/[\r\n\u0000-\u001f\u007f]/)
    expect(subject).toContain('Canal X')
    expect(subject).toContain('fim')
  })
})

describe('EmailAdapter: link da notificação (E0)', () => {
  const orig = process.env.NEXT_PUBLIC_APP_URL
  beforeEach(() => { process.env.NEXT_PUBLIC_APP_URL = 'https://site.invalid/' })
  afterEach(() => {
    if (orig === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = orig
    vi.restoreAllMocks()
  })
  const com = (href: string | null) => ({ title: 't', message: 'm', action_href: href }) as unknown as INotification
  const enviado = async (n: INotification) => {
    await new EmailAdapter().send(n, user)
    return sendMock.mock.calls[0]![0] as { html: string; text: string }
  }

  it('relativo vira absoluto no html e no text, sem barra duplicada', async () => {
    const a = await enviado(com('/cms/x?a=1&b=2'))
    expect(a.html).toContain('href="https://site.invalid/cms/x?a=1&amp;b=2"')
    expect(a.text).toBe('m\n\nhttps://site.invalid/cms/x?a=1&b=2')
  })
  it('nulo: sem link', async () => {
    const a = await enviado(com(null))
    expect(a.html).toBe('<p>m</p>')
    expect(a.text).toBe('m')
  })
  it('aspas no href saem escapadas', async () => {
    const a = await enviado(com('/x"onmouseover="y'))
    expect(a.html).not.toContain('"onmouseover')
    expect(a.html).toContain('&quot;onmouseover=&quot;')
  })
  it.each(['https://outro.invalid/x', '//outro.invalid', '/\\outro.invalid', 'x/y'])('%s é ignorado', async (h) => {
    const a = await enviado(com(h))
    expect(a.html).toBe('<p>m</p>')
    expect(a.text).toBe('m')
  })
  it('sem NEXT_PUBLIC_APP_URL: sai sem link e com aviso', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const a = await enviado(com('/cms/x'))
    expect(a.html).toBe('<p>m</p>')
    expect(a.text).toBe('m')
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
