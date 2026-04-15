import { emailLayout, emailButton } from './base-layout'
import type { IEmailTemplate } from '../interfaces/email-template'
import type { EmailBranding } from '../types/branding'

export interface ConfirmSubscriptionVars extends Record<string, unknown> {
  confirmUrl: string
  expiresAt: Date
  branding: EmailBranding
}

export const confirmSubscriptionTemplate: IEmailTemplate<ConfirmSubscriptionVars> = {
  name: 'confirm-subscription',
  async render(vars, locale) {
    const isEn = locale === 'en'
    const subject = isEn ? `Confirm your subscription to ${vars.branding.brandName}` : `Confirme sua inscrição em ${vars.branding.brandName}`
    const expiresFmt = vars.expiresAt.toISOString().slice(0, 10)
    const body = isEn
      ? `<h1>Confirm your subscription</h1>
         <p>Click below to confirm your email address. The link expires on ${expiresFmt}.</p>
         <p>${emailButton({ url: vars.confirmUrl, label: 'Confirm', color: vars.branding.primaryColor })}</p>
         <p style="font-size:12px;color:#999;">If you didn't request this, ignore this email.</p>`
      : `<h1>Confirme sua inscrição</h1>
         <p>Clique abaixo pra confirmar seu email. O link expira em ${expiresFmt}.</p>
         <p>${emailButton({ url: vars.confirmUrl, label: 'Confirmar', color: vars.branding.primaryColor })}</p>
         <p style="font-size:12px;color:#999;">Se você não solicitou, ignore este email.</p>`
    return { subject, html: emailLayout({ body, branding: vars.branding }) }
  },
}
