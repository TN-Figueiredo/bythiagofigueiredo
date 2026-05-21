import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { ConfirmEmail } from '../../../src/emails/confirm'

describe('ConfirmEmail React Email template', () => {
  it('renders confirm URL in button', async () => {
    const html = await render(
      React.createElement(ConfirmEmail, {
        confirmUrl: 'https://example.com/confirm/abc',
        locale: 'pt-BR',
        newsletterNames: ['Diário do bythiago'],
      })
    )
    expect(html).toContain('https://example.com/confirm/abc')
    expect(html).toContain('Confirmar')
  })

  it('renders newsletter names', async () => {
    const html = await render(
      React.createElement(ConfirmEmail, {
        confirmUrl: 'https://example.com/confirm/abc',
        locale: 'pt-BR',
        newsletterNames: ['Diário do bythiago', 'Código em português'],
      })
    )
    expect(html).toContain('Diário do bythiago')
    expect(html).toContain('Código em português')
  })

  it('renders English copy for en locale', async () => {
    const html = await render(
      React.createElement(ConfirmEmail, {
        confirmUrl: 'https://example.com/confirm/abc',
        locale: 'en',
      })
    )
    expect(html).toContain('Confirm Subscription')
    expect(html).toContain('Confirm your subscription')
  })

  it('includes branded accent color', async () => {
    const html = await render(
      React.createElement(ConfirmEmail, {
        confirmUrl: '#',
        locale: 'pt-BR',
      })
    )
    expect(html).toContain('#FF8240')
  })

  it('includes dark mode styles', async () => {
    const html = await render(
      React.createElement(ConfirmEmail, {
        confirmUrl: '#',
        locale: 'pt-BR',
      })
    )
    expect(html).toContain('prefers-color-scheme: dark')
  })
})
