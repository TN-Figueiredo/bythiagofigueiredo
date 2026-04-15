import type { EmailMessage, EmailResult, EmailWebhookEvent } from '../types/message'
import type { IEmailTemplate } from './email-template'

export interface IEmailService {
  send(msg: EmailMessage): Promise<EmailResult>
  sendTemplate<V extends Record<string, unknown>>(
    template: IEmailTemplate<V>,
    sender: EmailMessage['from'],
    to: string,
    variables: V,
    locale?: string,
    options?: { replyTo?: string; metadata?: Record<string, unknown> },
  ): Promise<EmailResult>
  handleWebhook?(payload: unknown, signature: string): Promise<EmailWebhookEvent[]>
}
