'use server'

import { revalidateTag } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CardCompositionSchema } from '@tn-figueiredo/links/qr'
import type { CardComposition } from '@tn-figueiredo/links/qr'

type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

async function requireEdit() {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error('forbidden')
  return siteId
}

export interface QrCardSummary {
  id: string
  name: string
  previewUrl: string | null
  createdAt: string
}

export async function listQrCards(linkId: string): Promise<ActionResult<{ cards: QrCardSummary[] }>> {
  const { siteId } = await getSiteContext()
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
}

export async function createQrCard(
  linkId: string,
  name: string,
  composition: CardComposition,
): Promise<ActionResult<{ cardId: string }>> {
  const siteId = await requireEdit()
  const sanitized = sanitizeBlobUrls(composition)
  const parsed = CardCompositionSchema.safeParse(sanitized)
  if (!parsed.success) return { ok: false, error: 'invalid_composition' }

  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('link_qr_cards')
    .insert({
      link_id: linkId,
      site_id: siteId,
      name,
      composition: parsed.data,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidateTag(`link:${linkId}`)
  return { ok: true, cardId: data.id as string }
}

export async function updateQrCard(
  cardId: string,
  linkId: string,
  patch: { name?: string; composition?: CardComposition; previewUrl?: string },
): Promise<ActionResult> {
  const siteId = await requireEdit()
  const supabase = getSupabaseServiceClient()

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) updateData.name = patch.name
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
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  revalidateTag(`link:${linkId}`)
  return { ok: true }
}

export async function deleteQrCard(cardId: string, linkId: string): Promise<ActionResult> {
  const siteId = await requireEdit()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('link_qr_cards')
    .delete()
    .eq('id', cardId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  revalidateTag(`link:${linkId}`)
  return { ok: true }
}

export async function loadQrCardById(
  cardId: string,
): Promise<ActionResult<{ composition: CardComposition | null; name: string }>> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('link_qr_cards')
    .select('composition, name')
    .eq('id', cardId)
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
}

function sanitizeBlobUrls(comp: CardComposition): CardComposition {
  const background = comp.background.type === 'image' && comp.background.url.startsWith('blob:')
    ? { type: 'solid' as const, color: comp.background.fallbackColor }
    : comp.background
  const elements = comp.elements.filter(el => !(el.type === 'image' && el.src.startsWith('blob:')))
  return { ...comp, background, elements }
}
