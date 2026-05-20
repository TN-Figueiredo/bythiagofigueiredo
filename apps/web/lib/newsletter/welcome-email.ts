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
}

export async function sendWelcomeEmail(opts: WelcomeEmailOpts): Promise<void> {
  const { to, locale, newsletterNames, latestArticle } = opts
  const isPt = locale === 'pt-BR'
  const domain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'

  try {
    const html = await render(WelcomeEmail({ locale, newsletterNames, latestArticle }))
    await getEmailService().send({
      from: { name: 'Thiago Figueiredo', email: `no-reply@${domain}` },
      to,
      subject: isPt ? 'Bem-vindo à newsletter!' : 'Welcome to the newsletter!',
      html,
    })
  } catch (err) {
    captureServerActionError(err, { action: 'send_welcome_email', branch: 'send' })
  }
}
