import PQueue from 'p-queue'
import type { IEmailService } from '../interfaces/email-service'
import type { IEmailTemplate } from '../interfaces/email-template'
import type { EmailMessage, EmailResult, EmailWebhookEvent } from '../types/message'
import type { BrevoSendRequest, BrevoSendResponse } from './types'

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email'

export class BrevoEmailAdapter implements IEmailService {
  private queue: PQueue
  private maxRetries = 3
  private timeoutMs = 8000

  constructor(private apiKey: string) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('BrevoEmailAdapter: apiKey must be a non-empty string')
    }
    // Brevo free tier limit: 300/min = 5/sec
    this.queue = new PQueue({ concurrency: 5, interval: 1000, intervalCap: 5 })
  }

  async send(msg: EmailMessage): Promise<EmailResult> {
    const result = await this.queue.add(() => this.sendWithRetry(msg))
    if (!result) throw new Error('queue returned no result')
    return result
  }

  async sendTemplate<V extends Record<string, unknown>>(
    template: IEmailTemplate<V>,
    sender: EmailMessage['from'],
    to: string,
    variables: V,
    locale = 'pt-BR',
    options?: { replyTo?: string; metadata?: Record<string, unknown> },
  ): Promise<EmailResult> {
    const { subject, html, text } = await template.render(variables, locale)
    return this.send({
      from: sender,
      to,
      subject,
      html,
      text,
      replyTo: options?.replyTo,
      metadata: { ...(options?.metadata ?? {}), template: template.name, locale },
    })
  }

  async handleWebhook(_payload: unknown, _signature: string): Promise<EmailWebhookEvent[]> {
    throw new Error('not_implemented: Sprint 4 will implement webhook signature verification')
  }

  private async sendWithRetry(msg: EmailMessage): Promise<EmailResult> {
    let lastErr: unknown
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        return await this.doSend(msg)
      } catch (e) {
        lastErr = e
        const status = e instanceof Error && 'status' in e ? (e as { status: number }).status : 0
        if (status >= 400 && status < 500) throw e
        if (attempt > this.maxRetries) throw e
        await new Promise((r) => setTimeout(r, 200 * attempt))
      }
    }
    throw lastErr
  }

  private async doSend(msg: EmailMessage): Promise<EmailResult> {
    const body: BrevoSendRequest = {
      sender: msg.from,
      to: (Array.isArray(msg.to) ? msg.to : [msg.to]).map((email) => ({ email })),
      subject: msg.subject,
      htmlContent: msg.html,
      textContent: msg.text,
      replyTo: msg.replyTo ? { email: msg.replyTo } : undefined,
      tags: msg.metadata?.template ? [String(msg.metadata.template)] : undefined,
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const r = await fetch(BREVO_SEND_URL, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!r.ok) {
        const text = await r.text().catch(() => '')
        const err = new Error(`brevo ${r.status}: ${text}`) as Error & { status: number }
        err.status = r.status
        throw err
      }
      const data = (await r.json()) as BrevoSendResponse
      return { messageId: data.messageId, provider: 'brevo' }
    } finally {
      clearTimeout(timer)
    }
  }
}
