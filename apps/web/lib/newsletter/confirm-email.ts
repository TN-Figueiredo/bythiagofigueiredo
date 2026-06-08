import crypto, { createHmac } from 'node:crypto'
import { render } from '@react-email/render'
import { getEmailService } from '../email/service'
import { captureServerActionError } from '../../src/lib/sentry-wrap'
import { ConfirmEmail } from '../../src/emails/confirm'
import { getServerEnv } from '../../src/lib/env'

export function generateConfirmToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashConfirmToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

function getUnsubscribeKey(): Buffer {
  // Dedicated secret decouples unsubscribe links from CRON_SECRET rotation;
  // falls back to CRON_SECRET so existing links keep working until set.
  // Rotating UNSUBSCRIBE_TOKEN_SECRET invalidates outstanding links
  // (regenerated on next send).
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET ?? process.env.CRON_SECRET ?? getServerEnv().CRON_SECRET
  return crypto.createHash('sha256').update(`unsubscribe-token:${secret}`).digest()
}

export function generateUnsubscribeToken(siteId: string, email: string): { raw: string; hash: string } {
  const key = getUnsubscribeKey()
  const raw = createHmac('sha256', key).update(`${siteId}:${email.toLowerCase()}`).digest('hex')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  return { raw, hash }
}

export function buildConfirmUrl(rawToken: string, _locale: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base}/newsletter/confirm/${rawToken}`
}

export interface SendConfirmEmailOpts {
  to: string
  rawToken: string
  locale: string
  action?: string
  newsletterNames?: string[]
}

export async function sendNewsletterConfirmEmail(opts: SendConfirmEmailOpts): Promise<boolean> {
  const { to, rawToken, locale, action = 'newsletter_subscribe', newsletterNames } = opts
  const confirmUrl = buildConfirmUrl(rawToken, locale)
  const isPt = locale === 'pt-BR'
  const domain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'
  try {
    const confirmTemplate = ConfirmEmail({ confirmUrl, locale, newsletterNames })
    const html = await render(confirmTemplate)
    const text = await render(confirmTemplate, { plainText: true })
    await getEmailService().send({
      from: { name: 'Thiago Figueiredo', email: `no-reply@${domain}` },
      to,
      subject: isPt ? 'Confirme sua inscrição' : 'Confirm your subscription',
      html,
      text,
      metadata: {
        // Double-opt-in confirmation GATES every new signup — it must ride the
        // transactional config-set so a marketing complaint spike can never
        // suppress it.
        configurationSet: process.env.SES_TRANSACTIONAL_CONFIG_SET ?? process.env.SES_DEFAULT_CONFIG_SET,
        // mailto List-Unsubscribe (no one-click): a pending subscriber has no
        // unsubscribe token yet, but offering an opt-out path improves inbox
        // placement and lets the recipient bail out of the confirmation flow.
        headers: {
          'List-Unsubscribe': `<mailto:unsubscribe@${domain}?subject=unsubscribe>`,
        },
      },
    })
    return true
  } catch (err) {
    captureServerActionError(err, { action, branch: 'send_confirm_email' })
    return false
  }
}
