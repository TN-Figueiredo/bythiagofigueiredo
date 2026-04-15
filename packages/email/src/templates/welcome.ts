import { emailLayout, emailButton, escapeHtml } from './base-layout'
import type { IEmailTemplate } from '../interfaces/email-template'
import type { EmailBranding } from '../types/branding'

export interface WelcomeVars extends Record<string, unknown> {
  name?: string
  siteUrl: string
  branding: EmailBranding
}

export const welcomeTemplate: IEmailTemplate<WelcomeVars> = {
  name: 'welcome',
  async render(vars, locale) {
    const isEn = locale === 'en'
    const greetingPt = vars.name ? `Bem-vindo, ${escapeHtml(vars.name)}!` : 'Bem-vindo!'
    const greetingEn = vars.name ? `Welcome, ${escapeHtml(vars.name)}!` : 'Welcome!'
    const subject = isEn ? greetingEn : greetingPt
    const intro = isEn
      ? `<p>Thanks for subscribing to <strong>${escapeHtml(vars.branding.brandName)}</strong>.</p>`
      : `<p>Obrigado por se inscrever em <strong>${escapeHtml(vars.branding.brandName)}</strong>.</p>`
    const cta = emailButton({
      url: vars.siteUrl,
      label: isEn ? 'Visit the site' : 'Visite o site',
      color: vars.branding.primaryColor,
    })
    return {
      subject,
      html: emailLayout({
        body: `<h1>${subject}</h1>${intro}<p>${cta}</p>`,
        branding: vars.branding,
      }),
    }
  },
}
