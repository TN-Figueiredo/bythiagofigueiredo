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
  failed: number
  dead: number
}> {
  const supabase = getSupabaseServiceClient()

  // Fetch deliveries due for (re)delivery, oldest first, capped at 50.
  //
  // Importante 4 (docs/superpowers/plans/2026-09-02-falhas-silenciosas.md):
  // this used to filter status='pending' only. The failure branch below sets
  // status='failed' + next_retry_at for a future retry — but a row that's
  // already 'failed' never matches status='pending' again, so it was NEVER
  // re-selected. `attempts` never reached MAX_ATTEMPTS and the row never
  // became 'dead' either: the retry existed on paper (backoff scheduled,
  // written to the DB) and never actually happened. 'dead' deliberately
  // stays excluded — those already exhausted MAX_ATTEMPTS and are a
  // terminal state.
  const { data: pending, error: selectErr } = await supabase
    .from('notification_deliveries')
    .select('*, notifications(*)')
    .in('status', ['pending', 'failed'])
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at')
    .limit(50)

  if (selectErr) throw selectErr
  if (!pending?.length) return { processed: 0, total: 0, failed: 0, dead: 0 }

  let processed = 0
  let failed = 0
  let dead = 0
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

      // Janela de reenvio duplicado (aceita): se o update abaixo lancar DEPOIS
      // de adapter.send() ja ter entregue de verdade, o catch abaixo marca a
      // linha como 'failed'/'dead' e ela volta a ser selecionada no proximo
      // ciclo (agora que o select acima inclui 'failed' — Importante 4) ->
      // reenvio duplicado. A janela e estreita (so o update falha, nao o
      // send) e o EmailAdapter (e os demais) nao tem chave de idempotencia
      // para o provider deduplicar contra ela. Nao implementado por decisao
      // deliberada: escopo desta correcao e so fechar o beco sem saida do
      // retry, nao adicionar idempotencia.
      await supabase
        .from('notification_deliveries')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', delivery.id)
      processed++
    } catch (error) {
      const attempts = (delivery.attempts as number) + 1
      const backoffMs = Math.min(30000 * Math.pow(2, attempts), 7200000) // 30s to 2h
      const isDead = attempts >= MAX_ATTEMPTS
      if (isDead) dead++
      else failed++

      await supabase
        .from('notification_deliveries')
        .update({
          status: isDead ? 'dead' : 'failed',
          attempts,
          last_error: error instanceof Error ? error.message : String(error),
          next_retry_at: isDead ? null : new Date(Date.now() + backoffMs).toISOString(),
        })
        .eq('id', delivery.id)
    }
  }

  // Importante 4: expose failure counts so the route can tell "everything
  // failed" from "everything succeeded" instead of always reporting
  // {processed, total} and letting the caller assume success by omission.
  return { processed, total: pending.length, failed, dead }
}
