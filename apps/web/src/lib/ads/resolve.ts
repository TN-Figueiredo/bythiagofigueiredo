import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { AdCreativeData } from '@/components/blog/ads'

type SlotMap = Partial<Record<string, AdCreativeData>>

async function fetchAdCreatives(locale: string): Promise<SlotMap> {
  const supabase = getSupabaseServiceClient()

  const { data: killMaster } = await supabase
    .from('kill_switches')
    .select('enabled')
    .eq('id', 'kill_ads')
    .single()

  if (!killMaster?.enabled) return {}

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

  if (!rows || rows.length === 0) return {}

  const now = new Date().toISOString()
  const map: SlotMap = {}

  const sorted = [...rows].sort((a, b) => {
    const pa = (a.campaign as any)?.priority ?? 0
    const pb = (b.campaign as any)?.priority ?? 0
    return pb - pa
  })

  for (const row of sorted) {
    const c = row.campaign as any
    if (!c || c.status !== 'active') continue
    if (c.schedule_start && c.schedule_start > now) continue
    if (c.schedule_end && c.schedule_end < now) continue

    if (map[row.slot_key]) continue

    map[row.slot_key] = {
      campaignId: c.id,
      slotKey: row.slot_key,
      type: c.type ?? 'house',
      source: 'campaign',
      interaction: (row.interaction as 'link' | 'form') ?? 'link',
      title: row.title ?? '',
      body: row.body ?? '',
      ctaText: row.cta_text ?? '',
      ctaUrl: row.cta_url ?? '',
      imageUrl: row.image_url ?? null,
      logoUrl: c.logo_url ?? null,
      brandColor: c.brand_color ?? '#6B7280',
      dismissSeconds: row.dismiss_seconds ?? 0,
    }
  }

  return map
}

export const loadAdCreatives = unstable_cache(
  fetchAdCreatives,
  ['ad-creatives'],
  { tags: ['ads'], revalidate: 300 },
)
