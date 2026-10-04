'use server'
/**
 * Cadastro de canais próprios do YouTube, em /cms/youtube: procurar, adicionar (sem limite de quantidade nem de
 * idioma), mudar idioma e nicho, criar nicho, e remover.
 *
 * Toda action: valida a forma da entrada → guard de edição → só então o service client, sempre filtrando por site_id.
 * A remoção é UMA chamada a uma função do banco (transação): ou apaga tudo, ou nada.
 * O código pode chegar a produção antes das migrations 20261003000006/7: tabela de nichos, coluna slug e funções
 * ausentes viram resposta com texto, nunca erro lançado.
 */
import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { lookupChannelByHandle } from '@/lib/youtube/api-client'
import { isChannelLocale } from '@/lib/youtube/channel-locales'
import { isNicheSlug, NICHE_PALETTE } from '@/lib/youtube/observatorio/niche'
import { readNiches, nicheDefs } from '@/lib/youtube/observatorio/niches-db'
import {
  CHANNEL_TEXT, blockedTitle, isChannelSlug, nicheSlugFromLabel, normalizeNicheLabel, parseRemovalRpc,
  type AddChannelInput, type AddChannelResult, type ChannelIdentityInput, type CreateNicheResult, type LookupChannelResult,
  type RemovalImpactResult, type RemoveChannelResult, type SimpleResult,
} from '@/lib/youtube/channel-registry'

/** Coluna que este banco ainda não tem (Postgres / PostgREST). */
const NO_COLUMN = new Set(['42703', 'PGRST204'])
/** Função que este banco ainda não tem (PostgREST / Postgres). */
const NO_FUNCTION = new Set(['PGRST202', '42883'])
const UNIQUE_VIOLATION = '23505'
const FK_VIOLATION = '23503'
const has = (set: Set<string>, code: string | null | undefined) => code != null && set.has(code)
/**
 * A UNIQUE(site_id, locale) de antes da migration 20261003000006: com o código novo num banco antigo, um segundo canal
 * no mesmo idioma esbarra nela. Não é "canal já cadastrado": é a atualização do banco que falta.
 */
const isOldLocaleKey = (e: { code?: string; message: string } | null | undefined) =>
  e?.code === UNIQUE_VIOLATION && e.message.includes('youtube_channels_site_id_locale_key')


async function requireEditAccess(): Promise<{ siteId: string; userId: string }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return { siteId, userId: res.user.id }
}

function revalidateChannels() {
  revalidateTag('youtube', { expire: 0 })
  revalidatePath('/cms/youtube')
  revalidatePath('/cms/youtube/competitors', 'layout')
  revalidatePath('/')
}

const locale = z.custom<AddChannelInput['locale']>(isChannelLocale, 'Invalid language')
const niche = z.custom<string>(isNicheSlug, 'Invalid niche').nullable()

/**
 * O nicho existe NESTE site? Tabela ausente → valem os dois de fábrica. Qualquer outro erro de leitura recusa
 * (nunca "qualquer nicho serve").
 */
async function nicheExists(sb: SupabaseClient, siteId: string, slug: string): Promise<boolean> {
  try { return nicheDefs(await readNiches(sb, siteId)).some(d => d.id === slug) } catch { return false }
}

/** O canal do YouTube já está neste site? Tolera a coluna slug ausente (relê sem ela). */
async function findRegistered(sb: SupabaseClient, siteId: string, channelId: string):
  Promise<{ ok: true; row: { name: string; slug: string | null } | null; slugColumn: boolean } | { ok: false; error: string }> {
  const withSlug = await sb.from('youtube_channels').select('id, name, slug').eq('site_id', siteId).eq('channel_id', channelId).limit(1)
  if (!withSlug.error) {
    const r = withSlug.data?.[0]
    return { ok: true, slugColumn: true, row: r ? { name: r.name as string, slug: (r.slug as string | null) ?? null } : null }
  }
  if (!has(NO_COLUMN, withSlug.error.code)) return { ok: false, error: withSlug.error.message }
  const bare = await sb.from('youtube_channels').select('id, name').eq('site_id', siteId).eq('channel_id', channelId).limit(1)
  if (bare.error) return { ok: false, error: bare.error.message }
  const r = bare.data?.[0]
  return { ok: true, slugColumn: false, row: r ? { name: r.name as string, slug: null } : null }
}

