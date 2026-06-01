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
    .eq('channel_id', channelId)
    .maybeSingle()

  if (existing) return { ok: false, error: 'Canal já adicionado' }

  const { error } = await supabase.from('competitor_channels').insert({
    site_id: siteId,
    channel_id: channelId,
    channel_name: channelId,
  })

  if (error) return { ok: false, error: error.message }

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
