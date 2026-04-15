import { emailLayout, escapeHtml, htmlToText } from './base-layout'
import type { IEmailTemplate } from '../interfaces/email-template'
import type { EmailBranding } from '../types/branding'

export interface ContactReceivedVars extends Record<string, unknown> {
  name: string
  expectedReplyTime: string
  branding: EmailBranding
}

export const contactReceivedTemplate: IEmailTemplate<ContactReceivedVars> = {
  name: 'contact-received',
  async render(vars, locale) {
    const isEn = locale === 'en'
    const subject = isEn ? `We received your message — ${vars.branding.brandName}` : `Recebemos sua mensagem — ${vars.branding.brandName}`
    const body = isEn
      ? `<h1>Hi, ${escapeHtml(vars.name)}</h1>
         <p>Thanks for reaching out. We received your message and will respond within ${vars.expectedReplyTime}.</p>
         <p>— Team ${escapeHtml(vars.branding.brandName)}</p>`
      : `<h1>Olá, ${escapeHtml(vars.name)}</h1>
         <p>Obrigado pelo contato. Recebemos sua mensagem e responderemos em até ${vars.expectedReplyTime}.</p>
         <p>— Equipe ${escapeHtml(vars.branding.brandName)}</p>`
    const html = emailLayout({ body, branding: vars.branding, locale })
    return { subject, html, text: htmlToText(html) }
  },
}
