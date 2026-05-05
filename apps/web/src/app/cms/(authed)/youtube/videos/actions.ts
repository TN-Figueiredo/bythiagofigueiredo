'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
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
  const siteId = await requireEditAccess()
  const parsed = UpdateVideoSchema.parse(input)
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('youtube_videos')
    .update({ ...parsed, updated_at: new Date().toISOString() })
    .eq('id', parsed.id)
    .eq('site_id', siteId)

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
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
  return { ok: true as const }
}

export async function triggerSync(
  _channelId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireEditAccess()
  const cron = process.env.CRON_SECRET
  if (!cron) return { ok: false as const, error: 'CRON_SECRET not set' }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/cron/sync-youtube?mode=manual`, {
    headers: { Authorization: `Bearer ${cron}` },
  })

  if (!res.ok) return { ok: false as const, error: `sync failed: ${res.status}` }
  revalidateTag('youtube')
  return { ok: true as const }
}

const pinSchema = z.object({
  videoId: z.string().uuid(),
  channelId: z.string().uuid(),
  durationDays: z.number().int().min(1).max(30),
})

export async function pinWeeklyPick(
  input: z.infer<typeof pinSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = pinSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map(i => i.message).join(', ') }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  await supabase
    .from('youtube_videos')
    .update({ pinned_until: null, updated_at: new Date().toISOString() })
    .eq('channel_id', parsed.data.channelId)
    .eq('site_id', siteId)
    .gt('pinned_until', new Date().toISOString())

  const pinnedUntil = new Date()
  pinnedUntil.setDate(pinnedUntil.getDate() + parsed.data.durationDays)

  const { error } = await supabase
    .from('youtube_videos')
    .update({ pinned_until: pinnedUntil.toISOString(), updated_at: new Date().toISOString() })
    .eq('id', parsed.data.videoId)
    .eq('channel_id', parsed.data.channelId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  revalidateTag('youtube')
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

  const { error } = await supabase
    .from('youtube_videos')
    .update({ pinned_until: null, updated_at: new Date().toISOString() })
    .eq('channel_id', parsed.data.channelId)
    .eq('site_id', siteId)
    .gt('pinned_until', new Date().toISOString())

  if (error) return { ok: false, error: error.message }
  revalidateTag('youtube')
  return { ok: true }
}
