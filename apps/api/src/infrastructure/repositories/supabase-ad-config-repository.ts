import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdSlotCreative } from '@tn-figueiredo/ad-engine'

const CREATIVE_FIELDS =
  'id, slot_key, title, body, cta_text, cta_url, image_url, dismiss_seconds, campaign_id, created_at, ' +
  'campaign:ad_campaigns!inner(id, name, format, priority, status, schedule_start, schedule_end, ' +
  'target_categories, impressions_target, impressions_delivered, budget_cents, spent_cents, ' +
  'pacing_strategy, variant_group, variant_weight, created_at, updated_at)'

export class SupabaseAdConfigRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly appId: string,
  ) {}

  async getActiveBySlot(slotId: string, _appId: string): Promise<AdSlotCreative[]> {
    const now = new Date().toISOString()

    const { data, error } = await this.supabase
      .from('ad_slot_creatives')
      .select(CREATIVE_FIELDS)
      .eq('slot_key', slotId)
      .eq('campaign.status', 'active')
      .or(`schedule_start.is.null,schedule_start.lte.${now}`, { referencedTable: 'campaign' })
      .or(`schedule_end.is.null,schedule_end.gte.${now}`, { referencedTable: 'campaign' })
      .order('priority', { referencedTable: 'campaign', ascending: false })

    if (error) throw error
    return (data ?? []).map((row) => mapToCreative(row as unknown as Record<string, unknown>))
  }
}

function mapToCreative(row: Record<string, unknown>): AdSlotCreative {
  const campaign = row.campaign as Record<string, unknown>
  const format = campaign.format as string
  return {
    campaignId: campaign.id as string,
    slotKey: row.slot_key as string,
    type: format === 'house' ? 'house' : 'cpa',
    title: (row.title as string) ?? '',
    body: (row.body as string) ?? '',
    ctaText: (row.cta_text as string) ?? '',
    ctaUrl: (row.cta_url as string) ?? '',
    imageUrl: (row.image_url as string) ?? null,
    logoUrl: null,
    brandColor: '#000000',
    interaction: 'link',
    dismissSeconds: (row.dismiss_seconds as number) ?? 0,
    priority: (campaign.priority as number) ?? 0,
    targetCategories: (campaign.target_categories as string[]) ?? [],
    scheduleStart: campaign.schedule_start ? new Date(campaign.schedule_start as string) : null,
    scheduleEnd: campaign.schedule_end ? new Date(campaign.schedule_end as string) : null,
    impressionsTarget: (campaign.impressions_target as number) ?? null,
    impressionsDelivered: (campaign.impressions_delivered as number) ?? 0,
    budgetCents: (campaign.budget_cents as number) ?? null,
    spentCents: (campaign.spent_cents as number) ?? 0,
    pacingStrategy: (campaign.pacing_strategy as 'even' | 'front_loaded' | 'asap') ?? 'even',
    variantGroup: (campaign.variant_group as string) ?? null,
    variantWeight: (campaign.variant_weight as number) ?? 50,
  }
}
