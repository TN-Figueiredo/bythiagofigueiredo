'use server'

import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { fetchYtSearchTerms, fetchYtDemographics } from '@/lib/youtube/analytics-client'
import { getChannelTier } from '@/lib/youtube/scoring'
import { scoreForPrompt } from '@/lib/youtube/prompt-scoring'
import type { Grade } from '@/lib/youtube/scoring-types'
import type {
  ContentCalendarData,
  ChannelHealthData,
  VideoOptimizerData,
  PromptChannelInfo,
} from '@/lib/youtube/prompt-types'
import type { YtDemographics } from '@/lib/youtube/analytics-types'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

async function requireReadAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}

function computeSnapshotAgeHours(snapshotAt: string): number {
  const ms = Date.now() - new Date(snapshotAt).getTime()
  if (!Number.isFinite(ms)) return -1
  return Math.round((ms / 3_600_000) * 10) / 10
}

function formatDemographics(demo: YtDemographics): {
  topAge: string
  topCountry: string
  topDevice: string
} {
  let topAge = 'unknown'
  if (demo.ageGender.length > 0) {
    const totals = demo.ageGender.map(g => ({ ageGroup: g.ageGroup, total: g.male + g.female }))
    const grandTotal = totals.reduce((s, g) => s + g.total, 0)
    totals.sort((a, b) => b.total - a.total)
    const top = totals[0]!
    const pct = grandTotal > 0 ? Math.round((top.total / grandTotal) * 100) : 0
    topAge = `${top.ageGroup} (${pct}%)`
  }

  const topCountry =
    demo.countries.length > 0
      ? `${demo.countries[0]!.country} (${demo.countries[0]!.percentage}%)`
      : 'unknown'

  const topDevice =
    demo.devices.length > 0
      ? `${demo.devices[0]!.deviceType} (${demo.devices[0]!.percentage}%)`
      : 'unknown'

  return { topAge, topCountry, topDevice }
}

async function getChannelInfo(
  siteId: string,
  channelId?: string,
): Promise<{ info: PromptChannelInfo; channelDbId: string; lastSyncedAt: string } | null> {
  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('youtube_channels')
    .select('id, name, subscriber_count, video_count, last_synced_at')
    .eq('site_id', siteId)
    .eq('sync_enabled', true)

  if (channelId) query = query.eq('id', channelId)

  const { data, error } = await query.order('subscriber_count', { ascending: false }).limit(1).single()
  if (error && error.code !== 'PGRST116') throw error
  if (!data) return null

  const info: PromptChannelInfo = {
    name: data.name as string,
    subscribers: data.subscriber_count as number,
    videoCount: data.video_count as number,
    tier: getChannelTier(data.subscriber_count as number),
  }

  return {
    info,
    channelDbId: data.id as string,
    lastSyncedAt: (data.last_synced_at as string | null) ?? new Date().toISOString(),
  }
}

