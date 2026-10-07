'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { canAdminSiteUsers } from '@/lib/youtube/competitor-admin'
import { getCompetitorRemovalImpact, type CompetitorRemovalImpact } from '@/lib/youtube/competitor-removal-impact'
import { syncCompetitorChannel } from '@/lib/youtube/competitor-sync'
import { getChannelSlots, UNLOCK_STEP, type ChannelSlots } from '@/lib/youtube/competitor-slots'
import { loadRows, rowsToDataset } from '@/lib/youtube/observatorio/load'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { invalidateObservatory } from '@/lib/youtube/observatorio/cache-tag'
import { createObservatory } from '@/lib/youtube/observatorio'
import { humanizeSyncError } from '@/lib/youtube/observatorio/channels'
import { BUILTIN_NICHES, isNicheSlug, nicheLabel, type Niche, type NicheDef } from '@/lib/youtube/observatorio/niche'
import { readNicheDefs } from '@/lib/youtube/observatorio/niches-db'
import { RULES } from '@/lib/youtube/observatorio/rules'
import type { PinResult } from './pin-result'
import type { SyncNowResult } from './_chrome/view-model'
import { parseChannelInput } from './_canais/channel-input'

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}
/** The same guard as requireEditAccess (it throws), for the writes that record who did them. */
async function requireEditUser(): Promise<{ siteId: string; userId: string }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return { siteId, userId: res.user.id }
}

const YT_API = 'https://www.googleapis.com/youtube/v3'
const BAD_INPUT = 'Use o @handle (ex.: @LukeDamant) ou a URL do canal (youtube.com/@…).'

