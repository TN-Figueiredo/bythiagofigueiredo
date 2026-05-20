import { describe, it, expect } from 'vitest'
import { getEmailStylesheet } from '../../../lib/newsletter/email-styles'

describe('getEmailStylesheet', () => {
  it('defaults to branded accent #FF8240 instead of purple', () => {
    const css = getEmailStylesheet()
    expect(css).toContain('#FF8240')
    expect(css).not.toContain('#7c3aed')
  })

  it('uses type color when provided', () => {
    const css = getEmailStylesheet('#1F5F8B')
    expect(css).toContain('#1F5F8B')
  })

  it('uses branded ink color for headings', () => {
    const css = getEmailStylesheet()
    expect(css).toContain('#1F1B17')
  })

  it('uses branded muted color for body text', () => {
    const css = getEmailStylesheet()
    expect(css).toContain('#6A5F48')
  })

  it('includes drop cap styles', () => {
    const css = getEmailStylesheet()
    expect(css).toContain('.drop-cap')
  })

  it('includes pull quote styles', () => {
    const css = getEmailStylesheet()
    expect(css).toContain('blockquote')
  })

  it('includes subheading styles', () => {
    const css = getEmailStylesheet()
    expect(css).toContain('h2')
    expect(css).toContain('h3')
  })
})
