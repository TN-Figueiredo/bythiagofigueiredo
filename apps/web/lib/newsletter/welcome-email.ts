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
}

export async function sendWelcomeEmail(opts: WelcomeEmailOpts): Promise<boolean> {
  const { to, locale, newsletterNames, latestArticle, unsubscribeUrl, archiveUrl } = opts
  const isPt = locale === 'pt-BR'
  const domain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'

  try {
    const welcomeTemplate = WelcomeEmail({ locale, newsletterNames, latestArticle, unsubscribeUrl, archiveUrl })
    const html = await render(welcomeTemplate)
    const text = await render(welcomeTemplate, { plainText: true })
    await getEmailService().send({
      from: { name: 'Thiago Figueiredo', email: `no-reply@${domain}` },
      to,
      subject: isPt ? 'Bem-vindo à newsletter!' : 'Welcome to the newsletter!',
      html,
      text,
      metadata: {
        headers: {
          'List-Unsubscribe': `<mailto:unsubscribe@${domain}?subject=unsubscribe>, <${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      },
    })
    return true
  } catch (err) {
    captureServerActionError(err, { action: 'send_welcome_email', branch: 'send' })
    return false
  }
}
