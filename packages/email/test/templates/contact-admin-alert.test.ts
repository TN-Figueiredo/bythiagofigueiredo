import { describe, it, expect } from 'vitest'
import { contactAdminAlertTemplate } from '../../src/templates/contact-admin-alert'

const branding = { brandName: 'TestBrand', primaryColor: '#ff0000' }
const baseVars = {
  submitterName: 'Alice',
  submitterEmail: 'alice@x.com',
  message: 'Hello\nWorld',
  viewInAdminUrl: 'https://x.com/admin/contacts/1',
  branding,
}

describe('contactAdminAlertTemplate', () => {
  it('renders pt-BR', async () => {
    const r = await contactAdminAlertTemplate.render(baseVars, 'pt-BR')
    expect(r.subject).toBe('Novo contato: Alice')
    expect(r.html).toContain('De:')
    expect(r.html).toContain('Mensagem:')
    expect(r.html).toContain('Ver no admin')
    expect(r.html).toContain('Hello<br>World')
  })
  it('renders en', async () => {
    const r = await contactAdminAlertTemplate.render(baseVars, 'en')
    expect(r.subject).toBe('New contact: Alice')
    expect(r.html).toContain('From:')
    expect(r.html).toContain('Message:')
    expect(r.html).toContain('View in admin')
  })
  it('escapes HTML in message and submitter fields', async () => {
    const r = await contactAdminAlertTemplate.render(
      { ...baseVars, message: '<script>evil</script>', submitterName: '<b>Eve</b>' },
      'pt-BR',
    )
    expect(r.html).not.toContain('<script>evil</script>')
    expect(r.html).toContain('&lt;script&gt;evil&lt;/script&gt;')
    expect(r.html).toContain('&lt;b&gt;Eve&lt;/b&gt;')
  })
})
