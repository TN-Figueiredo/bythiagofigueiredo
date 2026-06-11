import { render } from '@react-email/render'
import { getEmailService } from '../email/service'
import { captureServerActionError } from '../../src/lib/sentry-wrap'
import { WelcomeEmail } from '../../src/emails/welcome'
import type { NewsletterListItem } from '../../src/emails/components/email-newsletter-list'

interface LatestArticle {
  title: string
  url: string
  excerpt?: string
}

export interface WelcomeEmailOpts {
  to: string
  locale: string
  newsletterNames: NewsletterListItem[]
  latestArticle?: LatestArticle
  unsubscribeUrl: string
  archiveUrl?: string
  /** newsletter_types.reply_to when set — same source editions use. Replies to
   *  the welcome land in a real mailbox instead of bouncing off no-reply@. */
  replyTo?: string
}

export async function sendWelcomeEmail(opts: WelcomeEmailOpts): Promise<boolean> {
  const { to, locale, newsletterNames, latestArticle, unsubscribeUrl, archiveUrl, replyTo } = opts
  const isPt = locale === 'pt-BR'
  const domain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'
  const fromEmail = `no-reply@${domain}`

  try {
    const welcomeTemplate = WelcomeEmail({
      locale,
      newsletterNames,
      latestArticle,
      unsubscribeUrl,
      archiveUrl,
      // "Add to contacts" nudge advertises the actual from-address (the one
      // Gmail scores) — derived from env, never hardcoded.
      senderEmail: fromEmail,
      // Reply invite only when replies actually land somewhere: the from is
      // no-reply@, so without a replyTo the invite would bounce people.
      canReply: Boolean(replyTo),
    })
    const html = await render(welcomeTemplate)
    const text = await render(welcomeTemplate, { plainText: true })
    await getEmailService().send({
      from: { name: 'Thiago Figueiredo', email: fromEmail },
      to,
      subject: isPt ? 'Bem-vindo à newsletter!' : 'Welcome to the newsletter!',
      html,
      text,
      metadata: {
        // Explicitly tag as transactional so welcome mail never rides the
        // marketing config-set's reputation/suppression list.
        configurationSet: process.env.SES_TRANSACTIONAL_CONFIG_SET ?? process.env.SES_DEFAULT_CONFIG_SET,
        headers: {
          // HTTPS one-click ONLY. No inbound processing exists for an
          // unsubscribe@ mailbox — advertising a dead mailto would silently
          // swallow unsubscribe attempts and convert them into complaints.
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      },
      ...(replyTo ? { replyTo } : {}),
    })
    return true
  } catch (err) {
    captureServerActionError(err, { action: 'send_welcome_email', branch: 'send' })
    return false
  }
}