/* ------------------------------------------------------------------ lookup */

const lookupSchema = z.object({ handleOrUrl: z.string().trim().min(1, 'Handle or URL is required').max(200) })

export async function lookupYouTubeChannel(input: { handleOrUrl: string }): Promise<LookupChannelResult> {
  const parsed = lookupSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation failed' }
  const { siteId } = await requireEditAccess()

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return { ok: false, error: 'YouTube API key not configured' }

  let channel
  try {
    channel = await lookupChannelByHandle(parsed.data.handleOrUrl, apiKey)
  } catch (e) {
    if (e instanceof Error && e.message === 'quotaExceeded') return { ok: false, error: 'YouTube API limit reached. Try again later.' }
    console.error('[youtube] channel lookup failed:', e instanceof Error ? e.message : e)
    return { ok: false, error: 'Failed to look up channel. Please try again.' }
  }
  if (!channel) return { ok: false, error: 'Channel not found. Check the handle and try again.' }

  const sb = getSupabaseServiceClient()
  const reg = await findRegistered(sb, siteId, channel.channelId)
  if (!reg.ok) return { ok: false, error: reg.error }
  if (reg.row) return { ok: false, error: CHANNEL_TEXT.alreadyRegistered(reg.row.slug ?? reg.row.name) }

  // A regra do slug mora no banco: ele diz qual slug livre este handle recebe. Sem a função (ou sem a coluna), sem sugestão.
  let slug: string | null = null
  if (reg.slugColumn) {
    const pick = await sb.rpc('youtube_channel_slug_pick', { p_site_id: siteId, p_handle: channel.handle })
    if (!pick.error && isChannelSlug(pick.data)) slug = pick.data
  }
  return { ok: true, channel, slug }
}

/* ------------------------------------------------------------------ adicionar */

const addSchema = z.object({
  channelId: z.string().min(1).max(64),
  locale,
  niche,
  handle: z.string().min(1).max(200),
  name: z.string().min(1).max(300),
  description: z.string().nullable(),
  uploadsPlaylistId: z.string().min(1).max(64),
  subscriberCount: z.number().int().min(0),
  videoCount: z.number().int().min(0),
  thumbnailUrl: z.string().url().nullable(),
  bannerUrl: z.string().url().nullable(),
  customUrl: z.string().nullable(),
})

