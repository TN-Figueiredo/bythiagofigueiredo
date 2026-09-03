import { getEmailService } from '@/lib/email/service'
import type { IChannelAdapter, ChannelResult, IUserProfile } from './interface'
import type { INotification } from '../types'

export class EmailAdapter implements IChannelAdapter {
  readonly channel = 'email' as const

  async send(
    notification: INotification,
    user: IUserProfile,
  ): Promise<ChannelResult> {
    if (!user.email) {
      return { success: false, error: 'usuario sem endereco de e-mail' }
    }

    const fromDomain =
      process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'

    try {
      await getEmailService().send({
        from: { email: `noreply@${fromDomain}`, name: 'Notifications' },
        to: user.email,
        subject: notification.title,
        html: `<p>${notification.message ?? notification.title}</p>`,
        text: notification.message ?? notification.title,
        metadata: { configurationSet: process.env.SES_TRANSACTIONAL_CONFIG_SET },
      })

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  async healthCheck(): Promise<boolean> {
    return !!process.env.AWS_SES_ACCESS_KEY_ID
  }
}
