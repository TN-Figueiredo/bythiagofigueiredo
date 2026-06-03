'use server'

import { z } from 'zod'
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

const NameSchema = z.string().min(1).max(200).trim()

async function checkReadScope(siteId: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!res.ok) return { ok: false, error: res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden' }
  return { ok: true, userId: res.user.id }
}

async function checkEditScope(siteId: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) return { ok: false, error: res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden' }
  return { ok: true, userId: res.user.id }
}

export interface QrCardSummary {
  id: string
  name: string
  previewUrl: string | null
  createdAt: string
}

export async function listQrCards(linkId: string): Promise<ActionResult<{ cards: QrCardSummary[] }>> {
  try {
    const { siteId } = await getSiteContext()
    const auth = await checkReadScope(siteId)
    if (!auth.ok) return { ok: false, error: auth.error }

    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('link_qr_cards')
      .select('id, name, preview_url, created_at')
      .eq('link_id', linkId)
      .eq('site_id', siteId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) return { ok: false, error: error.message }
    return {
      ok: true,
      cards: (data ?? []).map(c => ({
        id: c.id as string,
        name: c.name as string,
        previewUrl: (c.preview_url as string) ?? null,
        createdAt: c.created_at as string,
      })),
    }
  } catch (err) {
    console.error('[listQrCards]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'list_failed' }
  }
}

export async function createQrCard(
  linkId: string,
  name: string,
  composition: CardComposition,
): Promise<ActionResult<{ cardId: string }>> {
  try {
    const { siteId } = await getSiteContext()
    const auth = await checkEditScope(siteId)
    if (!auth.ok) return { ok: false, error: auth.error }

    const nameParsed = NameSchema.safeParse(name)
    if (!nameParsed.success) return { ok: false, error: 'invalid_name' }

    const sanitized = sanitizeBlobUrls(composition)
    const parsed = CardCompositionSchema.safeParse(sanitized)
    if (!parsed.success) return { ok: false, error: 'invalid_composition' }

    const supabase = getSupabaseServiceClient()

    const { count } = await supabase
      .from('tracked_links')
      .select('id', { count: 'exact', head: true })
      .eq('id', linkId)
      .eq('site_id', siteId)
      .is('deleted_at', null)
    if (!count) return { ok: false, error: 'link_not_found' }

    const { data, error } = await supabase
      .from('link_qr_cards')
      .insert({
        link_id: linkId,
        site_id: siteId,
        name: nameParsed.data,
        composition: parsed.data,
      })
      .select('id')
      .single()

    if (error) return { ok: false, error: error.message }
    revalidateTag(`link:${linkId}`)
    return { ok: true, cardId: data.id as string }
  } catch (err) {
    console.error('[createQrCard]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'create_failed' }
  }
}

export async function updateQrCard(
  cardId: string,
  linkId: string,
  patch: { name?: string; composition?: CardComposition; previewUrl?: string },
): Promise<ActionResult> {
  try {
    const { siteId } = await getSiteContext()
    const auth = await checkEditScope(siteId)
    if (!auth.ok) return { ok: false, error: auth.error }

    const supabase = getSupabaseServiceClient()

    const updateData: Record<string, unknown> = {}
    if (patch.name !== undefined) {
      const nameParsed = NameSchema.safeParse(patch.name)
      if (!nameParsed.success) return { ok: false, error: 'invalid_name' }
      updateData.name = nameParsed.data
    }
    if (patch.composition !== undefined) {
      const sanitized = sanitizeBlobUrls(patch.composition)
      const parsed = CardCompositionSchema.safeParse(sanitized)
      if (!parsed.success) return { ok: false, error: 'invalid_composition' }
      updateData.composition = parsed.data
    }
    if (patch.previewUrl !== undefined) updateData.preview_url = patch.previewUrl

    const { error } = await supabase
      .from('link_qr_cards')
      .update(updateData)
      .eq('id', cardId)
      .eq('link_id', linkId)
      .eq('site_id', siteId)

    if (error) return { ok: false, error: error.message }
    revalidateTag(`link:${linkId}`)
    return { ok: true }
  } catch (err) {
    console.error('[updateQrCard]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'update_failed' }
  }
}

export async function deleteQrCard(cardId: string, linkId: string): Promise<ActionResult> {
  try {
    const { siteId } = await getSiteContext()
    const auth = await checkEditScope(siteId)
    if (!auth.ok) return { ok: false, error: auth.error }

    const supabase = getSupabaseServiceClient()

    const { error } = await supabase
      .from('link_qr_cards')
      .delete()
      .eq('id', cardId)
      .eq('link_id', linkId)
      .eq('site_id', siteId)

    if (error) return { ok: false, error: error.message }
    revalidateTag(`link:${linkId}`)
    return { ok: true }
  } catch (err) {
    console.error('[deleteQrCard]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'delete_failed' }
  }
}

export async function loadQrCardById(
  cardId: string,
  linkId: string,
): Promise<ActionResult<{ composition: CardComposition | null; name: string }>> {
  try {
    const { siteId } = await getSiteContext()
    const auth = await checkReadScope(siteId)
    if (!auth.ok) return { ok: false, error: auth.error }

    const supabase = getSupabaseServiceClient()

    const { data, error } = await supabase
      .from('link_qr_cards')
      .select('composition, name')
      .eq('id', cardId)
      .eq('link_id', linkId)
      .eq('site_id', siteId)
      .single()

    if (error || !data) return { ok: false, error: 'not_found' }

    const raw = data.composition as unknown
    if (raw && typeof raw === 'object') {
      const parsed = CardCompositionSchema.safeParse(raw)
      if (parsed.success) {
        return { ok: true, composition: sanitizeBlobUrls(parsed.data), name: data.name as string }
      }
    }

    return { ok: true, composition: null, name: data.name as string }
  } catch (err) {
    console.error('[loadQrCardById]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'load_failed' }
  }
}
