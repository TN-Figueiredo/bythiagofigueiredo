import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { WelcomeEmail } from '../../../src/emails/welcome'

describe('WelcomeEmail React Email template', () => {
  it('renders pt-BR welcome heading', async () => {
    const html = await render(
      React.createElement(WelcomeEmail, {
        locale: 'pt-BR',
        newsletterNames: [{ name: 'Diário do bythiago', tagline: 'resumo da semana', color: '#FF8240' }],
        unsubscribeUrl: 'https://example.com/unsubscribe/token123',
      })
    )
    expect(html).toContain('Bem-vindo')
    expect(html).toContain('Diário do bythiago')
  })

  it('renders en welcome heading', async () => {
    const html = await render(
      React.createElement(WelcomeEmail, {
        locale: 'en',
        newsletterNames: [{ name: 'Weekly Digest', tagline: 'weekly', color: '#FF8240' }],
        unsubscribeUrl: 'https://example.com/unsubscribe/token123',
      })
    )
    expect(html).toContain('Welcome')
    expect(html).toContain('Weekly Digest')
  })

  it('renders latest article card when provided', async () => {
    const html = await render(
      React.createElement(WelcomeEmail, {
        locale: 'pt-BR',
        newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
        unsubscribeUrl: 'https://example.com/unsubscribe/token123',
        latestArticle: {
          title: 'Meu primeiro artigo',
          url: 'https://example.com/blog/primeiro',
          excerpt: 'Uma breve introdução...',
        },
      })
    )
    expect(html).toContain('Meu primeiro artigo')
    expect(html).toContain('https://example.com/blog/primeiro')
  })

  it('includes monogram and end mark', async () => {
    const html = await render(
      React.createElement(WelcomeEmail, {
        locale: 'pt-BR',
        newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
        unsubscribeUrl: 'https://example.com/unsubscribe/token123',
      })
    )
    expect(html).toContain('#FF8240')
    expect(html).toContain('❦')
  })

  it('renders unsubscribe link in footer', async () => {
    const html = await render(
      React.createElement(WelcomeEmail, {
        locale: 'pt-BR',
        newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
        unsubscribeUrl: 'https://example.com/unsubscribe/mytoken',
      })
    )
    expect(html).toContain('https://example.com/unsubscribe/mytoken')
  })
})
