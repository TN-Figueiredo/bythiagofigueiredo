import * as Sentry from '@sentry/nextjs'

const SENTRY_TAG = { component: 'social-telegram' }

interface TelegramNotificationInput {
  chatId: string
  imageUrl: string
  shortUrl: string
  readyPageUrl: string
  title: string
}

interface TelegramResult {
  ok: boolean
  error?: string
}

export async function sendTelegramStoryNotification(
  input: TelegramNotificationInput,
): Promise<TelegramResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' }
  }

  const caption = [
    `Story ready: "${input.title}"`,
    '',
    'Paste this link sticker URL:',
    input.shortUrl,
  ].join('\n')

  const body = {
    chat_id: input.chatId,
    photo: input.imageUrl,
    caption,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Open in CMS',
            url: input.readyPageUrl,
          },
        ],
      ],
    },
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendPhoto`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )

    if (!res.ok) {
      const text = await res.text()
      Sentry.captureMessage(`Telegram sendPhoto failed: ${text}`, {
        level: 'warning',
        tags: SENTRY_TAG,
      })
      return { ok: false, error: text }
    }

    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    Sentry.captureException(err, { tags: SENTRY_TAG })
    return { ok: false, error: message }
  }
}

export async function sendTelegramConfirmation(chatId: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: 'Connected! You will receive story notifications here.',
    }),
  })
}