/** Sem recusa por idioma e sem limite de canais. slug null = o banco deriva do handle. Devolve o id real e o slug gravado. */
export async function addYouTubeChannel(input: AddChannelInput): Promise<AddChannelResult> {
  const slug = input?.slug ?? null
  if (slug !== null && !isChannelSlug(slug)) return { ok: false, error: CHANNEL_TEXT.slugInvalid, field: 'slug' }
  const parsed = addSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue?.message ?? 'Validation failed', ...(issue?.path[0] === 'niche' ? { field: 'niche' as const } : {}) }
  }
  const d = parsed.data
  const { siteId } = await requireEditAccess()
  const sb = getSupabaseServiceClient()

  if (d.niche !== null && !(await nicheExists(sb, siteId, d.niche))) return { ok: false, error: CHANNEL_TEXT.nicheNotFound, field: 'niche' }

  const reg = await findRegistered(sb, siteId, d.channelId)
  if (!reg.ok) return { ok: false, error: reg.error }
  if (reg.row) return { ok: false, error: CHANNEL_TEXT.alreadyRegistered(reg.row.slug ?? reg.row.name), field: 'handle' }

  const useSlug = reg.slugColumn && slug !== null
  const slugOwner = async (): Promise<string | null> => {
    const taken = await sb.from('youtube_channels').select('id, name').eq('site_id', siteId).eq('slug', slug).limit(1)
    return (taken.data?.[0]?.name as string | undefined) ?? null
  }
  if (useSlug) {
    const owner = await slugOwner()
    if (owner !== null) return { ok: false, error: CHANNEL_TEXT.slugTaken(slug, owner), field: 'slug' }
  }

  const ins = await sb.from('youtube_channels').insert({
    site_id: siteId,
    channel_id: d.channelId,
    locale: d.locale,
    niche: d.niche,
    ...(useSlug ? { slug } : {}),
    handle: d.handle,
    name: d.name,
    description: d.description,
    uploads_playlist_id: d.uploadsPlaylistId,
    subscriber_count: d.subscriberCount,
    video_count: d.videoCount,
    thumbnail_url: d.thumbnailUrl,
    banner_url: d.bannerUrl,
    custom_url: d.customUrl,
    sync_enabled: true,
    sync_schedules: [],
  }).select(reg.slugColumn ? 'id, slug' : 'id').single()

  if (ins.error || !ins.data) {
    const msg = ins.error?.message ?? 'Insert failed'
    if (isOldLocaleKey(ins.error)) return { ok: false, error: CHANNEL_TEXT.sameLanguageUnavailable }
    if (ins.error?.code === UNIQUE_VIOLATION) {
      // dois cadastros ao mesmo tempo: o banco é quem decide, e a resposta é a mesma da checagem
      if (msg.includes('slug') && slug !== null) return { ok: false, error: CHANNEL_TEXT.slugTaken(slug, (await slugOwner()) ?? slug), field: 'slug' }
      return { ok: false, error: CHANNEL_TEXT.alreadyRegistered(slug ?? d.name), field: 'handle' }
    }
    if (ins.error?.code === FK_VIOLATION) return { ok: false, error: CHANNEL_TEXT.nicheNotFound, field: 'niche' }
    return { ok: false, error: msg }
  }
  // a lista de colunas do select varia (com ou sem slug): lê a linha pelo que ela de fato trouxe
  const inserted: unknown = ins.data
  const row: Record<string, unknown> = typeof inserted === 'object' && inserted !== null ? Object.fromEntries(Object.entries(inserted)) : {}
  const newId = typeof row.id === 'string' ? row.id : null
  if (newId === null) return { ok: false, error: 'Insert failed' }
  const newSlug = typeof row.slug === 'string' ? row.slug : null

  // Primeira sincronização em segundo plano (como antes).
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    fetch(`${baseUrl}/api/cron/sync-youtube?mode=manual`, { method: 'GET', headers: { Authorization: `Bearer ${cronSecret}` } })
      .catch((err) => { console.warn('[youtube] background sync trigger failed:', err instanceof Error ? err.message : err) })
  }

  revalidateChannels()
  return { ok: true, id: newId, slug: newSlug }
}

/* ------------------------------------------------------------------ idioma e nicho */

const identitySchema = z.object({ channel_id: z.string().uuid(), locale, niche })

/** Idioma e nicho de um canal já cadastrado. O slug não muda depois de criado: esta action não o aceita. */
export async function updateYouTubeChannelIdentity(input: ChannelIdentityInput): Promise<SimpleResult> {
  const parsed = identitySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation failed' }
  const d = parsed.data
  const { siteId } = await requireEditAccess()
  const sb = getSupabaseServiceClient()
  if (d.niche !== null && !(await nicheExists(sb, siteId, d.niche))) return { ok: false, error: CHANNEL_TEXT.nicheNotFound }

  const { data, error } = await sb.from('youtube_channels')
    .update({ locale: d.locale, niche: d.niche, updated_at: new Date().toISOString() })
    .eq('id', d.channel_id).eq('site_id', siteId).select('id')
  if (isOldLocaleKey(error)) return { ok: false, error: CHANNEL_TEXT.sameLanguageUnavailable }
  if (error) return { ok: false, error: error.code === FK_VIOLATION ? CHANNEL_TEXT.nicheNotFound : error.message }
  if (!data || data.length === 0) return { ok: false, error: CHANNEL_TEXT.channelNotFound }
  revalidateChannels()
  return { ok: true }
}

/* ------------------------------------------------------------------ criar nicho */

/**
 * Cria um nicho do site. O rótulo é aparado e validado; o slug sai do rótulo; a cor é um ID da paleta de quatro (nunca
 * um hex vindo do cliente) e o par gravado é o da paleta; sort_order = o maior do site + 10 (ordem de criação).
 */
