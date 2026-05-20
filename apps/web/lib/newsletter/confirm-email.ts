import crypto from 'node:crypto'
import { getEmailService } from '../email/service'
import { captureServerActionError } from '../../src/lib/sentry-wrap'

export function generateConfirmToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashConfirmToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export function buildConfirmUrl(rawToken: string, locale: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const prefix = locale === 'pt-BR' ? '/pt' : ''
  return `${base}${prefix}/newsletter/confirm/${rawToken}`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildConfirmHtml(confirmUrl: string, locale: string): string {
  const isPt = locale === 'pt-BR'
  const safeUrl = escapeHtml(confirmUrl)
  return `<!DOCTYPE html>
<html lang="${isPt ? 'pt-BR' : 'en'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${isPt ? 'Confirme sua inscrição' : 'Confirm your subscription'}</title></head>
<body style="margin:0;padding:0;background:#F5EDD6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5EDD6;">
<tr><td align="center" style="padding:48px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FBF6E8;border-radius:8px;">
<tr><td style="padding:40px 32px;">
  <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:500;color:#161208;margin:0 0 16px;letter-spacing:-0.02em;">${isPt ? 'Quase lá.' : 'Almost there.'}</h1>
  <p style="font-size:15px;line-height:1.6;color:#6A5F48;margin:0 0 28px;">${isPt
    ? 'Clique no botão abaixo para confirmar sua inscrição na newsletter.'
    : 'Click the button below to confirm your newsletter subscription.'}</p>
  <table role="presentation" cellpadding="0" cellspacing="0">
  <tr><td style="background:#C14513;border-radius:6px;">
    <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${isPt ? 'Confirmar inscrição' : 'Confirm subscription'}</a>
  </td></tr>
  </table>
  <p style="font-size:12px;line-height:1.6;color:#9C9178;margin:32px 0 0;">${isPt
    ? 'Se você não se inscreveu, pode ignorar este email.'
    : "If you didn't subscribe, you can safely ignore this email."}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export interface SendConfirmEmailOpts {
  to: string
  rawToken: string
  locale: string
  action?: string
}

export async function sendNewsletterConfirmEmail(opts: SendConfirmEmailOpts): Promise<void> {
  const { to, rawToken, locale, action = 'newsletter_subscribe' } = opts
  const confirmUrl = buildConfirmUrl(rawToken, locale)
  const isPt = locale === 'pt-BR'
  const domain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'
  try {
    await getEmailService().send({
      from: { name: 'Thiago Figueiredo', email: `no-reply@${domain}` },
      to,
      subject: isPt ? 'Confirme sua inscrição' : 'Confirm your subscription',
      html: buildConfirmHtml(confirmUrl, locale),
    })
  } catch (err) {
    captureServerActionError(err, { action, branch: 'send_confirm_email' })
  }
}
