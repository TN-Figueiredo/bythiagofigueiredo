import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateTodayActions } from '@/lib/pipeline/calculate-today-actions'
import { calculateStreak } from '@/lib/pipeline/calculate-streak'
import { generateWeekSlots, hydrateWeekSlots } from '@/lib/pipeline/generate-week-slots'
import { selectSuggestion } from '@/lib/pipeline/select-suggestion'
import { scanBufferDepth } from '@/lib/pipeline/scan-buffer-depth'
import { countForwardTransitions } from '@/lib/pipeline/count-forward-transitions'
import { inferCurrentMode } from '@/lib/pipeline/infer-mode'
import { STAGE_GROUP } from '@/lib/pipeline/up-next-constants'
import type { Stage } from '@/lib/pipeline/up-next-constants'
import type {
  PipelineItemWithSlot, SyncScheduleWithChannel, BlogCadenceRow,
  NewsletterEditionRow, PlaylistSummary, UpNextApiResponse,
} from '@/lib/pipeline/up-next-types'
import type { SyncScheduleEntry } from '@/lib/youtube/types'
import { formatISO, addDays, parseISO } from 'date-fns'
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
  const weekStart = today
  const weekEnd = formatISO(addDays(zonedNow, 6), { representation: 'date' })

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
      .eq('sync_enabled', true)
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
      .select('pipeline_id, event_type, from_value, to_value, content_pipeline!inner(site_id)')
      .eq('content_pipeline.site_id', siteId)
      .eq('event_type', 'stage_change')
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
      .select(`id, name_pt, name_en,
        playlist_items(pipeline_id, content_pipeline(stage))`)
      .eq('site_id', siteId)
      .eq('status', 'published')
      .limit(100),
  ])

  const rawItems = (itemsRes.data ?? []).map((row: Record<string, unknown>) => {
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
      playlist_total: null as number | null,
      channel_label: yc?.name ?? null,
    }
  })

  const playlistCounts = new Map<string, number>()
  for (const item of rawItems) {
    if (item.playlist_id) {
      playlistCounts.set(item.playlist_id, (playlistCounts.get(item.playlist_id) ?? 0) + 1)
    }
  }
  const pipelineItems: PipelineItemWithSlot[] = rawItems.map(item => ({
    ...item,
    playlist_total: item.playlist_id ? (playlistCounts.get(item.playlist_id) ?? null) : null,
  }))

  const syncSchedules: SyncScheduleWithChannel[] = (channelsRes.data ?? []).flatMap(
    (ch: Record<string, unknown>) =>
      ((ch.sync_schedules as SyncScheduleEntry[]) ?? [])
        .filter(Boolean)
        .map(s => ({
          channel_id: ch.id as string,
          channel_name: ch.name as string,
          locale: ch.locale as 'pt' | 'en',
          schedule: s,
        }))
  )

  const blogCadence: BlogCadenceRow | null = cadenceRes.data as BlogCadenceRow | null
  const newsletterEditions: NewsletterEditionRow[] = (editionsRes.data ?? []) as NewsletterEditionRow[]
  const doneToday = countForwardTransitions(
    ((doneRes.data ?? []) as Array<Record<string, unknown>>).map(r => ({
      pipeline_id: r.pipeline_id as string,
      event_type: r.event_type as string,
      from_value: r.from_value as string | null,
      to_value: r.to_value as string | null,
    }))
  )

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
    weekSlots = hydrateWeekSlots(emptySlots, pipelineItems, tz)
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

  const modeInference = inferCurrentMode(pipelineItems)

  let playlists: PlaylistSummary[] = []
  try {
    playlists = (playlistsRes.data ?? []).map((pl: Record<string, unknown>) => {
      const plId = pl.id as string
      const playlistItemRows = (pl.playlist_items as Array<Record<string, unknown>>) ?? []
      const totalItems = playlistItemRows.length
      const doneItems = playlistItemRows.filter(pi => {
        const cp = pi.content_pipeline as Record<string, unknown> | null
        const stage = cp?.stage as string | undefined
        return stage === 'published' || stage === 'scheduled'
      }).length
      const inProgressItems = playlistItemRows.filter(pi => {
        const cp = pi.content_pipeline as Record<string, unknown> | null
        const stage = cp?.stage as string | undefined
        return stage !== undefined && stage !== 'idea' && stage !== 'published' && stage !== 'scheduled'
      }).length
      const activeInPipeline = pipelineItems.filter(i => i.playlist_id === plId)
      const nextItem = activeInPipeline
        .filter(i => i.stage !== 'published' && i.stage !== 'scheduled')
        .sort((a, b) => (a.playlist_position ?? 0) - (b.playlist_position ?? 0))[0]
      return {
        id: plId,
        name: (pl.name_pt as string || pl.name_en as string) ?? 'Playlist',
        total_items: totalItems,
        done_items: doneItems,
        in_progress_items: inProgressItems,
        next_item_title: nextItem?.title ?? null,
        next_item_stage: nextItem?.stage ?? null,
      }
    })
  } catch {
    errors.playlists = 'computation_failed'
  }

  let suggestion: UpNextApiResponse['suggestion'] = null
  try {
    suggestion = selectSuggestion({ pipelineItems, playlists, newsletterEditions, stageCounts })
  } catch (e) {
    console.error('[up-next-fetcher] suggestion section error:', e instanceof Error ? e.message : 'unknown')
  }

  const backlogCount = pipelineItems.filter(item => item.stage === 'idea').length

  let nextWeekEmpty = 0
  try {
    const nextWeekStart = formatISO(addDays(zonedNow, 7), { representation: 'date' })
    const nextWeekSlots = generateWeekSlots({
      syncSchedules, blogCadence, newsletterEditions,
      weekStart: nextWeekStart, siteTimezone: tz, today,
    })
    const hydratedNext = hydrateWeekSlots(nextWeekSlots, pipelineItems, tz)
    nextWeekEmpty = hydratedNext.filter(s => !s.assignedItem && !s.isRestDay).length
  } catch {
    // non-critical — keep 0
  }

  // Fetch 16 weeks of newsletter editions for buffer depth scanning
  let bufferNewsletterEditions = newsletterEditions
  try {
    const sixteenWeeksOut = formatISO(addDays(parseISO(today), 112), { representation: 'date' })
    const { data: nlData } = await supabase
      .from('newsletter_editions')
      .select('id, subject, status, scheduled_at')
      .eq('site_id', siteId)
      .gte('scheduled_at', `${today}T00:00:00`)
      .lt('scheduled_at', `${sixteenWeeksOut}T00:00:00`)
      .in('status', ['draft', 'ready', 'scheduled'])
    if (nlData) {
      bufferNewsletterEditions = nlData as NewsletterEditionRow[]
    }
  } catch {
    // non-critical, fall back to the existing narrower list
  }

  let bufferDepth: UpNextApiResponse['bufferDepth'] = null
  try {
    bufferDepth = scanBufferDepth({
      syncSchedules,
      blogCadence,
      newsletterEditions: bufferNewsletterEditions,
      pipelineItems,
      today,
      siteTimezone: tz,
      weeksToScan: 16,
    })
  } catch {
    // non-critical — keep null
  }

  const pins: import('./up-next-types').WorkingTodayPin[] = []

  return {
    today: todayResult,
    todayDate: today,
    weekSlots,
    streak,
    stageCounts,
    playlists,
    candidates: pipelineItems
      .filter(i => i.stage !== 'scheduled' && i.stage !== 'published')
      .map(({ id, title, stage, format, language, playlist_id, playlist_name, playlist_position, playlist_total }) =>
        ({ id, title, stage, format, language, playlist_id, playlist_name, playlist_position, playlist_total })),
    nextWeekEmpty,
    backlogCount,
    suggestion,
    bufferDepth,
    modeInference,
    pins,
    errors,
  }
}
