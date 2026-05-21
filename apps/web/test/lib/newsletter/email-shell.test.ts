import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import { EmailShell } from '../../../src/emails/components/email-shell'
import { Text } from '@react-email/components'
import React from 'react'

describe('EmailShell', () => {
  it('renders wrapper with branded background color', async () => {
    const html = await render(
      React.createElement(EmailShell, { preheader: 'test preview' },
        React.createElement(Text, null, 'Hello')
      )
    )
    expect(html).toContain('#F7F1E8')
    expect(html).toContain('#FBF6EC')
    expect(html).toContain('Hello')
  })

  it('includes preheader text', async () => {
    const html = await render(
      React.createElement(EmailShell, { preheader: 'My preview text' },
        React.createElement(Text, null, 'Body')
      )
    )
    expect(html).toContain('My preview text')
  })

  it('includes dark mode media query in head', async () => {
    const html = await render(
      React.createElement(EmailShell, {},
        React.createElement(Text, null, 'Body')
      )
    )
    expect(html).toContain('prefers-color-scheme: dark')
    expect(html).toContain('#1A1714')
  })

  it('sets max-width 600 on container', async () => {
    const html = await render(
      React.createElement(EmailShell, {},
        React.createElement(Text, null, 'Body')
      )
    )
    expect(html).toContain('600')
  })

  it('renders accent stripe with default color', async () => {
    const html = await render(
      React.createElement(EmailShell, {},
        React.createElement(Text, null, 'Body')
      )
    )
    expect(html).toContain('background:#FF8240')
  })

  it('renders accent stripe with custom color', async () => {
    const html = await render(
      React.createElement(EmailShell, { accentColor: '#E53E3E' },
        React.createElement(Text, null, 'Body')
      )
    )
    expect(html).toContain('background:#E53E3E')
  })
})
