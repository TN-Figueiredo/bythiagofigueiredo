/**
 * Thin transactional email helper — wraps the site email service
 * (`getEmailService()`) for ad-hoc HTML sends without a structured template.
 *
 * The function name follows the Resend SDK convention so callers can swap the
 * underlying transport later without touching their call sites.
 */
import { getEmailService } from './service'

const DEFAULT_FROM_EMAIL =
  process.env.DEFAULT_FROM_EMAIL ?? 'noreply@bythiagofigueiredo.com'
const DEFAULT_FROM_NAME = process.env.DEFAULT_FROM_NAME ?? 'Thiago Figueiredo'

export interface TransactionalEmailOptions {
  to: string
  subject: string
  html: string
  fromEmail?: string
  fromName?: string
}

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  fromEmail = DEFAULT_FROM_EMAIL,
  fromName = DEFAULT_FROM_NAME,
}: TransactionalEmailOptions): Promise<void> {
  const service = getEmailService()
  await service.send({
    from: { email: fromEmail, name: fromName },
    to,
    subject,
    html,
  })
}
