import { describe, it, expect } from 'vitest'
import { welcomeTemplate } from '../../src/templates/welcome'

const branding = { brandName: 'TestBrand', primaryColor: '#ff0000' }

describe('welcomeTemplate', () => {
  it('renders pt-BR with name', async () => {
    const r = await welcomeTemplate.render({ name: 'João', siteUrl: 'https://x.com', branding }, 'pt-BR')
    expect(r.subject).toBe('Bem-vindo, João!')
    expect(r.html).toContain('Obrigado por se inscrever')
    expect(r.html).toContain('TestBrand')
    expect(r.html).toContain('https://x.com')
    expect(r.text).toBeTruthy()
    expect(r.text).toContain('Obrigado por se inscrever')
  })
  it('renders en without name', async () => {
    const r = await welcomeTemplate.render({ siteUrl: 'https://x.com', branding }, 'en')
    expect(r.subject).toBe('Welcome!')
    expect(r.html).toContain('Thanks for subscribing')
    expect(r.text).toBeTruthy()
    expect(r.text).toContain('Thanks for subscribing')
  })
  it('escapes HTML in name', async () => {
    const r = await welcomeTemplate.render({ name: '<script>x</script>', siteUrl: 'https://x.com', branding }, 'pt-BR')
    expect(r.html).not.toContain('<script>x</script>')
    expect(r.html).toContain('&lt;script&gt;')
  })
})
