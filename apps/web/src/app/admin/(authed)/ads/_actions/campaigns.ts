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

const ALLOWED_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const
const MAX_MEDIA_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

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

export async function uploadMedia(file: File): Promise<{ id: string; url: string }> {
  await requireArea('admin')

  if (!ALLOWED_MEDIA_TYPES.includes(file.type as typeof ALLOWED_MEDIA_TYPES[number])) {
    throw new Error(
      `Invalid file type: ${file.type}. Allowed: ${ALLOWED_MEDIA_TYPES.join(', ')}`,
    )
  }

  if (file.size > MAX_MEDIA_SIZE_BYTES) {
    throw new Error(
      `File too large: ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum: 5MB`,
    )
  }

  const supabase = getSupabaseServiceClient()

  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `ads/media/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('media')
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    captureServerActionError(uploadError, { action: 'upload_media' })
    throw new Error(uploadError.message)
  }

  const { data: urlData } = supabase.storage.from('media').getPublicUrl(uploadData.path)
  const publicUrl = urlData.publicUrl

  const { data: row, error: insertError } = await supabase
    .from('ad_media')
    .insert({
      app_id: AD_APP_ID,
      storage_path: uploadData.path,
      public_url: publicUrl,
      mime_type: file.type,
      file_name: file.name,
    })
    .select('id')
    .single()

  if (insertError) {
    captureServerActionError(insertError, { action: 'upload_media_insert' })
    throw new Error(insertError.message)
  }

  return { id: (row as { id: string }).id, url: publicUrl }
}

export async function deleteMedia(id: string): Promise<void> {
  await requireArea('admin')
  const supabase = getSupabaseServiceClient()

  const { data: row, error: fetchError } = await supabase
    .from('ad_media')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (fetchError) {
    captureServerActionError(fetchError, { action: 'delete_media_fetch', media_id: id })
    throw new Error(fetchError.message)
  }

  const { error: storageError } = await supabase.storage
    .from('media')
    .remove([(row as { storage_path: string }).storage_path])

  if (storageError) {
    captureServerActionError(storageError, { action: 'delete_media_storage', media_id: id })
    throw new Error(storageError.message)
  }

  const { error: deleteError } = await supabase
    .from('ad_media')
    .delete()
    .eq('id', id)

  if (deleteError) {
    captureServerActionError(deleteError, { action: 'delete_media_row', media_id: id })
    throw new Error(deleteError.message)
  }
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
