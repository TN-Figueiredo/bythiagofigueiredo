import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { EmailNewsletterList } from '../../../src/emails/components/email-newsletter-list'

const items = [
  { name: 'Diário do bythiago', tagline: 'resumo da semana · sextas', color: '#FF8240' },
  { name: 'Código em português', tagline: 'bugs reais · mensal', color: '#1F5F8B' },
]

describe('EmailNewsletterList', () => {
  it('renders each newsletter name', async () => {
    const html = await render(React.createElement(EmailNewsletterList, { items }))
    expect(html).toContain('Diário do bythiago')
    expect(html).toContain('Código em português')
  })

  it('renders taglines', async () => {
    const html = await render(React.createElement(EmailNewsletterList, { items }))
    expect(html).toContain('resumo da semana')
    expect(html).toContain('bugs reais')
  })

  it('applies left border color', async () => {
    const html = await render(React.createElement(EmailNewsletterList, { items }))
    expect(html).toContain('#FF8240')
    expect(html).toContain('#1F5F8B')
  })

  it('renders label when provided', async () => {
    const html = await render(
      React.createElement(EmailNewsletterList, { items, label: 'Suas newsletters:' })
    )
    expect(html).toContain('Suas newsletters:')
  })

  it('returns null for empty array', async () => {
    const html = await render(
      React.createElement(EmailNewsletterList, { items: [] })
    )
    expect(html).not.toContain('border-left')
  })
})