export async function fetchContentCalendarData(
  channelId?: string,
): Promise<ActionResult<ContentCalendarData>> {
  try {
    const siteId = await requireReadAccess()
    const channelResult = await getChannelInfo(siteId, channelId)
    if (!channelResult) return { ok: false, error: 'No sync-enabled channel found' }

    const { info, channelDbId, lastSyncedAt } = channelResult
    const supabase = getSupabaseServiceClient()

    const [rawSearchTerms, demographics, videosRes, categoriesRes] = await Promise.all([
      fetchYtSearchTerms(siteId, 28, channelDbId),
      fetchYtDemographics(siteId, 28, channelDbId),
      supabase
        .from('youtube_videos')
        .select('id, title, published_at, category_id, view_count')
        .eq('site_id', siteId)
        .eq('channel_id', channelDbId)
        .eq('is_hidden', false)
        .order('published_at', { ascending: false })
        .limit(5),
      supabase
        .from('youtube_categories')
        .select('id, slug, name_pt, name_en, sort_order')
        .eq('site_id', siteId)
        .order('sort_order'),
    ])

    const truncated = rawSearchTerms.length > 10
    const searchTerms = rawSearchTerms.slice(0, 10)
    const categoryMap = new Map(
      (categoriesRes.data ?? []).map((c: { id: string; slug: string; name_pt: string; name_en: string; sort_order: number }) => [c.id, c]),
    )

    const recentUploads = (videosRes.data ?? []).map(
      (v: { id: string; title: string; published_at: string; category_id: string | null; view_count: number }) => {
        const cat = v.category_id ? categoryMap.get(v.category_id) : null
        return {
          title: v.title as string,
          publishedAt: v.published_at as string,
          categorySlug: cat?.slug ?? '',
        }
      },
    )

    const snapshotAt = lastSyncedAt
    const snapshotAgeHours = computeSnapshotAgeHours(snapshotAt)

    const data: ContentCalendarData = {
      channel: info,
      searchTerms,
      topPerformingCategories: [],
      demographics: formatDemographics(demographics),
      outlierSuccesses: [],
      bestPerformingDay: null,
      bestPerformingHour: null,
      recentUploads,
      snapshotAt,
      snapshotAgeHours,
      truncated,
    }

    return { ok: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unexpected error'
    return { ok: false, error: msg }
  }
}

export async function fetchChannelHealthData(
  channelId?: string,
): Promise<ActionResult<ChannelHealthData>> {
  try {
    const siteId = await requireReadAccess()
    const channelResult = await getChannelInfo(siteId, channelId)
    if (!channelResult) return { ok: false, error: 'No sync-enabled channel found' }

    const { info, channelDbId, lastSyncedAt } = channelResult
    const supabase = getSupabaseServiceClient()

    const [rawSearchTerms, demographics, videosRes] = await Promise.all([
      fetchYtSearchTerms(siteId, 28, channelDbId),
      fetchYtDemographics(siteId, 28, channelDbId),
      supabase
        .from('youtube_videos')
        .select('id, youtube_video_id, title, view_count, avg_view_percentage, ctr')
        .eq('site_id', siteId)
        .eq('channel_id', channelDbId)
        .eq('is_hidden', false)
        .order('view_count', { ascending: false })
        .limit(50),
    ])

    const videos = videosRes.data ?? []

    const gradeDistribution: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0 }
    const scored = videos.map(
      (v: { id: string; youtube_video_id: string; title: string; view_count: number; avg_view_percentage: number | null; ctr: number | null }) => {
        const retention = (v.avg_view_percentage as number | null) ?? 0
        const { score, grade } = scoreForPrompt((v.ctr as number | null) ?? 0, retention)
        gradeDistribution[grade]++
        return {
          id: v.id as string,
          youtubeVideoId: v.youtube_video_id as string,
          title: v.title as string,
          score,
          grade,
          retention,
          trend: 'flat' as const,
        }
      },
    )

    const topVideos = scored.slice(0, 5)
    const bottomVideos = [...scored].sort((a, b) => a.score - b.score).slice(0, 5)
    const truncated = rawSearchTerms.length > 10

    const snapshotAt = lastSyncedAt
    const snapshotAgeHours = computeSnapshotAgeHours(snapshotAt)

    const data: ChannelHealthData = {
      channel: info,
      healthScore: null,
      topVideos,
      bottomVideos,
      gradeDistribution,
      demographics: formatDemographics(demographics),
      searchTerms: rawSearchTerms.slice(0, 10),
      outliers: { positive: [], negative: [] },
      abTestResults: [],
      cyclesSummary: { active: 0, resolved: 0, exhausted: 0 },
      totalVideos: videos.length,
      showingTopN: Math.min(50, videos.length),
      snapshotAt,
      snapshotAgeHours,
      truncated,
    }

    return { ok: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unexpected error'
    return { ok: false, error: msg }
  }
}

export async function fetchVideoOptimizerData(
  videoId: string,
): Promise<ActionResult<VideoOptimizerData>> {
  try {
    const siteId = await requireReadAccess()
    const supabase = getSupabaseServiceClient()

    const { data: video, error: videoError } = await supabase
      .from('youtube_videos')
      .select('id, title, channel_id, view_count, avg_view_percentage, ctr, published_at')
      .eq('id', videoId)
      .eq('site_id', siteId)
      .eq('is_hidden', false)
      .single()

    if (videoError && videoError.code !== 'PGRST116') throw videoError
    if (!video) return { ok: false, error: 'Video not found' }

    const channelResult = await getChannelInfo(siteId, video.channel_id as string)
    if (!channelResult) return { ok: false, error: 'Channel not found' }

    const { info, lastSyncedAt } = channelResult
    const snapshotAt = lastSyncedAt
    const snapshotAgeHours = computeSnapshotAgeHours(snapshotAt)

    const retention = (video.avg_view_percentage as number | null) ?? 0
    const ctr = (video.ctr as number | null) ?? 0
    const { score, grade } = scoreForPrompt(ctr, retention)

    const data: VideoOptimizerData = {
      channel: info,
      grade: {
        score,
        grade,
        axes: [],
        trend: 'flat',
        streak: 0,
      },
      retentionCurve: [],
      trafficSources: { browse: 0, search: 0, suggested: 0, other: 0 },
      optimizationState: 'idle',
      cycleNumber: 0,
      maxCycles: 3,
      cooldownUntil: null,
      previousDiagnosis: null,
      channelBaseline: { medianCtr: 0, medianRetention: 0 },
      snapshotAt,
      snapshotAgeHours,
    }

    return { ok: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unexpected error'
    return { ok: false, error: msg }
  }
}

export interface ChannelOption {
  id: string
  name: string
  locale: string
  handle: string
}

export interface ChannelVideoOption {
  id: string
  youtubeVideoId: string
  title: string
  thumbnailUrl: string | null
  duration: string
  publishedAt: string
  viewCount: number
}

export async function fetchChannels(): Promise<ActionResult<ChannelOption[]>> {
  try {
    const siteId = await requireReadAccess()
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('youtube_channels')
      .select('id, name, locale, handle, subscriber_count')
      .eq('site_id', siteId)
      .eq('sync_enabled', true)
      .order('subscriber_count', { ascending: false })

    if (error) throw error
    return {
      ok: true,
      data: (data ?? []).map(ch => ({
        id: ch.id as string,
        name: ch.name as string,
        locale: (ch.locale as string) ?? 'pt',
        handle: (ch.handle as string) ?? '',
      })),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unexpected error'
    return { ok: false, error: msg }
  }
}

export async function fetchChannelVideos(channelId: string): Promise<ActionResult<ChannelVideoOption[]>> {
  try {
    const siteId = await requireReadAccess()
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('youtube_videos')
      .select('id, youtube_video_id, title, thumbnail_url, duration, published_at, view_count')
      .eq('site_id', siteId)
      .eq('channel_id', channelId)
      .eq('is_hidden', false)
      .order('published_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return {
      ok: true,
      data: (data ?? []).map(v => ({
        id: v.id as string,
        youtubeVideoId: v.youtube_video_id as string,
        title: v.title as string,
        thumbnailUrl: (v.thumbnail_url as string | null) ?? null,
        duration: (v.duration as string) ?? 'PT0S',
        publishedAt: (v.published_at as string) ?? new Date().toISOString(),
        viewCount: (v.view_count as number) ?? 0,
      })),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unexpected error'
    return { ok: false, error: msg }
  }
}

const LogPromptCopySchema = z.object({
  preset: z.enum(['content-calendar', 'channel-health', 'video-optimizer']),
  charCount: z.number().int().min(1).max(15000),
  snapshotAgeHours: z.number().min(0).max(720),
})

export async function logPromptCopy(
  preset: string,
  charCount: number,
  snapshotAgeHours: number,
): Promise<ActionResult<void>> {
  await requireReadAccess()
  const parsed = LogPromptCopySchema.safeParse({ preset, charCount, snapshotAgeHours })
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues.map(i => i.message).join(', ') }
  return { ok: true, data: undefined }
}

const SaveVideoNotesSchema = z.object({
  videoId: z.string().uuid(),
  notes: z.string().max(10000),
  version: z.number().int().min(1),
})

export async function saveVideoNotes(
  videoId: string,
  notes: string,
  version: number,
): Promise<ActionResult<{ version: number }>> {
  const parsed = SaveVideoNotesSchema.safeParse({ videoId, notes, version })
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues.map(i => i.message).join(', ') }

  try {
    const siteId = await requireReadAccess()
    const supabase = getSupabaseServiceClient()

    const { data, error } = await supabase
      .from('youtube_videos')
      .update({
        cms_notes: parsed.data.notes,
        version: parsed.data.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.videoId)
      .eq('site_id', siteId)
      .eq('version', parsed.data.version)
      .select('version')
      .single()

    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: 'conflict: version mismatch' }

    revalidateTag('youtube')
    return { ok: true, data: { version: data.version as number } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unexpected error'
    return { ok: false, error: msg }
  }
}
