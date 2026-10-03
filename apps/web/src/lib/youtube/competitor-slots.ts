import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const DEFAULT_CHANNEL_LIMIT = 75
export const UNLOCK_STEP = 25

export interface ChannelSlots { used: number; limit: number; free: number }

/** free = max(0, limit − used); the own channel is never counted. */
export function computeSlots(usedCompetitors: number, limit: number | null): ChannelSlots {
  const l = limit ?? DEFAULT_CHANNEL_LIMIT
  return { used: usedCompetitors, limit: l, free: Math.max(0, l - usedCompetitors) }
}

/** competitor_channels never holds the own channel (it lives in youtube_channels), so every row is a competitor. */
export async function getChannelSlots(siteId: string): Promise<ChannelSlots> {
  const sb = getSupabaseServiceClient()
  const [{ count }, { data: settings }] = await Promise.all([
    sb.from('competitor_channels').select('id', { count: 'exact', head: true }).eq('site_id', siteId),
    sb.from('competitor_settings').select('channel_limit').eq('site_id', siteId).maybeSingle(),
  ])
  return computeSlots(count ?? 0, settings?.channel_limit ?? null)
}
