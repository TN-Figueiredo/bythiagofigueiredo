import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function processDeliveryQueue() {
  const supabase = getSupabaseServiceClient()

  // Fetch pending deliveries (oldest first, capped at 50)
  const { data: pending } = await supabase
    .from('notification_deliveries')
    .select('*, notifications(*)')
    .eq('status', 'pending')
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at')
    .limit(50)

  if (!pending?.length) return { processed: 0 }

  let processed = 0
  for (const delivery of pending) {
    try {
      // TODO: resolve adapter by channel, call send()
      await supabase
        .from('notification_deliveries')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', delivery.id)
      processed++
    } catch (error) {
      const attempts = delivery.attempts + 1
      const maxAttempts = 5
      const backoffMs = Math.min(30000 * Math.pow(2, attempts), 7200000) // 30s to 2h

      await supabase
        .from('notification_deliveries')
        .update({
          status: attempts >= maxAttempts ? 'dead' : 'failed',
          attempts,
          last_error: error instanceof Error ? error.message : String(error),
          next_retry_at:
            attempts < maxAttempts
              ? new Date(Date.now() + backoffMs).toISOString()
              : null,
        })
        .eq('id', delivery.id)
    }
  }

  return { processed, total: pending.length }
}
