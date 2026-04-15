export interface EmailSender {
  email: string
  name: string
}

export interface EmailMessage {
  from: EmailSender
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  metadata?: Record<string, unknown>
}

export interface EmailResult {
  messageId: string
  provider: 'brevo'
}

export interface EmailWebhookEvent {
  providerMessageId: string
  type: 'delivered' | 'bounced' | 'complained' | 'unsubscribed'
  timestamp: string
  metadata?: Record<string, unknown>
}
