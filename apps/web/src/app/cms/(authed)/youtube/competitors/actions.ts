'use server'

import { revalidatePath } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { syncCompetitorChannel } from '@/lib/youtube/competitor-sync'
import { getChannelSlots, UNLOCK_STEP, type ChannelSlots } from '@/lib/youtube/competitor-slots'
import { loadRows, rowsToDataset } from '@/lib/youtube/observatorio/load'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { createObservatory } from '@/lib/youtube/observatorio'
import { humanizeSyncError } from '@/lib/youtube/observatorio/channels'
import { syncResultToast, type SyncNowResult } from './_chrome/view-model'

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}

export async function addCompetitorChannel(
  channelId: string,
  niche?: 'viagem' | 'ia',
): Promise<{ ok: boolean; error?: string; slots?: ChannelSlots }> {
  // Validate channel ID format
  const trimmed = channelId.trim()
  if (trimmed.length < 2 || trimmed.length > 50) {
    return { ok: false, error: 'Channel ID inválido' }
  }

  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false, error: 'forbidden' } }

  const supabase = getSupabaseServiceClient()

  const before = await getChannelSlots(siteId)
  if (before.free === 0) return { ok: false, error: 'Sem vagas', slots: before }

  // Check duplicate
  const { data: existing } = await supabase
    .from('competitor_channels')
    .select('id, niche')
    .eq('site_id', siteId)
    .eq('channel_id', trimmed)
    .maybeSingle()

  if (existing) {
    const where = existing.niche ? ` em ${existing.niche === 'ia' ? 'IA' : 'Viagem'}` : ''
    return { ok: false, error: `Canal já adicionado${where}` }
  }

  const { data: inserted, error } = await supabase.from('competitor_channels').insert({
    site_id: siteId,
    channel_id: trimmed,
    channel_name: trimmed,
    ...(niche ? { niche } : {}),
  }).select('id, channel_id, site_id').single()

  if (error) return { ok: false, error: error.message }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (apiKey && inserted) {
    try {
      await syncCompetitorChannel(inserted, apiKey)
    } catch {
      // sync failure is non-fatal — channel was added, sync can retry later
    }
  }

  revalidatePath('/cms/youtube/competitors')
  return { ok: true, slots: await getChannelSlots(siteId) }
}

export async function removeCompetitorChannel(id: string): Promise<{ ok: boolean }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }

  const supabase = getSupabaseServiceClient()
  await supabase.from('competitor_channels').delete().eq('id', id).eq('site_id', siteId)
  revalidatePath('/cms/youtube/competitors')
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

  const result = await syncCompetitorChannel(channel, apiKey)
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
  const { data: me } = await sb.from('site_users').select('role').eq('site_id', siteId).eq('user_id', res.user.id).maybeSingle()
  if (!me || !['super_admin', 'org_admin'].includes(me.role as string)) return { ok: false, error: 'forbidden' }
  const cur = await getChannelSlots(siteId)
  const { error } = await sb.from('competitor_settings').upsert(
    { site_id: siteId, channel_limit: cur.limit + UNLOCK_STEP, updated_by: res.user.id, updated_at: new Date().toISOString() },
    { onConflict: 'site_id' },
  )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/youtube/competitors', 'layout')
  return { ok: true, slots: await getChannelSlots(siteId) }
}

/** The page's maxDuration is 60 s: the manual round stops starting channels before 50 s. */
const SYNC_BUDGET_MS = 50_000

/**
 * "Sincronizar concorrentes" (chrome): syncs, one after the other, this site's competitors whose engine state is ok.
 * Channels with a problem are not touched and are listed; channels still fetching videos stay out of the round.
 * The ok count comes from the run, never from the plan: a throw, a lock held by another sync or the time budget
 * turns the channel into a problem. 0 synced is never a success.
 */
export async function syncCompetitorsNow(): Promise<SyncNowResult> {
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
  const started = Date.now()
  let attempted = 0
  for (const id of round) {
    const elapsed = Date.now() - started
    // the next channel is expected to take as long as the average so far
    if (attempted > 0 && elapsed + elapsed / attempted > SYNC_BUDGET_MS) { problems.push({ id, label: 'não coube no tempo desta rodada' }); continue }
    attempted++
    try {
      const r = await syncCompetitorChannel({ id, channel_id: ytId.get(id) ?? '', site_id: siteId }, apiKey)
      if (r.skipped) problems.push({ id, label: 'outra sincronização deste canal já estava em andamento' })
      else ok.push(id)
    } catch (e) {
      problems.push({ id, label: humanizeSyncError(e instanceof Error ? e.message : String(e)) })
    }
  }
  if (attempted > 0) revalidatePath('/cms/youtube/competitors', 'layout')
  const toast = syncResultToast({ ok, problems, outOfRound }, id => obs.channel(id)?.name ?? id)
  return { ok: ok.length > 0, text: toast.text, problems, outOfRound, toast }
}
