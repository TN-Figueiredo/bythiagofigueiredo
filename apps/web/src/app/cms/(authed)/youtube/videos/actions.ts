'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}

const UpdateVideoSchema = z.object({
  id: z.string().uuid(),
  title_translation: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  is_featured: z.boolean().optional(),
  is_hidden: z.boolean().optional(),
  cms_notes: z.string().nullable().optional(),
})

export async function updateVideo(
  input: z.infer<typeof UpdateVideoSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = UpdateVideoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map(i => i.message).join(', ') }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('youtube_videos')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('site_id', siteId)

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  revalidateTag('layout-counts')
  revalidatePath('/cms/youtube/videos')
  return { ok: true as const }
}

export async function approveCategory(
  videoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: video } = await supabase
    .from('youtube_videos')
    .select('auto_suggested_category_id')
    .eq('id', videoId)
    .eq('site_id', siteId)
    .single()

  if (!video?.auto_suggested_category_id) {
    return { ok: false as const, error: 'no suggestion' }
  }

  const { error } = await supabase
    .from('youtube_videos')
    .update({
      category_id: video.auto_suggested_category_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoId)
    .eq('site_id', siteId)

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  revalidateTag('layout-counts')
  revalidatePath('/cms/youtube/videos')
  return { ok: true as const }
}

export async function rejectCategory(
  videoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('youtube_videos')
    .update({ auto_suggested_category_id: null, updated_at: new Date().toISOString() })
    .eq('id', videoId)
    .eq('site_id', siteId)

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  revalidateTag('layout-counts')
  revalidatePath('/cms/youtube/videos')
  return { ok: true as const }
}

const syncCooldowns = new Map<string, number>()
const SYNC_COOLDOWN_MS = 60_000

export async function triggerSync(
  channelId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireEditAccess()

  const cooldownKey = channelId ?? 'all'
  const lastSync = syncCooldowns.get(cooldownKey)
  if (lastSync && Date.now() - lastSync < SYNC_COOLDOWN_MS) {
    const remaining = Math.ceil((SYNC_COOLDOWN_MS - (Date.now() - lastSync)) / 1000)
    return { ok: false as const, error: `Aguarde ${remaining}s antes de sincronizar novamente` }
  }

  const cron = process.env.CRON_SECRET
  if (!cron) return { ok: false as const, error: 'CRON_SECRET not set' }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const url = new URL('/api/cron/sync-youtube', baseUrl)
  url.searchParams.set('mode', 'manual')
  if (channelId) url.searchParams.set('channelId', channelId)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 115_000)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cron}` },
    signal: controller.signal,
  })
  clearTimeout(timeout)

  const body = await res.json().catch(() => null)

  if (!res.ok) {
    const detail = body?.error ?? body?.reason ?? body?.message ?? res.statusText
    return { ok: false as const, error: `sync failed (${res.status}): ${detail}` }
  }

  if (channelId && body?.channels?.length === 1) {
    const ch = body.channels[0] as { status?: string; detail?: string }
    if (ch.status === 'failed') {
      return { ok: false as const, error: ch.detail ?? 'sync failed' }
    }
  }

  syncCooldowns.set(cooldownKey, Date.now())
  revalidateTag('youtube')
  revalidateTag('layout-counts')
  revalidatePath('/cms/youtube')
  return { ok: true as const }
}

const pinSchema = z.object({
  videoId: z.string().uuid(),
  channelId: z.string().uuid(),
  durationDays: z.number().int().min(1).max(90),
})

export async function pinWeeklyPick(
  input: z.infer<typeof pinSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = pinSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map(i => i.message).join(', ') }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: video } = await supabase
    .from('youtube_videos')
    .select('id')
    .eq('id', parsed.data.videoId)
    .eq('channel_id', parsed.data.channelId)
    .eq('site_id', siteId)
    .eq('is_hidden', false)
    .single()

  if (!video) return { ok: false, error: 'Video not found or is hidden' }

  const { error } = await supabase.rpc('pin_weekly_pick', {
    p_video_id: parsed.data.videoId,
    p_channel_id: parsed.data.channelId,
    p_site_id: siteId,
    p_duration_days: parsed.data.durationDays,
  })

  if (error) return { ok: false, error: error.message }
  revalidateTag('youtube')
  revalidatePath('/cms/youtube')
  revalidatePath('/cms/youtube/videos')
  return { ok: true }
}

const unpinSchema = z.object({
  channelId: z.string().uuid(),
})

export async function unpinWeeklyPick(
  input: z.infer<typeof unpinSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = unpinSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map(i => i.message).join(', ') }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.rpc('unpin_weekly_pick', {
    p_channel_id: parsed.data.channelId,
    p_site_id: siteId,
  })

  if (error) return { ok: false, error: error.message }
  revalidateTag('youtube')
  revalidatePath('/cms/youtube')
  revalidatePath('/cms/youtube/videos')
  return { ok: true }
}
