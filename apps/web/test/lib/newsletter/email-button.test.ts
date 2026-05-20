import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { EmailButton } from '../../../src/emails/components/email-button'

describe('EmailButton', () => {
  it('renders a link with the href', async () => {
    const html = await render(
      React.createElement(EmailButton, { href: 'https://example.com' }, 'Click me')
    )
    expect(html).toContain('https://example.com')
    expect(html).toContain('Click me')
  })

  it('uses accent color as background by default', async () => {
    const html = await render(
      React.createElement(EmailButton, { href: '#' }, 'Go')
    )
    expect(html).toContain('#FF8240')
  })

  it('accepts custom color', async () => {
    const html = await render(
      React.createElement(EmailButton, { href: '#', color: '#4CAF50' }, 'Go')
    )
    expect(html).toContain('#4CAF50')
  })

  it('includes Outlook VML fallback', async () => {
    const html = await render(
      React.createElement(EmailButton, { href: 'https://example.com' }, 'Click')
    )
    expect(html).toContain('v:roundrect')
    expect(html).toContain('mso')
  })
})
