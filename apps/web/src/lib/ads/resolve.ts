import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { AdCreativeData } from '@/components/blog/ads'

type SlotMap = Partial<Record<string, AdCreativeData>>

interface CampaignRow {
  id: string
  type: string
  status: string
  brand_color: string
  logo_url: string | null
  priority: number
  schedule_start: string | null
  schedule_end: string | null
}

interface CreativeRow {
  slot_key: string
  title: string | null
  body: string | null
  cta_text: string | null
  cta_url: string | null
  image_url: string | null
  dismiss_seconds: number | null
  locale: string
  interaction: string | null
  campaign: CampaignRow
}

const SLOT_KEYS = [
  'banner_top',
  'rail_left',
  'rail_right',
  'inline_mid',
  'block_bottom',
] as const

async function fetchAdCreatives(locale: string): Promise<SlotMap> {
  const supabase = getSupabaseServiceClient()

  const { data: killMaster } = await supabase
    .from('kill_switches')
    .select('enabled')
    .eq('id', 'kill_ads')
    .single()

  if (!killMaster?.enabled) return {}

  const { data: killSlots } = await supabase
    .from('kill_switches')
    .select('id, enabled')
    .like('id', 'ads_slot_%')

  const killedSlots = new Set(
    (killSlots ?? []).filter((k) => !k.enabled && k.id).map((k) => k.id!.replace('ads_slot_', '')),
  )

  const { data: rows } = await supabase
    .from('ad_slot_creatives')
    .select(`
      slot_key,
      title,
      body,
      cta_text,
      cta_url,
      image_url,
      dismiss_seconds,
      locale,
      interaction,
      campaign:ad_campaigns!inner (
        id,
        type,
        status,
        brand_color,
        logo_url,
        priority,
        schedule_start,
        schedule_end
      )
    `)
    .eq('locale', locale)

  const now = new Date().toISOString()
  const map: SlotMap = {}

  if (rows && rows.length > 0) {
    const sorted = [...(rows as unknown as CreativeRow[])].sort(
      (a, b) => (b.campaign?.priority ?? 0) - (a.campaign?.priority ?? 0),
    )

    for (const row of sorted) {
      if (!(SLOT_KEYS as readonly string[]).includes(row.slot_key)) continue
      if (killedSlots.has(row.slot_key)) continue
      if (!row.campaign || row.campaign.status !== 'active') continue
      if (row.campaign.schedule_start && row.campaign.schedule_start > now) continue
      if (row.campaign.schedule_end && row.campaign.schedule_end < now) continue
      if (map[row.slot_key]) continue

      map[row.slot_key] = {
        campaignId: row.campaign.id,
        slotKey: row.slot_key,
        type: (row.campaign.type as 'house' | 'cpa') ?? 'house',
        source: 'campaign',
        interaction: (row.interaction as 'link' | 'form') ?? 'link',
        title: row.title ?? '',
        body: row.body ?? '',
        ctaText: row.cta_text ?? '',
        ctaUrl: row.cta_url ?? '',
        imageUrl: row.image_url ?? null,
        logoUrl: row.campaign.logo_url ?? null,
        brandColor: row.campaign.brand_color ?? '#6B7280',
        dismissSeconds: row.dismiss_seconds ?? 0,
      }
    }
  }

  const unfilledSlots = SLOT_KEYS.filter((k) => !map[k] && !killedSlots.has(k))
  if (unfilledSlots.length > 0) {
    const { data: placeholders } = await supabase
      .from('ad_placeholders')
      .select('slot_id, headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled')
      .in('slot_id', unfilledSlots)
      .eq('is_enabled', true)

    for (const ph of placeholders ?? []) {
      if (map[ph.slot_id] || killedSlots.has(ph.slot_id)) continue
      map[ph.slot_id] = {
        campaignId: null,
        slotKey: ph.slot_id,
        type: 'house',
        source: 'placeholder',
        interaction: 'link',
        title: ph.headline ?? '',
        body: ph.body ?? '',
        ctaText: ph.cta_text ?? '',
        ctaUrl: ph.cta_url ?? '',
        imageUrl: ph.image_url ?? null,
        logoUrl: null,
        brandColor: '#6B7280',
        dismissSeconds: ph.dismiss_after_ms ? Math.round(ph.dismiss_after_ms / 1000) : 0,
      }
    }
  }

  return map
}

export function mapResolutionToCreativeData(
  slotKey: string,
  resolution: {
    source: string
    creative?: {
      campaign_id: string | null
      type: string
      interaction: string | null
      title: string | null
      body: string | null
      cta_text: string | null
      cta_url: string | null
      image_url: string | null
      dismiss_seconds: number | null
      logo_url: string | null
      brand_color: string | null
    } | null
  },
): AdCreativeData | null {
  if (resolution.source === 'empty' || !resolution.creative) return null
  const c = resolution.creative
  return {
    campaignId: c.campaign_id,
    slotKey,
    type: (c.type as 'house' | 'cpa') ?? 'house',
    source: resolution.source as 'campaign' | 'placeholder',
    interaction: (c.interaction as 'link' | 'form') ?? 'link',
    title: c.title ?? '',
    body: c.body ?? '',
    ctaText: c.cta_text ?? '',
    ctaUrl: c.cta_url ?? '',
    imageUrl: c.image_url ?? null,
    logoUrl: c.logo_url ?? null,
    brandColor: c.brand_color ?? '#6B7280',
    dismissSeconds: c.dismiss_seconds ?? 0,
  }
}

export const loadAdCreatives = unstable_cache(
  fetchAdCreatives,
  ['ad-creatives'],
  { tags: ['ads'], revalidate: 300 },
)
