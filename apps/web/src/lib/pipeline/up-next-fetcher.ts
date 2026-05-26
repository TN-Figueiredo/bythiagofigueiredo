import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateTodayActions } from '@/lib/pipeline/calculate-today-actions'
import { calculateStreak } from '@/lib/pipeline/calculate-streak'
import { generateWeekSlots, hydrateWeekSlots } from '@/lib/pipeline/generate-week-slots'
import { selectSuggestion } from '@/lib/pipeline/select-suggestion'
import { STAGE_GROUP } from '@/lib/pipeline/up-next-constants'
import type { Stage } from '@/lib/pipeline/up-next-constants'
import type {
  PipelineItemWithSlot, SyncScheduleWithChannel, BlogCadenceRow,
  NewsletterEditionRow, PlaylistSummary, UpNextApiResponse,
} from '@/lib/pipeline/up-next-types'
import { formatISO, startOfISOWeek, endOfISOWeek, addDays, parseISO } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

/**
 * Shared data-fetching + computation for the Up Next Command Center.
 * Used by both the server page (page.tsx) and the API route (route.ts).
 */
export async function fetchUpNextData(
  supabase: SupabaseClient,
  siteId: string,
  tz: string,
  now: Date,
  maxCards: number,
): Promise<UpNextApiResponse> {
  if (!siteId || typeof siteId !== 'string') {
    throw new Error('[up-next-fetcher] siteId is required')
  }
  const zonedNow = toZonedTime(now, tz)
  const today = formatISO(zonedNow, { representation: 'date' })
  const weekStart = formatISO(startOfISOWeek(zonedNow), { representation: 'date' })
  const weekEnd = formatISO(endOfISOWeek(zonedNow), { representation: 'date' })

  const errors: UpNextApiResponse['errors'] = { today: null, weekSlots: null, streak: null, playlists: null }

  const [itemsRes, channelsRes, cadenceRes, editionsRes, doneRes, blogPostsRes, playlistsRes] = await Promise.all([
    supabase
      .from('content_pipeline')
      .select(`id, title_pt, title_en, stage, priority, format, language, duration_target, scheduled_at, youtube_channel_id,
        playlist_items(playlist_id, sort_order, playlists(id, name_pt, name_en)),
        youtube_channels(name)`)
      .eq('site_id', siteId)
      .not('stage', 'in', '("published","archived")')
      .eq('is_archived', false)
      .order('priority', { ascending: false })
      .limit(200),

    supabase
      .from('youtube_channels')
      .select('id, name, locale, sync_schedules')
      .eq('site_id', siteId)
      .limit(100),

    supabase
      .from('blog_cadence')
      .select('site_id, cadence_days, cadence_start_date, cadence_paused, last_published_at, locale')
      .eq('site_id', siteId)
      .maybeSingle(),

    supabase
      .from('newsletter_editions')
      .select('id, subject, status, scheduled_at')
      .eq('site_id', siteId)
      .gte('scheduled_at', `${weekStart}T00:00:00`)
      .lt('scheduled_at', `${formatISO(addDays(parseISO(weekEnd), 7), { representation: 'date' })}T00:00:00`)
      .in('status', ['draft', 'ready', 'scheduled']),

    supabase
      .from('content_pipeline_history')
      .select('pipeline_id, content_pipeline!inner(site_id)')
      .eq('content_pipeline.site_id', siteId)
      .gte('changed_at', `${today}T00:00:00`)
      .order('changed_at', { ascending: false })
      .limit(200),

    supabase
      .from('blog_posts')
      .select('published_at')
      .eq('site_id', siteId)
      .eq('status', 'published')
      .gte('published_at', new Date(Date.now() - 52 * 7 * 86_400_000).toISOString())
      .limit(1000),

    supabase
      .from('playlists')
      .select('id, name_pt, name_en')
      .eq('site_id', siteId)
      .eq('status', 'published')
      .limit(100),
  ])

  const pipelineItems: PipelineItemWithSlot[] = (itemsRes.data ?? []).map((row: Record<string, unknown>) => {
    const pi = (row.playlist_items as Array<Record<string, unknown>> ?? [])[0]
    const pl = pi?.playlists as Record<string, unknown> | undefined
    const yc = row.youtube_channels as Record<string, string> | null
    return {
      id: row.id as string,
      title: (row.title_pt as string || row.title_en as string) ?? 'Untitled',
      stage: row.stage as Stage,
      priority: (row.priority as number) ?? 0,
      format: row.format as PipelineItemWithSlot['format'],
      language: (row.language as PipelineItemWithSlot['language']) ?? 'pt-br',
      duration_target: row.duration_target as number | null,
      scheduled_at: row.scheduled_at as string | null,
      youtube_channel_id: row.youtube_channel_id as string | null,
      playlist_id: (pi?.playlist_id as string) ?? null,
      playlist_name: (pl?.name_pt as string || pl?.name_en as string) ?? null,
      playlist_position: (pi?.sort_order as number) ?? null,
      playlist_total: null, // TODO: populate from playlist_items count or remove
      channel_label: yc?.name ?? null,
    }
  })

  const syncSchedules: SyncScheduleWithChannel[] = (channelsRes.data ?? []).flatMap(
    (ch: Record<string, unknown>) =>
      ((ch.sync_schedules as Array<Record<string, unknown>>) ?? [])
        .filter(Boolean)
        .map(s => ({
          channel_id: ch.id as string,
          channel_name: ch.name as string,
          locale: ch.locale as 'pt' | 'en',
          schedule: s as unknown as { day: string; hour: number },
          timezone: tz,
        }))
  )

  const blogCadence: BlogCadenceRow | null = cadenceRes.data as BlogCadenceRow | null
  const newsletterEditions: NewsletterEditionRow[] = (editionsRes.data ?? []) as NewsletterEditionRow[]
  const doneToday = new Set((doneRes.data ?? []).map((r: Record<string, unknown>) => r.pipeline_id as string)).size

  let todayResult: UpNextApiResponse['today'] = { actions: [], overflow: 0, doneToday, totalSurfaced: 0, totalEffortMinutes: 0 }
  try {
    todayResult = calculateTodayActions({
      pipelineItems, blogCadence, newsletterEditions, syncSchedules,
      siteTimezone: tz, now, maxCards, doneToday,
    })
  } catch (e) {
    console.error('[up-next-fetcher] today section error:', e instanceof Error ? e.message : 'unknown')
    errors.today = 'computation_failed'
  }

  let weekSlots = [] as UpNextApiResponse['weekSlots']
  try {
    const emptySlots = generateWeekSlots({
      syncSchedules, blogCadence, newsletterEditions,
      weekStart, siteTimezone: tz, today,
    })
    weekSlots = hydrateWeekSlots(emptySlots, pipelineItems)
  } catch (e) {
    console.error('[up-next-fetcher] weekSlots section error:', e instanceof Error ? e.message : 'unknown')
    errors.weekSlots = 'computation_failed'
  }

  let streak: UpNextApiResponse['streak'] = { currentStreak: 0, isActive: false }
  try {
    const pubHistory = (blogPostsRes.data ?? []).map((r: Record<string, unknown>) => r.published_at as string).filter(Boolean)
    streak = calculateStreak({ publishHistory: pubHistory, syncSchedules, blogCadence, siteTimezone: tz, now })
  } catch (e) {
    console.error('[up-next-fetcher] streak section error:', e instanceof Error ? e.message : 'unknown')
    errors.streak = 'computation_failed'
  }

  const stageCounts: Record<string, number> = {}
  for (const [group, stages] of Object.entries(STAGE_GROUP)) {
    stageCounts[group] = pipelineItems.filter(item => stages.includes(item.stage as Stage)).length
  }

  const playlists: PlaylistSummary[] = (playlistsRes.data ?? []).map((pl: Record<string, unknown>) => ({
    id: pl.id as string,
    name: (pl.name_pt as string || pl.name_en as string) ?? 'Playlist',
    total_items: 0,
    done_items: 0,
    in_progress_items: 0,
    next_item_title: null,
    next_item_stage: null,
  }))

  let suggestion: UpNextApiResponse['suggestion'] = null
  try {
    suggestion = selectSuggestion({ pipelineItems, playlists, newsletterEditions })
  } catch (e) {
    console.error('[up-next-fetcher] suggestion section error:', e instanceof Error ? e.message : 'unknown')
  }

  const backlogCount = pipelineItems.filter(item => item.stage === 'idea').length

  return {
    today: todayResult,
    todayDate: today,
    weekSlots,
    streak,
    stageCounts,
    playlists,
    candidates: pipelineItems.map(({ id, title, stage, format, language }) => ({ id, title, stage, format, language })),
    nextWeekEmpty: 0, // TODO: compute from next week's generateWeekSlots or remove
    backlogCount,
    suggestion,
    errors,
  }
}
