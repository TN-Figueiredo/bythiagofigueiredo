import { Resend } from 'resend'
import type {
  IEmailService,
  EmailMessage,
  EmailResult,
  IEmailTemplate,
  EmailSender,
} from '@tn-figueiredo/email'

/**
 * Creates a Resend-backed IEmailService.
 *
 * Note: @tn-figueiredo/email@0.1.0 has provider: 'brevo' hard-coded in EmailResult.
 * We cast to satisfy the interface until the package widens the union in 0.2.0.
 */
export function createResendEmailService(): IEmailService {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')
  const client = new Resend(apiKey)

  const service: IEmailService = {
    async send(msg: EmailMessage): Promise<EmailResult> {
      const { data, error } = await client.emails.send({
        from: `${msg.from.name} <${msg.from.email}>`,
        to: Array.isArray(msg.to) ? msg.to : [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        replyTo: msg.replyTo,
        headers: msg.metadata?.headers as Record<string, string> | undefined,
      })
      if (error) throw new Error(error.message)
      // provider cast: EmailResult.provider is 'brevo' in @tn-figueiredo/email@0.1.0;
      // widened to 'brevo' | 'resend' in upcoming 0.2.0
      return { messageId: data!.id, provider: 'resend' as unknown as 'brevo' }
    },

    async sendTemplate<V extends Record<string, unknown>>(
      template: IEmailTemplate<V>,
      sender: EmailSender,
      to: string,
      variables: V,
      locale?: string,
    ): Promise<EmailResult> {
      const rendered = await template.render(variables, locale ?? 'pt-BR')
      return service.send({
        from: sender,
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      })
    },
  }

  return service
}
