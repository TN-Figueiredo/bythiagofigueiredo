import type { SupabaseClient } from '@supabase/supabase-js'
import type { IAdConfigRepository, AdConfig, AdFormat, AdType } from '@tn-figueiredo/ad-engine'

/**
 * Maps campaign wizard format strings to ad-engine AdFormat union.
 * 'image' → 'banner', 'video' → 'interstitial', 'native' → 'native', 'house' → 'card'.
 * Pass-through for values already in ad-engine format.
 */
const FORMAT_MAP: Record<string, AdFormat> = {
  image: 'banner',
  video: 'interstitial',
  native: 'native',
  house: 'card',
  banner: 'banner',
  interstitial: 'interstitial',
  card: 'card',
}

function toAdFormat(raw: string): AdFormat {
  return FORMAT_MAP[raw] ?? 'banner'
}

const CREATIVE_FIELDS =
  'id, slot_key, title, body, cta_text, cta_url, image_url, dismiss_seconds, campaign_id, created_at, ' +
  'campaign:ad_campaigns!inner(id, name, type, format, priority, status, audience, schedule_start, schedule_end, created_at, updated_at)'

export class SupabaseAdConfigRepository implements IAdConfigRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly appId: string,
  ) {}

  async getActiveBySlot(slotId: string, appId: string): Promise<AdConfig[]> {
    const resolvedAppId = appId || this.appId
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
    return (data ?? []).map((row) => mapToAdConfig(row as unknown as Record<string, unknown>, resolvedAppId))
  }
}

function mapToAdConfig(row: Record<string, unknown>, appId: string): AdConfig {
  const campaign = row.campaign as Record<string, unknown>
  return {
    id: campaign.id as string,
    slotId: row.slot_key as string,
    appId,
    priority: campaign.priority as number,
    format: toAdFormat(campaign.format as string),
    dismissAfterMs: ((row.dismiss_seconds as number) ?? 0) * 1000,
    target: {
      type: campaign.type as AdType | undefined,
      audience: campaign.audience as string[] | undefined,
    },
    creative: {
      title: row.title as string,
      body: (row.body as string) || undefined,
      imageUrl: (row.image_url as string) || undefined,
      ctaText: row.cta_text as string,
      ctaUrl: row.cta_url as string,
    },
    active: true,
    startsAt: (campaign.schedule_start as string) ?? null,
    endsAt: (campaign.schedule_end as string) ?? null,
    createdAt: campaign.created_at as string,
    updatedAt: campaign.updated_at as string,
  }
}
