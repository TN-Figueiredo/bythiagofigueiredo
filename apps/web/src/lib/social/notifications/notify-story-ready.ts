import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { sendTelegramStoryNotification } from './telegram'
import { sendStoryEmailNotification } from './email-fallback'

const SENTRY_TAG = { component: 'social-notify-story' }

interface NotifyInput {
  userId: string
  postId: string
  imageUrl: string
  shortUrl: string
  title: string
}

interface NotifyResult {
  ok: boolean
  channel: 'telegram' | 'email' | 'none'
  error?: string
}

export async function notifyStoryReady(
  input: NotifyInput,
): Promise<NotifyResult> {
  const supabase = getSupabaseServiceClient()
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
  const readyPageUrl = `${appUrl}/cms/social/posts/${input.postId}/ready`

  // Fetch user notification preferences
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('telegram_chat_id, email')
    .eq('id', input.userId)
    .single()

  if (userError || !user) {
    Sentry.captureMessage(
      `Could not fetch user profile for notification: ${input.userId}`,
      {
        level: 'warning',
        tags: SENTRY_TAG,
      },
    )
    return { ok: false, channel: 'none', error: 'User not found' }
  }

  // Try Telegram first
  if (user.telegram_chat_id) {
    const result = await sendTelegramStoryNotification({
      chatId: user.telegram_chat_id,
      imageUrl: input.imageUrl,
      shortUrl: input.shortUrl,
      readyPageUrl,
      title: input.title,
    })

    if (result.ok) {
      return { ok: true, channel: 'telegram' }
    }
    // Telegram failed, fall through to email
    Sentry.captureMessage(
      `Telegram notification failed, falling back to email`,
      {
        level: 'info',
        tags: SENTRY_TAG,
        extra: { error: result.error },
      },
    )
  }

  // Fallback to email
  if (user.email) {
    const result = await sendStoryEmailNotification({
      to: user.email,
      imageUrl: input.imageUrl,
      shortUrl: input.shortUrl,
      readyPageUrl,
      title: input.title,
    })

    return {
      ok: result.ok,
      channel: 'email',
      error: result.error,
    }
  }

  return {
    ok: false,
    channel: 'none',
    error: 'No notification channel available',
  }
}
