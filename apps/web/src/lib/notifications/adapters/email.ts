import { ResendEmailAdapter } from '@tn-figueiredo/email'
import type { IChannelAdapter, ChannelResult, IUserProfile } from './interface'
import type { INotification } from '../types'

export class EmailAdapter implements IChannelAdapter {
  readonly channel = 'email' as const

  async send(
    notification: INotification,
    user: IUserProfile,
  ): Promise<ChannelResult> {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return { success: false, error: 'RESEND_API_KEY not configured' }
    }

    if (!user.email) {
      return { success: false, error: 'User has no email address' }
    }

    const fromDomain =
      process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'

    try {
      const adapter = new ResendEmailAdapter(apiKey)

      await adapter.send({
        from: { email: `noreply@${fromDomain}`, name: 'Notifications' },
        to: user.email,
        subject: notification.title,
        html: `<p>${notification.message ?? notification.title}</p>`,
        text: notification.message ?? notification.title,
      })

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  async healthCheck(): Promise<boolean> {
    return !!process.env.RESEND_API_KEY
  }
}
