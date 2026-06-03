'use server'

import { revalidatePath } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { syncCompetitorChannel } from '@/lib/youtube/competitor-sync'

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}

export async function addCompetitorChannel(channelId: string): Promise<{ ok: boolean; error?: string }> {
  // Validate channel ID format
  const trimmed = channelId.trim()
  if (trimmed.length < 2 || trimmed.length > 50) {
    return { ok: false, error: 'Channel ID inválido' }
  }

  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false, error: 'forbidden' } }

  const supabase = getSupabaseServiceClient()

  // Check limit (max 15)
  const { count } = await supabase
    .from('competitor_channels')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)

  if ((count ?? 0) >= 15) return { ok: false, error: 'Limite de 15 canais atingido' }

  // Check duplicate
  const { data: existing } = await supabase
    .from('competitor_channels')
    .select('id')
    .eq('site_id', siteId)
    .eq('channel_id', trimmed)
    .maybeSingle()

  if (existing) return { ok: false, error: 'Canal já adicionado' }

  const { data: inserted, error } = await supabase.from('competitor_channels').insert({
    site_id: siteId,
    channel_id: trimmed,
    channel_name: trimmed,
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
  return { ok: true }
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
