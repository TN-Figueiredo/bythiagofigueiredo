'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { YouTubeStrings } from '@/lib/content/types'
import { YOUTUBE_EN } from '@/lib/content/defaults/youtube-en'
import { YOUTUBE_PT } from '@/lib/content/defaults/youtube-pt'

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}

async function requireAdminAccess(): Promise<{ siteId: string; userId: string }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'publish' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return { siteId, userId: res.user.id }
}

const sf = z.string().min(1)

const youtubeStringsSchema = z.object({
  hero_pt_section_label: sf,
  hero_pt_headline: sf,
  hero_pt_description: sf,
  hero_pt_also_on: sf,
  hero_pt_previously: sf,
  hero_en_section_label: sf,
  hero_en_headline_line1: sf,
  hero_en_headline_line2: sf,
  hero_en_description: sf,
  hero_en_previously: sf,
  stats_videos_published: sf,
  stats_hours_of_content: sf,
  stats_comments_answered: sf,
  stats_most_watched: sf,
  feature_section_label: sf,
  feature_headline: sf,
  feature_my_pick: sf,
  feature_also_dropped: sf,
  feature_jump_to_series: sf,
  comments_section_label: sf,
  comments_headline: sf,
  comments_description: sf,
  comments_scroll_annotation: sf,
  comments_relative_today: sf,
  comments_relative_days: sf,
  comments_relative_weeks: sf,
  comments_relative_months: sf,
  comments_relative_years: sf,
  archive_section_label: sf,
  archive_headline: sf,
  archive_search_placeholder: sf,
  archive_search_aria: sf,
  archive_channel_label: sf,
  archive_channel_aria: sf,
  archive_channel_both: sf,
  archive_clear_all: sf,
  archive_series_label: sf,
  archive_series_aria: sf,
  archive_tags_label: sf,
  archive_tags_aria: sf,
  archive_video_singular: sf,
  archive_video_plural: sf,
  archive_filtered: sf,
  archive_newest_first: sf,
  archive_no_videos: sf,
  archive_clear_filters: sf,
  archive_load_more: sf,
  archive_latest: sf,
  card_views: sf,
  channel_subs: sf,
  channel_videos: sf,
  channel_open: sf,
  subscribe_floating_label: sf,
  subscribe_headline: sf,
  subscribe_description: sf,
  subscribe_subs: sf,
  subscribe_button: sf,
  empty_headline: sf,
  empty_description: sf,
  empty_subscribe_button: sf,
}) satisfies z.ZodType<YouTubeStrings>

export async function loadPageContent(
  locale: string,
): Promise<YouTubeStrings> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data } = await supabase
    .from('page_content')
    .select('content')
    .eq('site_id', siteId)
    .eq('page', 'youtube')
    .eq('locale', locale)
    .maybeSingle()

  const defaults = locale === 'pt-BR' ? YOUTUBE_PT : YOUTUBE_EN
  const overrides = (data?.content ?? {}) as Record<string, string>
  return { ...defaults, ...overrides } as YouTubeStrings
}

export async function savePageContent(
  locale: string,
  content: Record<string, string>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = youtubeStringsSchema.safeParse(content)
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
    return { ok: false, error: `Invalid fields: ${missing}` }
  }

  const { siteId, userId } = await requireAdminAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.from('page_content').upsert(
    {
      site_id: siteId,
      page: 'youtube',
      locale,
      content: parsed.data,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: 'site_id,page,locale' },
  )

  if (error) return { ok: false, error: error.message }

  revalidateTag('page-content:youtube')
  revalidatePath('/cms/youtube/content')
  return { ok: true }
}

export async function resetPageContent(
  locale: string,
): Promise<{ ok: true; content: YouTubeStrings } | { ok: false; error: string }> {
  const { siteId, userId } = await requireAdminAccess()
  const defaults = locale === 'pt-BR' ? YOUTUBE_PT : YOUTUBE_EN
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.from('page_content').upsert(
    {
      site_id: siteId,
      page: 'youtube',
      locale,
      content: defaults,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: 'site_id,page,locale' },
  )

  if (error) return { ok: false, error: error.message }

  revalidateTag('page-content:youtube')
  revalidatePath('/cms/youtube/content')
  return { ok: true, content: defaults }
}
