import type { SupabaseClient } from '@supabase/supabase-js'
import type { IAdEventRepository, AdEvent } from '@tn-figueiredo/ad-engine'

export class SupabaseAdEventRepository implements IAdEventRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async insert(event: AdEvent): Promise<void> {
    const row: Record<string, unknown> = {
      event_type: event.eventType,
      user_hash: event.userHash,
      app_id: event.appId,
      slot_id: event.slotId,
    }
    // Only include ad_id when present — column is nullable
    if (event.adId) row.ad_id = event.adId

    const { error } = await this.supabase.from('ad_events').insert(row)
    if (error) throw error
  }
}