/** @handle → channel id and title through the YouTube Data API (channels.list forHandle, 1 unit). */
async function resolveHandle(handle: string, apiKey: string): Promise<{ id: string; title: string } | null> {
  const res = await fetch(`${YT_API}/channels?part=id,snippet&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('YouTube API ' + res.status)
  const body = (await res.json()) as { items?: Array<{ id?: string; snippet?: { title?: string } }> }
  const it = body.items?.[0]
  return it?.id ? { id: it.id, title: it.snippet?.title ?? handle } : null
}

/**
 * "Adicionar canal": accepts the forms the Canais dialog accepts (and a bare id from the old modal). Refuses when there
 * is no free slot, when the channel is the site's own, and when it is already in the observatório (saying its niche).
 * The niche must be one of the site's (youtube_niches, read after the guard).
 */
export async function addCompetitorChannel(
  channelInput: string,
  niche?: Niche,
  videoLimit?: number,
): Promise<{ ok: boolean; error?: string; slots?: ChannelSlots; title?: string }> {
  const parsed = parseChannelInput(channelInput)
  if (!parsed) return { ok: false, error: BAD_INPUT }
  if (niche !== undefined && !isNicheSlug(niche)) return { ok: false, error: 'Nicho inválido.' }
  const limit = videoLimit === undefined ? undefined : Math.round(videoLimit)
  if (limit !== undefined && !(limit >= 10 && limit <= 200)) return { ok: false, error: 'Escolha entre 10 e 200 vídeos.' }

  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false, error: 'forbidden' } }

  const supabase = getSupabaseServiceClient()
  // the site's niches (table absent → the two built-in). A read error is not "invalid niche": the niche could not be
  // checked, and nothing is added (never "any niche goes"); without a niche to check, the labels fall back to the built-in ones.
  const defs: NicheDef[] | null = await readNicheDefs(supabase, siteId).catch(() => null)
  if (niche !== undefined && !defs) return { ok: false, error: 'Não deu para conferir o nicho agora. Tente de novo em alguns minutos.' }
  if (niche !== undefined && !defs?.some(d => d.id === niche)) return { ok: false, error: 'Nicho inválido.' }

  const apiKey = process.env.YOUTUBE_API_KEY
  let ytId: string, title: string
  if (parsed.kind === 'id') { ytId = parsed.id; title = parsed.id }
  else {
    if (!apiKey) return { ok: false, error: 'A chave da API do YouTube não está configurada.' }
    let found: { id: string; title: string } | null
    try { found = await resolveHandle(parsed.handle, apiKey) } catch { return { ok: false, error: 'O YouTube não respondeu. Tente de novo em alguns minutos.' } }
    if (!found) return { ok: false, error: `Canal não encontrado no YouTube: confira o ${parsed.handle}.` }
    ytId = found.id; title = found.title
  }

  const { data: owns } = await supabase.from('youtube_channels').select('id, channel_id').eq('site_id', siteId)
  const ownList: Array<{ channel_id: string }> = owns ?? []
  if (ownList.some(o => o.channel_id === ytId)) return { ok: false, error: (ownList.length > 1 ? 'Esse é um dos seus canais' : 'Esse é o seu canal') + ': ele já aparece na tabela e não ocupa vaga.' }

  const { data: existing } = await supabase
    .from('competitor_channels')
    .select('id, niche, channel_name')
    .eq('site_id', siteId)
    .eq('channel_id', ytId)
    .maybeSingle()

  if (existing) {
    const en = existing.niche as string | null
    const known = defs ?? BUILTIN_NICHES
    const n = en != null && known.some(d => d.id === en) ? ` (${nicheLabel(known, en)})` : ''
    return { ok: false, error: `${existing.channel_name || title} já está no observatório${n}.` }
  }

  // after the duplicate check: a channel already in the observatório says so even when there is no free slot
  const before = await getChannelSlots(siteId)
  if (before.free === 0) return { ok: false, error: `Sem vagas: ${before.used} de ${before.limit} concorrentes. Remova um canal para adicionar outro.`, slots: before }

  const { data: inserted, error } = await supabase.from('competitor_channels').insert({
    site_id: siteId,
    channel_id: ytId,
    channel_name: title,
    ...(niche ? { niche } : {}),
    ...(limit !== undefined ? { video_limit: limit } : {}),
  }).select('id, channel_id, site_id').single()

  if (error) return { ok: false, error: error.message }

  // The first sync takes up to a minute (videos, thumbnails, Shorts probes): it runs after the answer, so the dialog
  // closes at once and the row shows "buscando vídeos" until it ends. A failure is non-fatal: the channel was added
  // and the cron syncs it in the next round.
  if (apiKey && inserted) {
    after(async () => {
      try { await syncCompetitorChannel(inserted, apiKey) } catch (err) {
        Sentry.captureException(err, { tags: { component: 'competitors', step: 'first-sync' }, extra: { channelId: inserted.channel_id, siteId } })
      } finally {
        // the cached rows of this site were read before, or during, this sync
        invalidateObservatory(siteId)
      }
    })
  }

  revalidatePath('/cms/youtube/competitors', 'layout')
  // the resolved YouTube title; a bare id has none until the first sync
  return { ok: true, slots: await getChannelSlots(siteId), ...(parsed.kind === 'handle' ? { title } : {}) }
}

/** The Canais dialog's submit (one object, so the client passes what it validated). */
export async function addChannelFromCanais(input: { channel: string; niche: Niche; videoLimit: number }): Promise<{ ok: boolean; error?: string; title?: string }> {
  if (!input || typeof input.channel !== 'string' || typeof input.videoLimit !== 'number') return { ok: false, error: 'Pedido inválido.' }
  const res = await addCompetitorChannel(input.channel, input.niche, input.videoLimit)
  return { ok: res.ok, ...(res.error ? { error: res.error } : {}), ...(res.title ? { title: res.title } : {}) }
}

export async function removeCompetitorChannel(id: string): Promise<{ ok: boolean }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }

  const supabase = getSupabaseServiceClient()
  // a row of another site (or an id that does not exist) deletes nothing: that is not a success
  const { data, error } = await supabase.from('competitor_channels').delete().eq('id', id).eq('site_id', siteId).select('id')
  if (error || !data || data.length === 0) return { ok: false }
  // the channel's videos, versions and records went with it (cascade): its cached rows must not outlive it
  invalidateObservatory(siteId)
  revalidatePath('/cms/youtube/competitors', 'layout')
  return { ok: true }
}

export async function syncCompetitorNow(channelRowId: string): Promise<{ ok: boolean; result?: { videosChecked: number; changesDetected: number } }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return { ok: false }

  const supabase = getSupabaseServiceClient()
  const { data: channel } = await supabase
    .from('competitor_channels')
    .select('id, channel_id, site_id')
    .eq('id', channelRowId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return { ok: false }

  let result: Awaited<ReturnType<typeof syncCompetitorChannel>>
  // a sync that throws midway may have written part of its data: the cache goes either way
  try { result = await syncCompetitorChannel(channel, apiKey) } finally { invalidateObservatory(siteId) }
  revalidatePath('/cms/youtube/competitors')
  return { ok: true, result }
}

export async function toggleBookmark(changeId: string): Promise<{ ok: boolean }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }

  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('competitor_changes')
    .select('bookmarked')
    .eq('id', changeId)
    .eq('site_id', siteId)
    .single()

  if (!data) return { ok: false }

  await supabase
    .from('competitor_changes')
    .update({ bookmarked: !data.bookmarked })
    .eq('id', changeId)
    .eq('site_id', siteId)

  revalidatePath('/cms/youtube/competitors')
  return { ok: true }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Swipe file of the Observatório (Mudanças): the engine names a change by the version it opened (`toId`), so the
 * row is the `competitor_changes` whose `to_version_id` is that key — or, for a legacy row loaded as a pre-series
 * version, whose own `id` is the key. Toggles `bookmarked` on every matching row and returns the new state.
 */
export async function toggleChangeBookmark(key: string): Promise<{ ok: boolean; saved?: boolean }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }
  if (!UUID_RE.test(key)) return { ok: false }

  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('competitor_changes')
    .select('id, bookmarked')
    .eq('site_id', siteId)
    .or(`to_version_id.eq.${key},id.eq.${key}`)
  const rows = data ?? []
  if (!rows.length) return { ok: false }

  // every row of that version moves together, so the state never splits: if any of them is saved, all of them leave
  const saved = !rows.some(r => r.bookmarked)
  const { error } = await supabase.from('competitor_changes').update({ bookmarked: saved }).eq('site_id', siteId).in('id', rows.map(r => r.id))
  if (error) return { ok: false }
  revalidatePath('/cms/youtube/competitors/mudancas')
  return { ok: true, saved }
}

export async function syncFullHistory(channelRowId: string): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false, error: 'forbidden' } }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return { ok: false, error: 'API key not configured' }

  const supabase = getSupabaseServiceClient()

  // Backpressure: max 1 full sync per site at a time
  const { count: syncing } = await supabase
    .from('competitor_channels')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('sync_status', 'syncing')
    .gt('sync_started_at', new Date(Date.now() - 10 * 60_000).toISOString())

  if ((syncing ?? 0) > 0) return { ok: false, error: 'Outro canal está sincronizando. Aguarde.' }

  // Set sync_mode to full
  await supabase
    .from('competitor_channels')
    .update({ sync_mode: 'full', full_sync_completed_at: null })
    .eq('id', channelRowId)
    .eq('site_id', siteId)

  const { data: channel } = await supabase
    .from('competitor_channels')
    .select('id, channel_id, site_id')
    .eq('id', channelRowId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return { ok: false, error: 'Canal não encontrado' }

  try {
    await syncCompetitorChannel(channel, apiKey)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Sync failed' }
  } finally {
    invalidateObservatory(siteId)
    revalidatePath('/cms/youtube/competitors')
  }
}

export async function updateVideoLimit(channelRowId: string, limit: number): Promise<{ ok: boolean }> {
  const clamped = limit >= 200 ? 200 : 50
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }

  const supabase = getSupabaseServiceClient()
  await supabase
    .from('competitor_channels')
    .update({ video_limit: clamped })
    .eq('id', channelRowId)
    .eq('site_id', siteId)

  revalidatePath('/cms/youtube/competitors')
  return { ok: true }
}

export async function getSyncStatus(channelRowId: string): Promise<{
  status: string
  progress: number
  youtubeVideoCount: number | null
  error: string | null
}> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch {
    return { status: 'idle', progress: 0, youtubeVideoCount: null, error: null }
  }

  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('competitor_channels')
    .select('sync_status, sync_progress, youtube_video_count, sync_error')
    .eq('id', channelRowId)
    .eq('site_id', siteId)
    .single()

  if (!data) return { status: 'idle', progress: 0, youtubeVideoCount: null, error: null }

  return {
    status: data.sync_status,
    progress: data.sync_progress,
    youtubeVideoCount: data.youtube_video_count,
    error: data.sync_error,
  }
}

export async function unlockMoreChannels(): Promise<{ ok: boolean; error?: string; slots?: ChannelSlots }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) return { ok: false, error: 'forbidden' }
  const sb = getSupabaseServiceClient()
  if (!(await canAdminSiteUsers(siteId))) return { ok: false, error: 'forbidden' }
  const cur = await getChannelSlots(siteId)
  const { error } = await sb.from('competitor_settings').upsert(
    { site_id: siteId, channel_limit: cur.limit + UNLOCK_STEP, updated_by: res.user.id, updated_at: new Date().toISOString() },
    { onConflict: 'site_id' },
  )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/youtube/competitors', 'layout')
  return { ok: true, slots: await getChannelSlots(siteId) }
}

/**
 * The page's maxDuration is 60 s and one channel can take 20–30 s: no new channel STARTS after 30 s, counted from the
 * top of the action (loading the rows included). syncCompetitorChannel takes no deadline, so a started channel runs.
 */
const SYNC_START_CUTOFF_MS = 30_000

/**
 * "Sincronizar concorrentes" (chrome): syncs, one after the other, this site's competitors whose engine state is ok.
 * Channels with a problem are not touched and are listed; channels still fetching videos stay out of the round.
 * The ok count comes from the run, never from the plan: a throw, a lock held by another sync, a missing YouTube id or
 * the time cutoff turns the channel into a problem. 0 synced is never a success.
 */
export async function syncCompetitorsNow(): Promise<SyncNowResult> {
  const started = Date.now()
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false, text: 'Sem permissão para sincronizar os concorrentes.', problems: [], outOfRound: [] } }
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return { ok: false, text: 'A chave da API do YouTube não está configurada.', problems: [], outOfRound: [] }

  const now = observatoryNow()
  const rows = await loadRows({ siteId, now })
  const obs = createObservatory(rowsToDataset(rows, now))
  const ytId = new Map(rows.channels.map(c => [c.id, c.channel_id]))
  const competitors = obs.channels.filter(c => !c.own)
  const problems: Array<{ id: string; label: string }> = []
  const outOfRound: Array<{ id: string; label: string }> = []
  const round: string[] = []
  for (const c of competitors) {
    if (c.sync.state === 'ok') round.push(c.id)
    else if (c.sync.state === 'backfill') outOfRound.push({ id: c.id, label: c.sync.label ?? 'buscando vídeos' })
    else problems.push({ id: c.id, label: c.sync.problemPhrase ?? c.sync.label ?? c.sync.state })
  }

  const ok: string[] = []
  let attempted = 0
  for (const id of round) {
    if (Date.now() - started > SYNC_START_CUTOFF_MS) { problems.push({ id, label: 'não coube no tempo desta rodada' }); continue }
    const channelId = ytId.get(id)
    if (!channelId) { problems.push({ id, label: 'sem o id do canal no YouTube' }); continue }
    attempted++
    try {
      const r = await syncCompetitorChannel({ id, channel_id: channelId, site_id: siteId }, apiKey)
      if (r.skipped) problems.push({ id, label: 'outra sincronização deste canal já estava em andamento' })
      else ok.push(id)
    } catch (e) {
      problems.push({ id, label: humanizeSyncError(e instanceof Error ? e.message : String(e)) })
    }
  }
  if (attempted > 0) { invalidateObservatory(siteId); revalidatePath('/cms/youtube/competitors', 'layout') }
  const toast = obs.syncResultToast({ ok, problems, outOfRound })
  return { ok: ok.length > 0, text: toast.text, problems, outOfRound, toast }
}

const PIN_DENIED: PinResult = { ok: false, kind: 'denied', error: 'Você não tem permissão para fixar ou desafixar vídeos neste site. Se a sessão expirou, entre de novo.' }
const PIN_GONE: PinResult = { ok: false, kind: 'denied', error: 'Este vídeo não existe mais no Observatório.' }
const PIN_FAILED: PinResult = { ok: false, kind: 'failed', error: 'Não foi possível fixar agora. Tente de novo.' }
const UNPIN_FAILED: PinResult = { ok: false, kind: 'failed', error: 'Não foi possível desafixar agora. Tente de novo.' }
interface PinTarget { id: string; channelId: string; channelName: string; pinnedAt: string | null }

/**
 * The competitor video and its channel, only when the channel is this site's: competitor_videos has no site_id, so the
 * site comes from the channel. A video of another site reads as not found. The database error itself is never returned.
 */
async function pinTarget(supabase: ReturnType<typeof getSupabaseServiceClient>, siteId: string, videoId: string): Promise<PinTarget | 'not-found' | 'error'> {
  const { data: video, error: e1 } = await supabase.from('competitor_videos').select('id, competitor_channel_id, pinned_at').eq('id', videoId).maybeSingle()
  if (e1) return 'error'
  if (!video) return 'not-found'
  const { data: channel, error: e2 } = await supabase.from('competitor_channels').select('id, channel_name').eq('id', video.competitor_channel_id).eq('site_id', siteId).maybeSingle()
  if (e2) return 'error'
  if (!channel) return 'not-found'
  return { id: video.id, channelId: channel.id, channelName: channel.channel_name || 'este canal', pinnedAt: video.pinned_at ?? null }
}

/**
 * "Fixar vídeo" (R118): pins a competitor video so it stays observed after it falls out of the channel's
 * video_limit. The cap is enforced in the database (pin_competitor_video locks the channel row, so two simultaneous
 * pins cannot both pass); the number itself is RULES.pinLimit, handed over on every call. Never unpins another one.
 */
export async function pinVideo(videoId: string): Promise<PinResult> {
  let who: { siteId: string; userId: string }
  try { who = await requireEditUser() } catch { return PIN_DENIED }
  if (typeof videoId !== 'string' || !UUID_RE.test(videoId)) return PIN_GONE

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase.rpc('pin_competitor_video', { p_site_id: who.siteId, p_video_id: videoId, p_user_id: who.userId, p_limit: RULES.pinLimit })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return PIN_FAILED
  const d = data as Record<string, unknown>
  if (d.status === 'not_found') return PIN_GONE
  if (d.status === 'cap') {
    // an answer without the count is "could not check": the sentence never invents a number
    if (typeof d.pinned !== 'number') return PIN_FAILED
    const name = typeof d.name === 'string' && d.name ? d.name : 'este canal'
    return { ok: false, kind: 'cap', error: `Sem vagas: ${d.pinned} de ${RULES.pinLimit} vídeos fixados em ${name}. Desafixe um para fixar outro.` }
  }
  // anything but an explicit ok is a failure: an unknown answer is never "pinned"
  if (d.status !== 'ok') return PIN_FAILED
  // pinned_at lives in the cached rows of the channel: without this the button says "Fixado" and the screen reloads
  // with the video still unpinned. Also when it was already pinned (another tab may hold the stale pack).
  invalidateObservatory(who.siteId)
  if (d.already !== true) revalidatePath('/cms/youtube/competitors', 'layout')
  return { ok: true }
}

/** "Desafixar": unpins. The stored history stays (R120); only the daily record and the every-sync check stop. */
export async function unpinVideo(videoId: string): Promise<PinResult> {
  let who: { siteId: string; userId: string }
  try { who = await requireEditUser() } catch { return PIN_DENIED }
  if (typeof videoId !== 'string' || !UUID_RE.test(videoId)) return PIN_GONE

  const supabase = getSupabaseServiceClient()
  const t = await pinTarget(supabase, who.siteId, videoId)
  if (t === 'error') return UNPIN_FAILED
  if (t === 'not-found') return PIN_GONE
  // already unpinned in the database: a stale cached pack may still show it pinned, so the cache goes anyway
  if (!t.pinnedAt) { invalidateObservatory(who.siteId); return { ok: true } }

  const { data, error } = await supabase.from('competitor_videos').update({ pinned_at: null, pinned_by: null })
    .eq('id', t.id).eq('competitor_channel_id', t.channelId).select('id')
  if (error || !Array.isArray(data)) return UNPIN_FAILED
  // no row written: the video was removed between the read and the write
  if (!data.length) return PIN_GONE
  invalidateObservatory(who.siteId)
  revalidatePath('/cms/youtube/competitors', 'layout')
  return { ok: true }
}

/**
 * What "Remover canal" would delete, for the confirmation dialog. `ok: false` covers no access, a channel of another
 * site and a failed count: the dialog then says it could not count, it never shows zeros.
 */
export async function getCompetitorRemovalImpactAction(channelRowId: string): Promise<{ ok: true; impact: CompetitorRemovalImpact } | { ok: false }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }
  if (typeof channelRowId !== 'string' || !UUID_RE.test(channelRowId)) return { ok: false }
  try {
    const impact = await getCompetitorRemovalImpact(siteId, channelRowId)
    return impact ? { ok: true, impact } : { ok: false }
  } catch { return { ok: false } }
}
