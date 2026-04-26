import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  resolveSlot,
  type AdSlotConfig,
  type AdSlotCreative,
  type AdPlaceholder,
  type AdResolution,
  type AdResolutionContext,
} from '@tn-figueiredo/ad-engine'
import { SITE_AD_SLOTS } from '@app/shared'
import type { AdCreativeData } from '@/components/blog/ads'
import { AD_APP_ID } from './config'

type SlotMap = Partial<Record<string, AdCreativeData>>

const SLOT_KEYS = [
  'banner_top',
  'rail_left',
  'rail_right',
  'inline_mid',
  'block_bottom',
] as const

interface SlotConfigRow {
  slot_key: string
  house_enabled: boolean
  cpa_enabled: boolean
  google_enabled: boolean
  template_enabled: boolean
  network_adapters_order: string[] | null
  network_config: Record<string, Record<string, unknown>> | null
  max_per_session: number | null
  max_per_day: number | null
  cooldown_ms: number | null
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
  target_categories: string[] | null
  impressions_target: number | null
  impressions_delivered: number | null
  budget_cents: number | null
  spent_cents: number | null
  pacing_strategy: string | null
  variant_group: string | null
  variant_weight: number | null
  campaign: {
    id: string
    type: string
    status: string
    brand_color: string
    logo_url: string | null
    priority: number
    schedule_start: string | null
    schedule_end: string | null
  }
}

function toAdSlotCreative(row: CreativeRow): AdSlotCreative {
  return {
    campaignId: row.campaign.id,
    slotKey: row.slot_key,
    type: (row.campaign.type as 'house' | 'cpa') ?? 'house',
    title: row.title ?? '',
    body: row.body ?? '',
    ctaText: row.cta_text ?? '',
    ctaUrl: row.cta_url ?? '',
    imageUrl: row.image_url ?? null,
    logoUrl: row.campaign.logo_url ?? null,
    brandColor: row.campaign.brand_color ?? '#6B7280',
    interaction: (row.interaction as 'link' | 'form') ?? 'link',
    dismissSeconds: row.dismiss_seconds ?? 0,
    priority: row.campaign.priority ?? 0,
    targetCategories: row.target_categories ?? [],
    scheduleStart: row.campaign.schedule_start ? new Date(row.campaign.schedule_start) : null,
    scheduleEnd: row.campaign.schedule_end ? new Date(row.campaign.schedule_end) : null,
    impressionsTarget: row.impressions_target ?? null,
    impressionsDelivered: row.impressions_delivered ?? 0,
    budgetCents: row.budget_cents ?? null,
    spentCents: row.spent_cents ?? 0,
    pacingStrategy: (row.pacing_strategy as 'even' | 'front_loaded' | 'asap') ?? 'even',
    variantGroup: row.variant_group ?? null,
    variantWeight: row.variant_weight ?? 100,
  }
}

function toAdPlaceholder(ph: {
  slot_id: string
  headline: string | null
  body: string | null
  cta_text: string | null
  cta_url: string | null
  image_url: string | null
  is_enabled: boolean
}): AdPlaceholder {
  return {
    slotId: ph.slot_id,
    headline: ph.headline ?? '',
    body: ph.body ?? '',
    ctaText: ph.cta_text ?? '',
    ctaUrl: ph.cta_url ?? '',
    imageUrl: ph.image_url ?? null,
    isEnabled: ph.is_enabled,
  }
}

function buildSlotConfig(
  slotKey: string,
  dbRow: SlotConfigRow | undefined,
  killed: boolean,
): AdSlotConfig {
  const definition = SITE_AD_SLOTS.find((s) => s.key === slotKey)
  if (!definition) {
    throw new Error(`Unknown slot key: ${slotKey}`)
  }

  if (!dbRow) {
    return {
      key: slotKey,
      definition,
      killed,
      houseEnabled: true,
      cpaEnabled: true,
      googleEnabled: false,
      templateEnabled: true,
      networkAdaptersOrder: [],
      networkConfig: {},
      maxPerSession: definition.defaultLimits.maxPerSession,
      maxPerDay: definition.defaultLimits.maxPerDay,
      cooldownMs: definition.defaultLimits.cooldownMs,
    }
  }

  return {
    key: slotKey,
    definition,
    killed,
    houseEnabled: dbRow.house_enabled,
    cpaEnabled: dbRow.cpa_enabled,
    googleEnabled: dbRow.google_enabled,
    templateEnabled: dbRow.template_enabled,
    networkAdaptersOrder: dbRow.network_adapters_order ?? [],
    networkConfig: dbRow.network_config ?? {},
    maxPerSession: dbRow.max_per_session ?? definition.defaultLimits.maxPerSession,
    maxPerDay: dbRow.max_per_day ?? definition.defaultLimits.maxPerDay,
    cooldownMs: dbRow.cooldown_ms ?? definition.defaultLimits.cooldownMs,
  }
}

