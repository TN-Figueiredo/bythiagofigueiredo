import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdEvent } from '@tn-figueiredo/ad-engine'

export class SupabaseAdEventRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly appId: string,
  ) {}

  async insert(event: AdEvent): Promise<void> {
    const row: Record<string, unknown> = {
      event_type: event.type,
      user_hash: event.userHash,
      app_id: this.appId,
      slot_id: event.slotKey,
    }
    if (event.campaignId) row.ad_id = event.campaignId

    const { error } = await this.supabase.from('ad_events').insert(row)
    if (error) throw error
  }
}
