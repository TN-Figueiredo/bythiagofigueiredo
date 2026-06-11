import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { EmailDivider } from '../../../src/emails/components/email-divider'
import { EmailEndMark } from '../../../src/emails/components/email-end-mark'
import { EmailFooter } from '../../../src/emails/components/email-footer'

describe('EmailDivider', () => {
  it('renders a horizontal line with branded color', async () => {
    const html = await render(React.createElement(EmailDivider))
    expect(html).toContain('#E8DCC8')
  })
})

describe('EmailEndMark', () => {
  it('renders the fleuron symbol', async () => {
    const html = await render(React.createElement(EmailEndMark))
    expect(html).toContain('❦')
  })

  it('renders the flanking line decoration', async () => {
    const html = await render(React.createElement(EmailEndMark))
    expect(html).toContain('border-top')
    expect(html).toContain('#FF8240')
  })
})

describe('EmailFooter', () => {
  it('renders unsubscribe link', async () => {
    const html = await render(
      React.createElement(EmailFooter, {
        unsubscribeUrl: 'https://example.com/unsub',
        archiveUrl: 'https://example.com/archive',
      })
    )
    expect(html).toContain('https://example.com/unsub')
  })

  it('renders archive link', async () => {
    const html = await render(
      React.createElement(EmailFooter, {
        unsubscribeUrl: 'https://example.com/unsub',
        archiveUrl: 'https://example.com/archive',
      })
    )
    expect(html).toContain('https://example.com/archive')
  })

  it('renders bythiagofigueiredo.com home link', async () => {
    const html = await render(
      React.createElement(EmailFooter, {
        unsubscribeUrl: '#',
        archiveUrl: '#',
      })
    )
    expect(html).toContain('bythiagofigueiredo.com')
  })

  it('renders the postal address when NEWSLETTER_POSTAL_ADDRESS is set', async () => {
    process.env.NEWSLETTER_POSTAL_ADDRESS = 'Av. Teste 123, São Paulo - SP, Brasil'
    try {
      const html = await render(
        React.createElement(EmailFooter, {
          unsubscribeUrl: '#',
          archiveUrl: '#',
        })
      )
      expect(html).toContain('Av. Teste 123, São Paulo - SP, Brasil')
    } finally {
      delete process.env.NEWSLETTER_POSTAL_ADDRESS
    }
  })

  it('omits the postal address line entirely when NEWSLETTER_POSTAL_ADDRESS is unset (no placeholder)', async () => {
    delete process.env.NEWSLETTER_POSTAL_ADDRESS
    const html = await render(
      React.createElement(EmailFooter, {
        unsubscribeUrl: '#',
        archiveUrl: '#',
      })
    )
    // No fake/placeholder address may ever render (CAN-SPAM + spam heuristics).
    expect(html).not.toContain('undefined')
    expect(html).not.toMatch(/postal|address/i)
  })
})
