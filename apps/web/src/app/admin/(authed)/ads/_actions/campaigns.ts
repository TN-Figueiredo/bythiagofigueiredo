'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import type { CampaignFormData, PlaceholderFormData, AdCampaignDetail } from '@tn-figueiredo/ad-engine-admin'
import { createAdminQueries } from '@tn-figueiredo/ad-engine-admin'
import { requireArea } from '@tn-figueiredo/auth-nextjs/server'
import { captureServerActionError } from '@/lib/sentry-wrap'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { AD_APP_ID } from '@/lib/ads/config'

const VALID_CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'archived'] as const
type CampaignStatus = typeof VALID_CAMPAIGN_STATUSES[number]

type ExtData = CampaignFormData & Record<string, unknown>
type ExtCreative = Record<string, unknown>

function toCampaignRow(data: CampaignFormData) {
  const ext = data as ExtData
  return {
    name: data.name,
    advertiser: data.advertiser ?? null,
    format: data.format,
    type: (ext.type as string) ?? 'house',
    audience: data.audience ?? [],
    limits: data.limits ?? {},
    priority: data.priority ?? 0,
    pricing_model: data.pricing?.model ?? 'house_free',
    pricing_value: data.pricing?.value ?? 0,
    schedule_start: data.schedule?.start ?? null,
    schedule_end: data.schedule?.end ?? null,
    status: data.status ?? 'draft',
    brand_color: (ext.brandColor as string) ?? '#6B7280',
    logo_url: (ext.logoUrl as string | null) ?? null,
  }
}

function toCreativeRows(campaignId: string, creatives: CampaignFormData['creatives']) {
  if (!creatives) return []
  return Object.values(creatives).map((c) => {
    const ec = c as ExtCreative
    return {
      campaign_id: campaignId,
      slot_key: c.slotKey,
      title: c.title ?? null,
      body: c.body ?? null,
      cta_text: c.ctaText ?? null,
      cta_url: c.ctaUrl ?? null,
      image_url: c.imageUrl ?? null,
      dismiss_seconds: c.dismissSeconds ?? 0,
      locale: (ec.locale as string) ?? 'pt-BR',
      interaction: (ec.interaction as string) ?? 'link',
    }
  })
}

async function insertCreatives(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  campaignId: string,
  creatives: CampaignFormData['creatives'],
  action: string,
): Promise<void> {
  const rows = toCreativeRows(campaignId, creatives)
  if (rows.length === 0) return
  const { error } = await supabase.from('ad_slot_creatives').insert(rows)
  if (error) {
    captureServerActionError(error, { action, campaign_id: campaignId })
    throw new Error(error.message)
  }
}

export async function createCampaign(data: CampaignFormData): Promise<void> {
  await requireArea('admin')
  const supabase = getSupabaseServiceClient()

  const { data: campaign, error } = await supabase
    .from('ad_campaigns')
    .insert({ app_id: AD_APP_ID, ...toCampaignRow(data) })
    .select('id')
    .single()

  if (error) {
    captureServerActionError(error, { action: 'create_campaign' })
    throw new Error(error.message)
  }

  await insertCreatives(supabase, campaign.id as string, data.creatives, 'create_campaign_creatives')

  revalidatePath('/admin/ads')
  revalidateTag('ads')
}

export async function updateCampaign(id: string, data: CampaignFormData): Promise<void> {
  await requireArea('admin')
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('ad_campaigns')
    .update({ ...toCampaignRow(data), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('app_id', AD_APP_ID)

  if (error) {
    captureServerActionError(error, { action: 'update_campaign', campaign_id: id })
    throw new Error(error.message)
  }

  if (data.creatives !== undefined) {
    await supabase.from('ad_slot_creatives').delete().eq('campaign_id', id)
    await insertCreatives(supabase, id, data.creatives, 'update_campaign_creatives')
  }

  revalidatePath('/admin/ads')
  revalidateTag('ads')
}

export async function deleteCampaign(id: string): Promise<void> {
  await requireArea('admin')
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.from('ad_campaigns').delete().eq('id', id).eq('app_id', AD_APP_ID)
  if (error) {
    captureServerActionError(error, { action: 'delete_campaign', campaign_id: id })
    throw new Error(error.message)
  }
  revalidatePath('/admin/ads')
  revalidateTag('ads')
}

export async function uploadMedia(_file: File): Promise<{ id: string; url: string }> {
  await requireArea('admin')
  throw new Error('Not implemented')
}

export async function deleteMedia(_id: string): Promise<void> {
  await requireArea('admin')
  throw new Error('Not implemented')
}

export async function updateCampaignStatus(id: string, status: string): Promise<void> {
  await requireArea('admin')
  if (!VALID_CAMPAIGN_STATUSES.includes(status as typeof VALID_CAMPAIGN_STATUSES[number])) {
    throw new Error(`Invalid status: ${status}`)
  }
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('ad_campaigns')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('app_id', AD_APP_ID)

  if (error) {
    captureServerActionError(error, { action: 'update_campaign_status', campaign_id: id })
    throw new Error(error.message)
  }
  revalidatePath('/admin/ads')
  revalidateTag('ads')
}

export async function fetchCampaignById(id: string): Promise<AdCampaignDetail | null> {
  await requireArea('admin')
  const supabase = getSupabaseServiceClient()
  const queries = createAdminQueries(supabase, AD_APP_ID)
  return queries.fetchAdCampaignById(id)
}

export async function updatePlaceholder(
  slotId: string,
  data: Partial<PlaceholderFormData>,
): Promise<void> {
  await requireArea('admin')
  const supabase = getSupabaseServiceClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.isEnabled !== undefined)      update.is_enabled       = data.isEnabled
  if (data.headline !== undefined)       update.headline         = data.headline
  if (data.body !== undefined)           update.body             = data.body
  if (data.ctaText !== undefined)        update.cta_text         = data.ctaText
  if (data.ctaUrl !== undefined)         update.cta_url          = data.ctaUrl
  if (data.imageUrl !== undefined)       update.image_url        = data.imageUrl
  if (data.dismissAfterMs !== undefined) update.dismiss_after_ms = data.dismissAfterMs

  const { error } = await supabase
    .from('ad_placeholders')
    .upsert({ slot_id: slotId, app_id: AD_APP_ID, ...update }, { onConflict: 'slot_id' })

  if (error) {
    captureServerActionError(error, { action: 'update_placeholder', slot_id: slotId })
    throw new Error(error.message)
  }
  revalidatePath('/admin/ads')
  revalidateTag('ads')
}
