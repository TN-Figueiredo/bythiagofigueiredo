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

  it('renders the primary-tab nudge + add-to-contacts + reply invitation in pt-BR', async () => {
    const html = await render(
      React.createElement(WelcomeEmail, {
        locale: 'pt-BR',
        newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
        unsubscribeUrl: 'https://example.com/unsubscribe/token123',
        senderEmail: 'no-reply@example.com',
        canReply: true,
      })
    )
    expect(html).toContain('arraste pra')
    expect(html).toContain('Principal')
    expect(html).toContain('Melhor ainda: adicione')
    expect(html).toContain('no-reply@example.com')
    expect(html).toContain('aos contatos.')
    expect(html).toContain('Me conta o que te trouxe aqui — é só responder; eu leio tudo.')
  })

  it('renders the primary-tab nudge + add-to-contacts + reply invitation in en', async () => {
    const html = await render(
      React.createElement(WelcomeEmail, {
        locale: 'en',
        newsletterNames: [{ name: 'Weekly Digest', tagline: 'weekly', color: '#FF8240' }],
        unsubscribeUrl: 'https://example.com/unsubscribe/token123',
        senderEmail: 'no-reply@example.com',
        canReply: true,
      })
    )
    expect(html).toContain('drag it to')
    expect(html).toContain('Primary')
    expect(html).toContain('Even better: add')
    expect(html).toContain('no-reply@example.com')
    expect(html).toContain('to your contacts.')
    expect(html).toContain('Tell me what brought you here — just hit reply; I read everything.')
  })

  it('drops the add-to-contacts sentence when senderEmail is omitted but keeps the nudge', async () => {
    const html = await render(
      React.createElement(WelcomeEmail, {
        locale: 'pt-BR',
        newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
        unsubscribeUrl: 'https://example.com/unsubscribe/token123',
      })
    )
    expect(html).toContain('arraste pra')
    expect(html).not.toContain('Melhor ainda')
  })

  it('FIX: drops the reply invite when canReply is not set (no-reply@ from, replies would bounce) but keeps the nudge + thank-you', async () => {
    const html = await render(
      React.createElement(WelcomeEmail, {
        locale: 'pt-BR',
        newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
        unsubscribeUrl: 'https://example.com/unsubscribe/token123',
        senderEmail: 'no-reply@example.com',
      })
    )
    // No replyTo → inviting people to reply would bounce them off no-reply@.
    expect(html).not.toContain('é só responder')
    // Primary-tab nudge stays unconditional; sign-off copy intact.
    expect(html).toContain('arraste pra')
    expect(html).toContain('Obrigado por estar aqui.')
  })

  it('renders the reply invite when canReply is true', async () => {
    const html = await render(
      React.createElement(WelcomeEmail, {
        locale: 'en',
        newsletterNames: [{ name: 'Test', tagline: 'test', color: '#FF8240' }],
        unsubscribeUrl: 'https://example.com/unsubscribe/token123',
        canReply: true,
      })
    )
    expect(html).toContain('just hit reply; I read everything')
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
