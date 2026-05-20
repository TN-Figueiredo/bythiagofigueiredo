import crypto from 'node:crypto'
import { render } from '@react-email/render'
import { getEmailService } from '../email/service'
import { captureServerActionError } from '../../src/lib/sentry-wrap'
import { ConfirmEmail } from '../../src/emails/confirm'

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

export interface SendConfirmEmailOpts {
  to: string
  rawToken: string
  locale: string
  action?: string
  newsletterNames?: string[]
}

export async function sendNewsletterConfirmEmail(opts: SendConfirmEmailOpts): Promise<void> {
  const { to, rawToken, locale, action = 'newsletter_subscribe', newsletterNames } = opts
  const confirmUrl = buildConfirmUrl(rawToken, locale)
  const isPt = locale === 'pt-BR'
  const domain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'
  try {
    const html = await render(ConfirmEmail({ confirmUrl, locale, newsletterNames }))
    await getEmailService().send({
      from: { name: 'Thiago Figueiredo', email: `no-reply@${domain}` },
      to,
      subject: isPt ? 'Confirme sua inscrição' : 'Confirm your subscription',
      html,
    })
  } catch (err) {
    captureServerActionError(err, { action, branch: 'send_confirm_email' })
  }
}
