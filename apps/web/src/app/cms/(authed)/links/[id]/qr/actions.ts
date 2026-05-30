'use server'

import { revalidateTag } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CardCompositionSchema } from '@tn-figueiredo/links/qr'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import { sanitizeBlobUrls } from './shared'

type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

async function requireEditScope(siteId: string) {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return res.user.id
}

export async function saveQrCard(
  linkId: string,
  composition: CardComposition,
): Promise<ActionResult> {
  if (!linkId) return { ok: false, error: 'id_required' }

  const sanitized = sanitizeBlobUrls(composition)
  const parsed = CardCompositionSchema.safeParse(sanitized)
  if (!parsed.success) return { ok: false, error: 'invalid_composition' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('tracked_links')
    .update({
      qr_card_composition: parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', linkId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateTag(`link:${linkId}`)
  return { ok: true }
}

export async function loadQrCard(
  linkId: string,
): Promise<ActionResult<{ composition: CardComposition | null; legacyConfig: Record<string, unknown> | null }>> {
  if (!linkId) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('tracked_links')
    .select('qr_card_composition, qr_config')
    .eq('id', linkId)
    .eq('site_id', siteId)
    .single()

  if (error) return { ok: false, error: error.message }

  const raw = data.qr_card_composition as unknown
  if (raw && typeof raw === 'object') {
    const parsed = CardCompositionSchema.safeParse(raw)
    if (parsed.success) return { ok: true, composition: sanitizeBlobUrls(parsed.data), legacyConfig: null }
    // Schema evolved — try to recover by deep-merging with defaults
    try {
      const obj = raw as Record<string, unknown>
      const patched = {
        version: 1,
        canvas: obj.canvas ?? { width: 1080, height: 1080, aspectRatio: '1:1' },
        background: obj.background ?? { type: 'solid', color: '#ffffff' },
        elements: Array.isArray(obj.elements) ? obj.elements : [],
      }
      const retry = CardCompositionSchema.safeParse(patched)
      if (retry.success) return { ok: true, composition: sanitizeBlobUrls(retry.data), legacyConfig: null }
    } catch { /* fall through */ }
  }

  return {
    ok: true,
    composition: null,
    legacyConfig: (data.qr_config as Record<string, unknown>) ?? null,
  }
}

export async function saveQrTemplate(
  name: string,
  composition: CardComposition,
  thumbnailFormData: FormData,
): Promise<ActionResult<{ id: string }>> {
  if (!name) return { ok: false, error: 'name_required' }

  const parsed = CardCompositionSchema.safeParse(composition)
  if (!parsed.success) return { ok: false, error: 'invalid_composition' }

  const { siteId } = await getSiteContext()
  const userId = await requireEditScope(siteId)

  const thumbnailFile = thumbnailFormData.get('thumbnail') as File | null
  let thumbnailUrl: string | null = null

  if (thumbnailFile && thumbnailFile.size > 0) {
    const { uploadMediaAsset } = await import('@/lib/media/upload')
    const result = await uploadMediaAsset({
      file: thumbnailFile,
      filename: `qr-template-${Date.now()}.png`,
      folder: 'links',
      siteId,
      uploadedBy: userId,
      tags: ['qr-template'],
    })
    if (result.ok) thumbnailUrl = result.asset.blobUrl
  }

  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('link_qr_templates')
    .insert({
      site_id: siteId,
      name,
      composition: parsed.data,
      config: parsed.data,
      thumbnail_url: thumbnailUrl,
      thumbnail_path: thumbnailUrl,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  revalidateTag('links-settings')
  return { ok: true, id: data.id as string }
}

export async function listQrTemplates(): Promise<ActionResult<{ templates: Array<{ id: string; name: string; composition: CardComposition; thumbnailUrl: string | null; createdAt: string }> }>> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('link_qr_templates')
    .select('id, name, composition, config, thumbnail_url, thumbnail_path, created_at')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })

  if (error) return { ok: false, error: error.message }

  const templates = (data ?? []).map(row => {
    const comp = (row.composition ?? row.config) as CardComposition
    return {
      id: row.id as string,
      name: row.name as string,
      composition: comp,
      thumbnailUrl: (row.thumbnail_url ?? row.thumbnail_path ?? null) as string | null,
      createdAt: row.created_at as string,
    }
  })

  return { ok: true, templates }
}

export async function deleteQrTemplate(templateId: string): Promise<ActionResult> {
  if (!templateId) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('link_qr_templates')
    .delete()
    .eq('id', templateId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateTag('links-settings')
  return { ok: true }
}

export async function exportQrCard(
  linkId: string,
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  if (!linkId) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  const userId = await requireEditScope(siteId)

  const file = formData.get('file') as File | null
  if (!file) return { ok: false, error: 'file_required' }

  const format = formData.get('format') as string ?? 'png'
  const { uploadMediaAsset } = await import('@/lib/media/upload')
  const result = await uploadMediaAsset({
    file,
    filename: `qr-card-${linkId}.${format}`,
    folder: 'links',
    siteId,
    uploadedBy: userId,
    tags: ['qr-card', `link:${linkId}`],
  })

  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, url: result.asset.blobUrl }
}

export async function uploadQrImage(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const { siteId } = await getSiteContext()
  const userId = await requireEditScope(siteId)

  const file = formData.get('file') as File | null
  if (!file) return { ok: false, error: 'file_required' }

  const { uploadMediaAsset } = await import('@/lib/media/upload')
  const result = await uploadMediaAsset({
    file,
    filename: `qr-image-${Date.now()}-${file.name}`,
    folder: 'links',
    siteId,
    uploadedBy: userId,
    tags: ['qr-card-image'],
  })

  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, url: result.asset.blobUrl }
}
