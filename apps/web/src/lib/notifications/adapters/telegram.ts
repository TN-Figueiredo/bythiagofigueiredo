import type { IChannelAdapter, ChannelResult, IUserProfile } from './interface'
import type { INotification } from '../types'

const TELEGRAM_API = 'https://api.telegram.org'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export class TelegramAdapter implements IChannelAdapter {
  readonly channel = 'telegram' as const

  async send(
    notification: INotification,
    user: IUserProfile,
  ): Promise<ChannelResult> {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      return { success: false, error: 'TELEGRAM_BOT_TOKEN not configured' }
    }

    if (!user.telegram_chat_id) {
      return { success: false, error: 'User has no telegram_chat_id' }
    }

    const title = escapeHtml(notification.title)
    const message = notification.message
      ? escapeHtml(notification.message)
      : ''
    const html = message
      ? `<b>${title}</b>\n${message}`
      : `<b>${title}</b>`

    try {
      const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: user.telegram_chat_id,
          text: html,
          parse_mode: 'HTML',
        }),
      })

      if (!res.ok) {
        const body = (await res.json()) as { description?: string }
        return {
          success: false,
          error: body.description ?? `HTTP ${res.status}`,
        }
      }

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  async healthCheck(): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) return false

    try {
      const res = await fetch(`${TELEGRAM_API}/bot${token}/getMe`)
      return res.ok
    } catch {
      return false
    }
  }
}
