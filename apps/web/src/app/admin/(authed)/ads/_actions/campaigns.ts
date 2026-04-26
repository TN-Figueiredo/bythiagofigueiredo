'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { CampaignFormData, PlaceholderFormData, AdCampaignDetail } from '@tn-figueiredo/ad-engine-admin'
import { createAdminQueries } from '@tn-figueiredo/ad-engine-admin'
import { requireArea } from '@tn-figueiredo/auth-nextjs/server'
import { captureServerActionError } from '@/lib/sentry-wrap'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

type ExtData = CampaignFormData & Record<string, unknown>
type ExtCreative = Record<string, unknown>

export async function createCampaign(data: CampaignFormData): Promise<void> {
  await requireArea('admin')
  const supabase = getSupabaseAdmin()
  const ext = data as ExtData

  const { data: campaign, error } = await supabase
    .from('ad_campaigns')
    .insert({
      name: data.name,
      advertiser: data.advertiser ?? null,
      format: data.format,
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
    })
    .select('id')
    .single()

  if (error) {
    captureServerActionError(error, { action: 'create_campaign' })
    throw new Error(error.message)
  }

  const creatives = data.creatives ? Object.values(data.creatives) : []
  if (creatives.length > 0) {
    const { error: ce } = await supabase.from('ad_slot_creatives').insert(
      creatives.map((c) => {
        const ec = c as ExtCreative
        return {
          campaign_id: campaign.id as string,
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
      }),
    )
    if (ce) {
      captureServerActionError(ce, { action: 'create_campaign_creatives', campaign_id: campaign.id as string })
      throw new Error(ce.message)
    }
  }

  revalidatePath('/admin/ads')
  revalidateTag('ads')
}

export async function updateCampaign(id: string, data: CampaignFormData): Promise<void> {
  await requireArea('admin')
  const supabase = getSupabaseAdmin()
  const ext = data as ExtData

  const { error } = await supabase
    .from('ad_campaigns')
    .update({
      name: data.name,
      advertiser: data.advertiser ?? null,
      format: data.format,
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
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    captureServerActionError(error, { action: 'update_campaign', campaign_id: id })
    throw new Error(error.message)
  }

  if (data.creatives !== undefined) {
    await supabase.from('ad_slot_creatives').delete().eq('campaign_id', id)

    const creatives = Object.values(data.creatives)
    if (creatives.length > 0) {
      const { error: ce } = await supabase.from('ad_slot_creatives').insert(
        creatives.map((c) => {
          const ec = c as ExtCreative
          return {
            campaign_id: id,
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
        }),
      )
      if (ce) {
        captureServerActionError(ce, { action: 'update_campaign_creatives', campaign_id: id })
        throw new Error(ce.message)
      }
    }
  }

  revalidatePath('/admin/ads')
  revalidateTag('ads')
}

export async function deleteCampaign(id: string): Promise<void> {
  await requireArea('admin')
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('ad_campaigns').delete().eq('id', id)
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
  const supabase = getSupabaseAdmin()
  const APP_ID = 'bythiagofigueiredo'

  const { error } = await supabase
    .from('ad_campaigns')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('app_id', APP_ID)

  if (error) {
    captureServerActionError(error, { action: 'update_campaign_status', campaign_id: id })
    throw new Error(error.message)
  }
  revalidatePath('/admin/ads')
  revalidateTag('ads')
}

export async function fetchCampaignById(id: string): Promise<AdCampaignDetail | null> {
  await requireArea('admin')
  const supabase = getSupabaseAdmin()
  const APP_ID = 'bythiagofigueiredo'
  const queries = createAdminQueries(supabase, APP_ID)
  return queries.fetchAdCampaignById(id)
}

export async function updatePlaceholder(
  slotId: string,
  data: Partial<PlaceholderFormData>,
): Promise<void> {
  await requireArea('admin')
  const supabase = getSupabaseAdmin()

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
    .upsert({ slot_id: slotId, app_id: 'bythiagofigueiredo', ...update }, { onConflict: 'slot_id' })

  if (error) {
    captureServerActionError(error, { action: 'update_placeholder', slot_id: slotId })
    throw new Error(error.message)
  }
  revalidatePath('/admin/ads')
  revalidateTag('ads')
}
