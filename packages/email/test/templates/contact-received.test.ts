import { describe, it, expect } from 'vitest'
import { contactReceivedTemplate } from '../../src/templates/contact-received'

const branding = { brandName: 'TestBrand', primaryColor: '#ff0000' }

describe('contactReceivedTemplate', () => {
  it('renders pt-BR', async () => {
    const r = await contactReceivedTemplate.render(
      { name: 'João', expectedReplyTime: '48h', branding },
      'pt-BR',
    )
    expect(r.subject).toBe('Recebemos sua mensagem — TestBrand')
    expect(r.html).toContain('Olá, João')
    expect(r.html).toContain('48h')
    expect(r.html).toContain('Equipe TestBrand')
    expect(r.text).toBeTruthy()
    expect(r.text).toContain('Olá, João')
  })
  it('renders en', async () => {
    const r = await contactReceivedTemplate.render(
      { name: 'Jane', expectedReplyTime: '2 business days', branding },
      'en',
    )
    expect(r.subject).toBe('We received your message — TestBrand')
    expect(r.html).toContain('Hi, Jane')
    expect(r.html).toContain('2 business days')
    expect(r.text).toBeTruthy()
    expect(r.text).toContain('Hi, Jane')
  })
  it('escapes HTML in name', async () => {
    const r = await contactReceivedTemplate.render(
      { name: '<script>x</script>', expectedReplyTime: '48h', branding },
      'pt-BR',
    )
    expect(r.html).not.toContain('<script>x</script>')
    expect(r.html).toContain('&lt;script&gt;')
  })
})
