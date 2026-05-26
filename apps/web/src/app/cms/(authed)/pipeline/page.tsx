import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import { PipelineOverview } from './_components/pipeline-overview'
import { calculateTodayActions } from '@/lib/pipeline/calculate-today-actions'
import { calculateStreak } from '@/lib/pipeline/calculate-streak'
import { generateWeekSlots } from '@/lib/pipeline/generate-week-slots'
import { selectSuggestion } from '@/lib/pipeline/select-suggestion'
import { STAGE_GROUP } from '@/lib/pipeline/up-next-constants'
import type { CelebrationItem } from './_components/up-next-celebration'
import type { PlaylistStrip } from './_components/up-next-playlist-strips'
import type { ActivityEntry } from './_components/up-next-activity'
import type { PipelineItemWithSlot, SyncScheduleWithChannel, BlogCadenceRow, NewsletterEditionRow, PlaylistSummary, UpNextApiResponse } from '@/lib/pipeline/up-next-types'
import type { Stage } from '@/lib/pipeline/up-next-constants'
import { formatISO, startOfISOWeek, endOfISOWeek, addDays, parseISO } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

export const dynamic = 'force-dynamic'

const FINAL_STAGES = ['published', 'scheduled', 'sent'] as const
const SITE_TZ = 'America/Sao_Paulo'

interface PlaylistItemRow {
  id: string
  sort_order: number
  pipeline_id: string | null
  content_pipeline: { id: string; title_pt: string | null; stage: string } | null
}

interface HistoryRow {
  id: string
  event_type: string
  to_value: string | null
  changed_at: string
  pipeline_id: string
  content_pipeline: { code: string; format: string } | null
}