export async function createYouTubeNiche(input: { label: string; color: string }): Promise<CreateNicheResult> {
  const label = typeof input?.label === 'string' ? normalizeNicheLabel(input.label) : null
  const slug = label === null ? '' : nicheSlugFromLabel(label)
  if (label === null || !isNicheSlug(slug)) return { ok: false, error: CHANNEL_TEXT.nicheNameInvalid }
  const color = NICHE_PALETTE.find(c => c.id === input.color)
  if (!color) return { ok: false, error: 'Invalid color' }

  const { siteId, userId } = await requireEditAccess()
  const sb = getSupabaseServiceClient()

  let rows
  try { rows = await readNiches(sb, siteId) } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Failed to read niches' } }
  if (rows === null) return { ok: false, error: CHANNEL_TEXT.nichesUnavailable }

  const key = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
  const clash = rows.find(r => key(r.label) === key(label)) ?? rows.find(r => r.slug === slug)
  if (clash) return { ok: false, error: CHANNEL_TEXT.nicheLabelTaken(clash.label) }

  const sortOrder = rows.reduce((max, r) => Math.max(max, r.sort_order), 0) + 10
  const { error } = await sb.from('youtube_niches').insert({
    site_id: siteId, slug, label, color_dark: color.dark, color_light: color.light, sort_order: sortOrder, created_by: userId,
  })
  if (error) return { ok: false, error: error.code === UNIQUE_VIOLATION ? CHANNEL_TEXT.nicheLabelTaken(label) : error.message }

  revalidatePath('/cms/youtube')
  revalidatePath('/cms/youtube/competitors', 'layout')
  return { ok: true, slug }
}

/* ------------------------------------------------------------------ remoção */

const impactSchema = z.object({ channelId: z.string().uuid() })

/** Conta o que a remoção apagaria e diz que testes A/B a impedem. Só leitura. */
export async function getYouTubeChannelRemovalImpact(input: { channelId: string }): Promise<RemovalImpactResult> {
  const parsed = impactSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: CHANNEL_TEXT.channelNotFound }
  const { siteId } = await requireEditAccess()
  const sb = getSupabaseServiceClient()
  const { data, error } = await sb.rpc('youtube_channel_removal_impact', { p_site_id: siteId, p_channel_id: parsed.data.channelId })
  if (error) return { ok: false, error: has(NO_FUNCTION, error.code) ? CHANNEL_TEXT.removalUnavailable : error.message }
  const res = parseRemovalRpc(data)
  if (res.status === 'not_found') return { ok: false, error: CHANNEL_TEXT.channelNotFound }
  if (res.status !== 'ok') return { ok: false, error: 'Unexpected answer from the database. Nothing was deleted.' }
  return { ok: true, impact: res.impact }
}

const removeSchema = z.object({ channelId: z.string().uuid(), confirmSlug: z.string().min(1).max(64) })

/**
 * Remove o canal e tudo o que depende dele, em uma transação no banco. Teste A/B rodando bloqueia antes de apagar
 * qualquer coisa. confirmSlug é o slug que o dono digitou: o banco confere de novo.
 */
export async function removeYouTubeChannel(input: { channelId: string; confirmSlug: string }): Promise<RemoveChannelResult> {
  const parsed = removeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.path[0] === 'confirmSlug' ? CHANNEL_TEXT.slugMismatch : CHANNEL_TEXT.channelNotFound }
  const { siteId } = await requireEditAccess()
  const sb = getSupabaseServiceClient()
  const { data, error } = await sb.rpc('youtube_channel_remove', {
    p_site_id: siteId, p_channel_id: parsed.data.channelId, p_confirm_slug: parsed.data.confirmSlug,
  })
  if (error) return { ok: false, error: has(NO_FUNCTION, error.code) ? CHANNEL_TEXT.removalUnavailable : error.message }
  const res = parseRemovalRpc(data)
  if (res.status === 'not_found') return { ok: false, error: CHANNEL_TEXT.channelNotFound }
  if (res.status === 'slug_mismatch') return { ok: false, error: CHANNEL_TEXT.slugMismatch }
  if (res.status === 'blocked') return { ok: false, error: blockedTitle(res.impact.name), blockers: res.impact.blockers }
  if (res.status !== 'removed') return { ok: false, error: 'Unexpected answer from the database. Nothing was deleted.' }

  // O banco já desligou a conexão OAuth do canal (revoked_at + tokens apagados) na mesma transação. Nada é revogado no
  // Google: canais do mesmo usuário Google podem compartilhar a autorização, e revogar um poderia derrubar os outros.
  revalidateTag('layout-counts', { expire: 0 })
  revalidatePath('/cms/social', 'layout')
  revalidateChannels()
  return { ok: true }
}
