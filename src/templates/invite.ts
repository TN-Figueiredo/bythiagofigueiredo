import { emailLayout, emailButton, escapeHtml } from './base-layout'
import type { IEmailTemplate } from '../interfaces/email-template'
import type { EmailBranding } from '../types/branding'

export interface InviteVars extends Record<string, unknown> {
  inviterName: string
  orgName: string
  role: 'owner' | 'admin' | 'editor' | 'author'
  acceptUrl: string
  expiresAt: Date
  branding: EmailBranding
}

const ROLES_PT: Record<string, string> = { owner: 'proprietário', admin: 'admin', editor: 'editor', author: 'autor' }
const ROLES_EN: Record<string, string> = { owner: 'owner', admin: 'admin', editor: 'editor', author: 'author' }

export const inviteTemplate: IEmailTemplate<InviteVars> = {
  name: 'invite',
  async render(vars, locale) {
    const isEn = locale === 'en'
    const subject = isEn
      ? `${vars.inviterName} invited you to ${vars.orgName}`
      : `${vars.inviterName} convidou você para ${vars.orgName}`
    const role = isEn ? ROLES_EN[vars.role] : ROLES_PT[vars.role]
    const expiresFmt = vars.expiresAt.toISOString().slice(0, 10)
    const body = isEn
      ? `<h1>You have an invitation</h1>
         <p><strong>${escapeHtml(vars.inviterName)}</strong> invited you to join <strong>${escapeHtml(vars.orgName)}</strong> as <strong>${escapeHtml(role!)}</strong>.</p>
         <p>This invitation expires on ${expiresFmt}.</p>
         <p>${emailButton({ url: vars.acceptUrl, label: 'Accept invitation', color: vars.branding.primaryColor })}</p>`
      : `<h1>Você recebeu um convite</h1>
         <p><strong>${escapeHtml(vars.inviterName)}</strong> convidou você para <strong>${escapeHtml(vars.orgName)}</strong> como <strong>${escapeHtml(role!)}</strong>.</p>
         <p>O convite expira em ${expiresFmt}.</p>
         <p>${emailButton({ url: vars.acceptUrl, label: 'Aceitar convite', color: vars.branding.primaryColor })}</p>`
    return { subject, html: emailLayout({ body, branding: vars.branding }) }
  },
}