export default async function PipelineOverviewPage() {
  const { siteId } = await getSiteContext()
  const scope = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!scope.ok) { throw new Error('Forbidden') }
  const supabase = getSupabaseServiceClient()

  const now = new Date()
  const zonedNow = toZonedTime(now, SITE_TZ)
  const today = formatISO(zonedNow, { representation: 'date' })
  const weekStart = formatISO(startOfISOWeek(zonedNow), { representation: 'date' })
  const weekEnd = formatISO(endOfISOWeek(zonedNow), { representation: 'date' })
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const [
    celebrationRes, pipelineRes, channelsRes, cadenceRes, editionsRes,
    doneRes, historyRes, playlistsRes, activityRes,
  ] = await Promise.all([
    supabase
      .from('content_pipeline')
      .select('id, code, title_pt, format')
      .eq('site_id', siteId)
      .eq('is_archived', false)
      .in('stage', [...FINAL_STAGES])
      .gte('updated_at', sevenDaysAgo)
      .order('updated_at', { ascending: false })
      .limit(5),

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
      .eq('site_id', siteId),

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
      .gte('published_at', new Date(Date.now() - 52 * 7 * 86_400_000).toISOString()),

    supabase
      .from('playlists')
      .select('id, name_pt')
      .eq('site_id', siteId)
      .eq('status', 'published'),

    supabase
      .from('content_pipeline_history')
      .select('id, event_type, to_value, changed_at, pipeline_id, content_pipeline!inner(code, format, site_id)')
      .eq('content_pipeline.site_id', siteId)
      .order('changed_at', { ascending: false })
      .limit(10),
  ])

  const celebrationItems: CelebrationItem[] = (celebrationRes.data ?? []).map((item) => ({
    id: item.id, code: item.code, title_pt: item.title_pt, format: item.format,
  }))

  const pipelineItems: PipelineItemWithSlot[] = (pipelineRes.data ?? []).map((row: Record<string, unknown>) => {
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
      playlist_total: null,
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
          timezone: SITE_TZ,
        }))
  )

  const blogCadence: BlogCadenceRow | null = cadenceRes.data as BlogCadenceRow | null
  const newsletterEditions: NewsletterEditionRow[] = (editionsRes.data ?? []) as NewsletterEditionRow[]
  const doneToday = new Set((doneRes.data ?? []).map((r: Record<string, string>) => r.pipeline_id)).size

  const todayResult = calculateTodayActions({
    pipelineItems, blogCadence, newsletterEditions, syncSchedules,
    siteTimezone: SITE_TZ, now, maxCards: 5, doneToday,
  })

  const weekSlots = generateWeekSlots({
    syncSchedules, blogCadence, newsletterEditions, pipelineItems,
    weekStart, siteTimezone: SITE_TZ, today,
  })

  const pubHistory = (historyRes.data ?? []).map((r: Record<string, unknown>) => r.published_at as string).filter(Boolean)
  const streak = calculateStreak({ publishHistory: pubHistory, syncSchedules, blogCadence, siteTimezone: SITE_TZ })

  const stageCounts: Record<string, number> = {}
  for (const [group, stages] of Object.entries(STAGE_GROUP)) {
    stageCounts[group] = pipelineItems.filter(item => stages.includes(item.stage as Stage)).length
  }

  const playlistSummaries: PlaylistSummary[] = (playlistsRes.data ?? []).map((pl: Record<string, unknown>) => ({
    id: pl.id as string,
    name: (pl.name_pt as string) ?? 'Playlist',
    total_items: 0, done_items: 0, in_progress_items: 0,
    next_item_title: null, next_item_stage: null,
  }))

  const suggestion = selectSuggestion({ pipelineItems, playlists: playlistSummaries, newsletterEditions })
  const backlogCount = pipelineItems.filter(item => item.stage === 'idea').length

  const fallbackData: UpNextApiResponse = {
    today: todayResult,
    todayDate: today,
    weekSlots,
    streak,
    stageCounts,
    playlists: playlistSummaries,
    nextWeekEmpty: 0,
    backlogCount,
    suggestion,
    errors: { today: null, weekSlots: null, streak: null, playlists: null },
  }

  const rawPlaylists = playlistsRes.data ?? []
  let playlistStrips: PlaylistStrip[] = []

  if (rawPlaylists.length > 0) {
    const playlistItemsResults = await Promise.all(
      rawPlaylists.map((pl: Record<string, unknown>) =>
        supabase
          .from('playlist_items')
          .select('id, sort_order, pipeline_id, content_pipeline(id, title_pt, stage)')
          .eq('playlist_id', pl.id as string)
          .order('sort_order', { ascending: true })
      )
    )

    const finalSet = new Set<string>(FINAL_STAGES)
    playlistStrips = rawPlaylists.map((pl: Record<string, unknown>, idx: number) => {
      const rows = (playlistItemsResults[idx]!.data ?? []) as unknown as PlaylistItemRow[]
      const enrichedItems = rows.map((row) => ({
        stage: row.content_pipeline?.stage ?? null,
        isPublished: row.content_pipeline ? finalSet.has(row.content_pipeline.stage) : false,
        title_pt: row.content_pipeline?.title_pt ?? null,
        pipelineId: row.pipeline_id,
      }))
      const unpublishedCount = enrichedItems.filter((it) => !it.isPublished).length
      const nextUnpublished = enrichedItems.find((it) => !it.isPublished) ?? null

      return {
        id: pl.id as string,
        name: (pl.name_pt as string) ?? 'Playlist',
        items: enrichedItems.map(({ stage, isPublished }) => ({ stage, isPublished })),
        nextItemTitle: nextUnpublished?.title_pt ?? null,
        nextItemStage: nextUnpublished?.stage ?? null,
        nearCompletion: unpublishedCount > 0 && unpublishedCount <= 2,
      } satisfies PlaylistStrip
    })
    playlistStrips.sort((a, b) => {
      const aRemaining = a.items.filter(it => !it.isPublished).length
      const bRemaining = b.items.filter(it => !it.isPublished).length
      return aRemaining - bRemaining
    })
  }

  const activity: ActivityEntry[] = ((activityRes.data ?? []) as unknown as HistoryRow[])
    .filter((h) => h.content_pipeline)
    .map((h) => ({
      id: h.id, code: h.content_pipeline!.code, format: h.content_pipeline!.format,
      event_type: h.event_type, to_value: h.to_value, changed_at: h.changed_at,
    }))

  return (
    <>
      <CmsTopbar title="Up Next" />
      <div className="p-6 gem-pipeline-theme" style={GEM_CSS_VARS as React.CSSProperties}>
        <PipelineOverview
          fallbackData={fallbackData}
          celebration={{ items: celebrationItems }}
          playlists={playlistStrips}
          activity={activity}
        />
      </div>
    </>
  )
}
