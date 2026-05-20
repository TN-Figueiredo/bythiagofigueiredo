import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { Newsletter } from '../../../src/emails/newsletter'

describe('Newsletter edition template', () => {
  const baseProps = {
    subject: 'Edition #1',
    contentHtml: '<p>Hello world</p>',
    typeName: 'Diário do bythiago',
    typeColor: '#FF8240',
    unsubscribeUrl: 'https://example.com/unsub',
    archiveUrl: 'https://example.com/archive',
  }

  it('renders with branded background', async () => {
    const html = await render(React.createElement(Newsletter, baseProps))
    expect(html).toContain('#F7F1E8')
  })

  it('renders TF monogram', async () => {
    const html = await render(React.createElement(Newsletter, baseProps))
    expect(html).toContain('#FF8240')
  })

  it('renders newsletter type name', async () => {
    const html = await render(React.createElement(Newsletter, baseProps))
    expect(html).toContain('Diário do bythiago')
  })

  it('renders content HTML', async () => {
    const html = await render(React.createElement(Newsletter, baseProps))
    expect(html).toContain('Hello world')
  })

  it('renders preheader when provided', async () => {
    const html = await render(
      React.createElement(Newsletter, { ...baseProps, preheader: 'Preview text here' })
    )
    expect(html).toContain('Preview text here')
  })

  it('includes end mark with fleuron', async () => {
    const html = await render(React.createElement(Newsletter, baseProps))
    expect(html).toContain('❦')
    expect(html).toContain('Thiago Figueiredo')
  })

  it('includes footer with unsubscribe and archive links', async () => {
    const html = await render(React.createElement(Newsletter, baseProps))
    expect(html).toContain('https://example.com/unsub')
    expect(html).toContain('https://example.com/archive')
  })

  it('includes dark mode styles', async () => {
    const html = await render(React.createElement(Newsletter, baseProps))
    expect(html).toContain('prefers-color-scheme: dark')
  })
})
