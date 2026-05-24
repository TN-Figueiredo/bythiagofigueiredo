import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { sendTelegramConfirmation } from '@/lib/social/notifications/telegram'

export const runtime = 'nodejs'

interface TelegramUpdate {
  message?: {
    from: { id: number }
    chat: { id: number; type: string }
    text?: string
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'webhook not configured' }, { status: 503 })
    }

    const token = request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? ''
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const a = Buffer.from(token)
    const b = Buffer.from(secret)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const update = (await request.json()) as TelegramUpdate

    if (!update.message?.text?.startsWith('/start')) {
      return NextResponse.json({ ok: true })
    }

    const chatId = String(update.message.chat.id)
    const text = update.message.text
    // Extract user UUID from /start command: "/start user-uuid-123"
    const userUuid = text.split(' ')[1]?.trim()

    if (
      !userUuid ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userUuid,
      )
    ) {
      return NextResponse.json({ ok: true })
    }

    const supabase = getSupabaseServiceClient()

    // Save chat_id to user profile
    const { error } = await supabase
      .from('profiles')
      .update({
        telegram_chat_id: chatId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userUuid)

    if (error) {
      Sentry.captureException(error, {
        tags: { component: 'telegram-webhook' },
        extra: { userUuid, chatId },
      })
      return NextResponse.json({ ok: false }, { status: 500 })
    }

    // Send confirmation to user
    await sendTelegramConfirmation(chatId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'telegram-webhook' } })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