async function fetchAdCreatives(locale: string): Promise<SlotMap> {
  const supabase = getSupabaseServiceClient()

  // Parallel: fetch master kill switch, slot configs (with site_id lookup), creatives, and placeholders
  const [killResult, siteResult] = await Promise.all([
    supabase
      .from('kill_switches')
      .select('enabled')
      .eq('id', 'kill_ads')
      .single(),
    supabase
      .from('sites')
      .select('id')
      .eq('slug', 'bythiagofigueiredo')
      .single(),
  ])

  const masterKilled = !killResult.data?.enabled
  if (masterKilled) return {}

  const siteId = siteResult.data?.id
  if (!siteId) return {}

  // Parallel: slot configs, per-slot kill switches, active creatives, placeholders
  const [slotConfigResult, killSlotsResult, creativesResult, placeholdersResult] = await Promise.all([
    supabase
      .from('ad_slot_config')
      .select('slot_key, house_enabled, cpa_enabled, google_enabled, template_enabled, network_adapters_order, network_config, max_per_session, max_per_day, cooldown_ms')
      .eq('site_id', siteId),
    supabase
      .from('kill_switches')
      .select('id, enabled')
      .like('id', 'ads_slot_%'),
    supabase
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
        target_categories,
        impressions_target,
        impressions_delivered,
        budget_cents,
        spent_cents,
        pacing_strategy,
        variant_group,
        variant_weight,
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
      .eq('locale', locale),
    supabase
      .from('ad_placeholders')
      .select('slot_id, headline, body, cta_text, cta_url, image_url, is_enabled')
      .eq('is_enabled', true),
  ])

  const slotConfigMap = new Map<string, SlotConfigRow>()
  for (const row of (slotConfigResult.data ?? []) as SlotConfigRow[]) {
    slotConfigMap.set(row.slot_key, row)
  }

  const killedSlots = new Set(
    (killSlotsResult.data ?? [])
      .filter((k) => !k.enabled && k.id)
      .map((k) => k.id!.replace('ads_slot_', '')),
  )

  const allCreatives = (creativesResult.data ?? []) as unknown as CreativeRow[]
  const creativesBySlot = new Map<string, AdSlotCreative[]>()
  for (const row of allCreatives) {
    if (!row.campaign || row.campaign.status !== 'active') continue
    const mapped = toAdSlotCreative(row)
    const existing = creativesBySlot.get(row.slot_key) ?? []
    existing.push(mapped)
    creativesBySlot.set(row.slot_key, existing)
  }

  const placeholdersBySlot = new Map<string, AdPlaceholder>()
  for (const ph of placeholdersResult.data ?? []) {
    if (!placeholdersBySlot.has(ph.slot_id)) {
      placeholdersBySlot.set(ph.slot_id, toAdPlaceholder(ph))
    }
  }

  const context: AdResolutionContext = {
    appId: AD_APP_ID,
    siteId,
    locale,
    now: new Date(),
    masterKilled: false, // already checked above
    marketingConsent: false, // server-side: no consent context
    networkAdapters: {},
  }

  const getCampaigns = (slotKey: string, _appId: string): AdSlotCreative[] =>
    creativesBySlot.get(slotKey) ?? []

  const getPlaceholder = (slotKey: string, _appId: string): AdPlaceholder | null =>
    placeholdersBySlot.get(slotKey) ?? null

  const map: SlotMap = {}

  for (const slotKey of SLOT_KEYS) {
    const killed = killedSlots.has(slotKey)
    const config = buildSlotConfig(slotKey, slotConfigMap.get(slotKey), killed)
    const resolution = resolveSlot(config, context, getCampaigns, getPlaceholder)
    const creative = mapResolutionToCreativeData(slotKey, resolution)
    if (creative) {
      map[slotKey] = creative
    }
  }

  return map
}

export function mapResolutionToCreativeData(
  slotKey: string,
  resolution: AdResolution,
): AdCreativeData | null {
  if (resolution.source === 'empty') return null

  // Campaign-sourced (house or cpa)
  if (resolution.creative) {
    const c = resolution.creative
    return {
      campaignId: c.campaignId,
      slotKey,
      type: c.type,
      source: 'campaign',
      interaction: c.interaction,
      title: c.title,
      body: c.body,
      ctaText: c.ctaText,
      ctaUrl: c.ctaUrl,
      imageUrl: c.imageUrl,
      logoUrl: c.logoUrl,
      brandColor: c.brandColor,
      dismissSeconds: c.dismissSeconds,
    }
  }

  // Template/placeholder-sourced
  if (resolution.placeholder) {
    const ph = resolution.placeholder
    return {
      campaignId: null,
      slotKey,
      type: 'house',
      source: 'placeholder',
      interaction: 'link',
      title: ph.headline,
      body: ph.body,
      ctaText: ph.ctaText,
      ctaUrl: ph.ctaUrl,
      imageUrl: ph.imageUrl,
      logoUrl: null,
      brandColor: '#6B7280',
      dismissSeconds: 0,
    }
  }

  return null
}

export const loadAdCreatives = unstable_cache(
  fetchAdCreatives,
  ['ad-creatives'],
  { tags: ['ads'], revalidate: 300 },
)
