import { getSupabaseServiceClient } from '@/lib/supabase/service'

export { DEFAULT_CHANNEL_LIMIT, UNLOCK_STEP, computeSlots, type ChannelSlots } from './competitor-slots-math'
import { computeSlots, type ChannelSlots } from './competitor-slots-math'

/** competitor_channels never holds the own channel (it lives in youtube_channels), so every row is a competitor. */
export async function getChannelSlots(siteId: string): Promise<ChannelSlots> {
  const sb = getSupabaseServiceClient()
  const [{ count }, { data: settings }] = await Promise.all([
    sb.from('competitor_channels').select('id', { count: 'exact', head: true }).eq('site_id', siteId).is('removal_requested_at', null), // F1: o pedido de remoção libera a vaga
    sb.from('competitor_settings').select('channel_limit').eq('site_id', siteId).maybeSingle(),
  ])
  return computeSlots(count ?? 0, settings?.channel_limit ?? null)
}
