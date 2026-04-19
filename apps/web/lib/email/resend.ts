/**
 * Thin adapter for sending transactional emails via the configured email service.
 * Wraps the IEmailService / BrevoEmailAdapter used elsewhere, exposing a simpler
 * low-level `sendTransactionalEmail` surface for one-off HTML emails that don't
 * need a full template / i18n chain.
 */
import { getEmailService } from './service'

const DEFAULT_FROM = {
  email: `noreply@bythiagofigueiredo.com`,
  name: 'Thiago Figueiredo',
}

export interface TransactionalEmailOptions {
  to: string
  subject: string
  html: string
  /** Optional plain-text version. Falls back to stripping HTML if omitted. */
  text?: string
  from?: { email: string; name: string }
}

export async function sendTransactionalEmail(opts: TransactionalEmailOptions): Promise<void> {
  const service = getEmailService()
  await service.send({
    from: opts.from ?? DEFAULT_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  })
}
