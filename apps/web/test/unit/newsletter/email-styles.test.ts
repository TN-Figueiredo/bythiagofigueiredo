import { describe, it, expect } from 'vitest'
import { getEmailStylesheet } from '@/lib/newsletter/email-styles'

describe('getEmailStylesheet', () => {
  it('interpolates type color into link and blockquote rules', () => {
    const css = getEmailStylesheet('#ff0000')
    expect(css).toContain('color:#ff0000')
    expect(css).toContain('border-left:3px solid #ff0000')
    expect(css).toContain('background:#ff0000')
  })

  it('uses default purple when no color provided', () => {
    const css = getEmailStylesheet()
    expect(css).toContain('#7c3aed')
  })

  it('includes all required email-safe base rules', () => {
    const css = getEmailStylesheet('#000')
    expect(css).toContain('font-family:Arial,sans-serif')
    expect(css).toContain('font-family:Georgia,serif')
    expect(css).toContain('max-width:600px')
    expect(css).toContain('.cta-button')
    expect(css).toContain('.cta-wrapper')
    expect(css).toContain('display:block')
  })

  it('does not include unsafe CSS properties', () => {
    const css = getEmailStylesheet('#000')
    expect(css).not.toContain('position:')
    expect(css).not.toContain('display:flex')
    expect(css).not.toContain('display:grid')
  })
})
