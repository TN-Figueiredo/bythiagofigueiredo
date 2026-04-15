import { describe, it, expect } from 'vitest'
import { emailButton, escapeHtml, emailLayout, htmlToText } from '../../src/templates/base-layout'

describe('emailButton', () => {
  it('uses provided hex color', () => {
    const html = emailButton({ url: 'https://x.com', label: 'Click', color: '#ff0000' })
    expect(html).toContain('background:#ff0000')
  })
  it('falls back to default for invalid color (XSS attempt)', () => {
    const malicious = 'red;}</style><script>alert(1)</script><style>{'
    const html = emailButton({ url: 'https://x.com', label: 'Click', color: malicious })
    expect(html).toContain('background:#0070f3')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('</style>')
  })
  it('falls back to default for non-hex color name', () => {
    const html = emailButton({ url: 'https://x.com', label: 'Click', color: 'red' })
    expect(html).toContain('background:#0070f3')
  })
  it('escapes URL and label', () => {
    const html = emailButton({ url: 'https://x.com?q=<>', label: '<b>X</b>' })
    expect(html).not.toContain('<b>X</b>')
    expect(html).toContain('&lt;b&gt;')
  })
})

describe('escapeHtml', () => {
  it('escapes all HTML-significant chars', () => {
    expect(escapeHtml('<b>"hi" & \'ok\'</b>')).toBe('&lt;b&gt;&quot;hi&quot; &amp; &#039;ok&#039;&lt;/b&gt;')
  })
})

describe('emailLayout unsubscribe label', () => {
  const branding = { brandName: 'X', unsubscribeUrl: 'https://x.com/u/abc' }
  it('uses pt-BR by default', () => {
    const html = emailLayout({ body: '<p>hi</p>', branding })
    expect(html).toContain('Cancelar inscrição')
  })
  it('uses en when locale=en', () => {
    const html = emailLayout({ body: '<p>hi</p>', branding, locale: 'en' })
    expect(html).toContain('Unsubscribe')
    expect(html).not.toContain('Cancelar')
  })
  it('uses custom label when provided', () => {
    const html = emailLayout({ body: '<p>hi</p>', branding, unsubscribeLabel: 'Désabonner' })
    expect(html).toContain('Désabonner')
  })
})

describe('htmlToText', () => {
  it('strips HTML tags', () => {
    expect(htmlToText('<p>hello <strong>world</strong></p>')).toContain('hello world')
  })
  it('decodes HTML entities', () => {
    expect(htmlToText('<p>&amp; &lt;tag&gt;</p>')).toContain('& <tag>')
  })
  it('removes script/style content', () => {
    expect(htmlToText('<style>x</style><p>y</p><script>z</script>')).not.toContain('x')
    expect(htmlToText('<style>x</style><p>y</p><script>z</script>')).not.toContain('z')
    expect(htmlToText('<style>x</style><p>y</p><script>z</script>')).toContain('y')
  })
})
