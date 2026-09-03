import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { EmailAdapter, PushAdapter, TelegramAdapter } from '../adapters'
import type {
  IChannelAdapter,
  IUserProfile,
  INotification,
  DeliveryChannel,
} from '../types'

const ADAPTERS: Record<DeliveryChannel, IChannelAdapter> = {
  email: new EmailAdapter(),
  push: new PushAdapter(),
  telegram: new TelegramAdapter(),
}
const MAX_ATTEMPTS = 5

async function getUserProfile(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  userId: string,
): Promise<IUserProfile | null> {
  const { data: authData } = await supabase.auth.admin.getUserById(userId)
  if (!authData?.user) return null
  // NOTA: telegram_chat_id vinha de public.profiles, que NAO EXISTE em producao.
  // Ate a tabela existir, o canal telegram falha explicitamente em vez de fingir sucesso.
  return { id: userId, email: authData.user.email ?? null, telegram_chat_id: null }
}

export async function processDeliveryQueue(): Promise<{
  processed: number
  total: number
}> {
  const supabase = getSupabaseServiceClient()

  // Fetch pending deliveries (oldest first, capped at 50)
  const { data: pending, error: selectErr } = await supabase
    .from('notification_deliveries')
    .select('*, notifications(*)')
    .eq('status', 'pending')
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at')
    .limit(50)

  if (selectErr) throw selectErr
  if (!pending?.length) return { processed: 0, total: 0 }

  let processed = 0
  for (const delivery of pending) {
    const channel = delivery.channel as DeliveryChannel
    const notification = delivery.notifications as INotification | null
    try {
      const adapter = ADAPTERS[channel]
      if (!adapter) {
        throw new Error(`nenhum adapter registrado para o canal "${channel}"`)
      }
      if (!notification?.user_id) {
        throw new Error(`delivery ${delivery.id} sem notification/user_id`)
      }
      const user = await getUserProfile(supabase, notification.user_id)
      if (!user) {
        throw new Error(`usuario ${notification.user_id} nao encontrado`)
      }
      const result = await adapter.send(notification, user)
      if (!result.success) {
        throw new Error(result.error ?? `adapter ${channel} retornou falha`)
      }

      await supabase
        .from('notification_deliveries')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', delivery.id)
      processed++
    } catch (error) {
      const attempts = (delivery.attempts as number) + 1
      const backoffMs = Math.min(30000 * Math.pow(2, attempts), 7200000) // 30s to 2h

      await supabase
        .from('notification_deliveries')
        .update({
          status: attempts >= MAX_ATTEMPTS ? 'dead' : 'failed',
          attempts,
          last_error: error instanceof Error ? error.message : String(error),
          next_retry_at:
            attempts < MAX_ATTEMPTS
              ? new Date(Date.now() + backoffMs).toISOString()
              : null,
        })
        .eq('id', delivery.id)
    }
  }

  return { processed, total: pending.length }
}
