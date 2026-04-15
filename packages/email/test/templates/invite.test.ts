import { describe, it, expect } from 'vitest'
import { inviteTemplate } from '../../src/templates/invite'

const branding = { brandName: 'TestBrand', primaryColor: '#ff0000' }
const baseVars = {
  inviterName: 'Alice',
  orgName: 'Acme',
  role: 'admin' as const,
  acceptUrl: 'https://x.com/accept',
  expiresAt: new Date('2026-05-01T00:00:00Z'),
  branding,
}

describe('inviteTemplate', () => {
  it('renders pt-BR', async () => {
    const r = await inviteTemplate.render(baseVars, 'pt-BR')
    expect(r.subject).toBe('Alice convidou você para Acme')
    expect(r.html).toContain('Você recebeu um convite')
    expect(r.html).toContain('2026-05-01')
    expect(r.html).toContain('Aceitar convite')
  })
  it('renders en', async () => {
    const r = await inviteTemplate.render(baseVars, 'en')
    expect(r.subject).toBe('Alice invited you to Acme')
    expect(r.html).toContain('You have an invitation')
    expect(r.html).toContain('Accept invitation')
  })
  it('escapes HTML in inviter/org names', async () => {
    const r = await inviteTemplate.render(
      { ...baseVars, inviterName: '<b>Eve</b>', orgName: '<i>Org</i>' },
      'pt-BR',
    )
    expect(r.html).not.toContain('<b>Eve</b>')
    expect(r.html).toContain('&lt;b&gt;Eve&lt;/b&gt;')
    expect(r.html).toContain('&lt;i&gt;Org&lt;/i&gt;')
  })
})
