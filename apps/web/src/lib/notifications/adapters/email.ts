import { getEmailService } from '@/lib/email/service'
import type { IChannelAdapter, ChannelResult, IUserProfile } from './interface'
import type { INotification } from '../types'

// O html é montado por concatenação: título e mensagem podem trazer texto de fora (nome de canal do
// YouTube, erro do banco). Escapa tudo o que é interpolado; o assunto perde quebras e controles.
export function escapeHtml(v: string | null | undefined): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
export function safeSubject(v: string | null | undefined): string {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g, ' ').trim()
}

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
      // Menor 7 (docs/superpowers/plans/2026-09-02-falhas-silenciosas.md): do
      // not pass configurationSet here. getEmailService()'s singleton already
      // resolves SES_TRANSACTIONAL_CONFIG_SET ?? SES_DEFAULT_CONFIG_SET once
      // at construction (lib/email/service.ts) — re-reading only the first
      // half of that fallback here bypasses it for no benefit and is a
      // footgun if the two ever need to diverge. Let the singleton decide.
      await getEmailService().send({
        from: { email: `noreply@${fromDomain}`, name: 'Notifications' },
        to: user.email,
        subject: safeSubject(notification.title),
        html: `<p>${escapeHtml(notification.message ?? notification.title)}</p>`,
        text: notification.message ?? notification.title,
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
