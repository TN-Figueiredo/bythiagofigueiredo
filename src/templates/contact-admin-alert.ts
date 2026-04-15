import { emailLayout, emailButton, escapeHtml } from './base-layout'
import type { IEmailTemplate } from '../interfaces/email-template'
import type { EmailBranding } from '../types/branding'

export interface ContactAdminAlertVars extends Record<string, unknown> {
  submitterName: string
  submitterEmail: string
  message: string
  viewInAdminUrl: string
  branding: EmailBranding
}

export const contactAdminAlertTemplate: IEmailTemplate<ContactAdminAlertVars> = {
  name: 'contact-admin-alert',
  async render(vars, locale) {
    const isEn = locale === 'en'
    const subject = isEn
      ? `New contact: ${vars.submitterName}`
      : `Novo contato: ${vars.submitterName}`
    const fromLine = isEn ? 'From' : 'De'
    const messageLine = isEn ? 'Message' : 'Mensagem'
    const body = `<h1>${subject}</h1>
      <p><strong>${fromLine}:</strong> ${escapeHtml(vars.submitterName)} &lt;${escapeHtml(vars.submitterEmail)}&gt;</p>
      <p><strong>${messageLine}:</strong></p>
      <blockquote style="border-left:3px solid #ddd;padding-left:12px;margin:12px 0;color:#555;">${escapeHtml(vars.message).replace(/\n/g, '<br>')}</blockquote>
      <p>${emailButton({ url: vars.viewInAdminUrl, label: isEn ? 'View in admin' : 'Ver no admin', color: vars.branding.primaryColor })}</p>`
    return { subject, html: emailLayout({ body, branding: vars.branding }) }
  },
}
