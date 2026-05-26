import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import { PipelineOverview } from './_components/pipeline-overview'
import type { CelebrationItem } from './_components/up-next-celebration'
import type { ModeCardItem } from './_components/up-next-mode-cards'
import type { PlaylistStrip } from './_components/up-next-playlist-strips'
import type { ActivityEntry } from './_components/up-next-activity'
import type { WeekDay, WeekSlot } from './_components/up-next-this-week'

export const dynamic = 'force-dynamic'

const FINAL_STAGES = ['published', 'scheduled', 'sent'] as const
const WRITE_STAGES = ['idea', 'outline', 'draft', 'roteiro'] as const
const POST_PROD_STAGES = ['edicao', 'pos_producao', 'review', 'approved', 'ready'] as const

interface PlaylistContext { sort_order: number; playlists: { id: string; name_pt: string } | null }

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
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const [celebrationRes, writeModeRes, recordModeRes, postProdModeRes, playlistsRes, activityRes] = await Promise.all([
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
      .select('id, code, title_pt, format, stage, priority')
      .eq('site_id', siteId)
      .eq('is_archived', false)
      .in('stage', [...WRITE_STAGES])
      .order('priority', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(3),

    supabase
      .from('content_pipeline')
      .select('id, code, title_pt, format, stage, priority')
      .eq('site_id', siteId)
      .eq('is_archived', false)
      .eq('stage', 'gravacao')
      .order('priority', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(3),

    supabase
      .from('content_pipeline')
      .select('id, code, title_pt, format, stage, priority')
      .eq('site_id', siteId)
      .eq('is_archived', false)
      .in('stage', [...POST_PROD_STAGES])
      .order('priority', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(3),

    supabase
      .from('playlists')
      .select('id, name_pt')
      .eq('site_id', siteId)
      .eq('status', 'published'),

    supabase
      .from('content_pipeline_history')
      .select('id, event_type, to_value, changed_at, pipeline_id, content_pipeline(code, format)')
      .eq('content_pipeline.site_id', siteId)
      .order('changed_at', { ascending: false })
      .limit(10),
  ])

  const celebrationItems: CelebrationItem[] = (celebrationRes.data ?? []).map((item) => ({
    id: item.id,
    code: item.code,
    title_pt: item.title_pt,
    format: item.format,
  }))
  const weekCount = celebrationItems.length

  function extractModeItems(data: typeof writeModeRes.data): ModeCardItem[] {
    return (data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      title_pt: row.title_pt,
      format: row.format,
      stage: row.stage,
      priority: row.priority,
      playlistName: null,
      playlistProgress: null,
    }))
  }

  const escreverItems = extractModeItems(writeModeRes.data)
  const gravarItems = extractModeItems(recordModeRes.data)
  const posProducaoItems = extractModeItems(postProdModeRes.data)

  const modeItems = [...escreverItems, ...gravarItems, ...posProducaoItems]
  if (modeItems.length > 0) {
    const playlistContextResults = await Promise.all(
      modeItems.map((item) =>
        supabase
          .from('playlist_items')
          .select('sort_order, playlists(id, name_pt)')
          .eq('pipeline_id', item.id)
          .limit(1)
      )
    )

    const countQueries = await Promise.all(
      modeItems.map(async (item, i) => {
        const result = playlistContextResults[i]
        if (!result) return null
        const ctx = result.data?.[0]
        if (!ctx) return null
        const typed = ctx as unknown as PlaylistContext
        if (!typed.playlists) return null
        const { count } = await supabase
          .from('playlist_items')
          .select('id', { count: 'exact', head: true })
          .eq('playlist_id', typed.playlists.id)
        return { index: i, name: typed.playlists.name_pt, sortOrder: typed.sort_order, total: count ?? 0 }
      })
    )
    for (const result of countQueries) {
      if (!result || result.total === 0) continue
      modeItems[result.index]!.playlistName = result.name
      modeItems[result.index]!.playlistProgress = `${result.sortOrder}/${result.total}`
    }
  }

  const rawPlaylists = playlistsRes.data ?? []
  let playlists: PlaylistStrip[] = []
  let nearCompletionPipelineId: string | null = null

  if (rawPlaylists.length > 0) {
    const playlistItemsResults = await Promise.all(
      rawPlaylists.map((pl) =>
        supabase
          .from('playlist_items')
          .select('id, sort_order, pipeline_id, content_pipeline(id, title_pt, stage)')
          .eq('playlist_id', pl.id)
          .order('sort_order', { ascending: true })
      )
    )

    const finalSet = new Set<string>(FINAL_STAGES)
    const processed = rawPlaylists.map((pl, idx) => {
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
        strip: {
          id: pl.id,
          name: pl.name_pt ?? 'Playlist',
          items: enrichedItems.map(({ stage, isPublished }) => ({ stage, isPublished })),
          nextItemTitle: nextUnpublished?.title_pt ?? null,
          nextItemStage: nextUnpublished?.stage ?? null,
          nearCompletion: unpublishedCount > 0 && unpublishedCount <= 2,
        } satisfies PlaylistStrip,
        nextPipelineId: nextUnpublished?.pipelineId ?? null,
        remaining: unpublishedCount,
      }
    })

    processed.sort((a, b) => a.remaining - b.remaining)
    playlists = processed.map((p) => p.strip)

    const nearCompletion = processed.find((p) => p.strip.nearCompletion)
    if (nearCompletion) nearCompletionPipelineId = nearCompletion.nextPipelineId
  }

  const nearCompletionPlaylist = playlists.find((pl) => pl.nearCompletion)
  let suggestion: { text: string; linkHref: string | null; linkLabel: string | null }

  if (nearCompletionPlaylist) {
    const remaining = nearCompletionPlaylist.items.filter((it) => !it.isPublished).length
    const itemWord = remaining === 1 ? 'item' : 'itens'
    suggestion = {
      text: `Você sabia? ${nearCompletionPlaylist.name} está a ${remaining} ${itemWord} de ser concluída.`,
      linkHref: nearCompletionPipelineId ? `/cms/pipeline/items/${nearCompletionPipelineId}` : null,
      linkLabel: nearCompletionPipelineId ? 'Ver próximo' : null,
    }
  } else if (weekCount > 0) {
    suggestion = {
      text: `${weekCount} ${weekCount === 1 ? 'conteúdo finalizado' : 'conteúdos finalizados'} esta semana. Bom ritmo!`,
      linkHref: null,
      linkLabel: null,
    }
  } else {
    suggestion = {
      text: 'O pipeline está pronto para novas ideias.',
      linkHref: null,
      linkLabel: null,
    }
  }

  const activity: ActivityEntry[] = ((activityRes.data ?? []) as unknown as HistoryRow[])
    .filter((h) => h.content_pipeline)
    .map((h) => ({
      id: h.id,
      code: h.content_pipeline!.code,
      format: h.content_pipeline!.format,
      event_type: h.event_type,
      to_value: h.to_value,
      changed_at: h.changed_at,
    }))

  // --- This Week data ---
  const now = new Date()
  const dayOfWeek = now.getUTCDay() // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + mondayOffset)
  monday.setUTCHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)

  const mondayStr = monday.toISOString().slice(0, 10)
  const sundayStr = sunday.toISOString().slice(0, 10)

  const [ytChannelsRes, scheduledThisWeekRes] = await Promise.all([
    supabase
      .from('youtube_channels')
      .select('id, locale, sync_schedules, sync_enabled')
      .eq('site_id', siteId)
      .eq('sync_enabled', true),
    supabase
      .from('content_pipeline')
      .select('id, title_pt, stage, format, scheduled_at, published_at')
      .eq('site_id', siteId)
      .eq('is_archived', false)
      .eq('format', 'video')
      .in('stage', ['scheduled', 'published'])
      .gte('scheduled_at', `${mondayStr}T00:00:00`)
      .lte('scheduled_at', `${sundayStr}T23:59:59`),
  ])

  const DAY_INDEX: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  }
  const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
  const todayStr = now.toISOString().slice(0, 10)

  const days: WeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)
    const dateKey = d.toISOString().slice(0, 10)
    const dayNum = d.getUTCDay()

    const slots: WeekSlot[] = []

    // Video slots from youtube_channels sync_schedules
    for (const channel of ytChannelsRes.data ?? []) {
      const schedules = (channel.sync_schedules ?? []) as Array<{ day: string; hour?: number }>
      for (const sched of schedules) {
        const schedDay = DAY_INDEX[sched.day?.toLowerCase?.() ?? '']
        if (schedDay !== dayNum) continue

        // Check if there's a pipeline item scheduled for this day
        const matchingItem = (scheduledThisWeekRes.data ?? []).find((item) => {
          const itemDate = (item.scheduled_at as string)?.slice(0, 10)
          return itemDate === dateKey
        })

        slots.push({
          type: 'video',
          channelLocale: channel.locale as string,
          hour: sched.hour as number | undefined,
          filledBy: matchingItem
            ? {
                id: matchingItem.id as string,
                title: (matchingItem.title_pt as string) ?? 'Untitled',
                stage: matchingItem.stage as string,
              }
            : null,
        })
      }
    }

    days.push({
      date: dateKey,
      dayLabel: DAY_LABELS[dayNum]!,
      isToday: dateKey === todayStr,
      isPast: dateKey < todayStr,
      slots,
    })
  }

  // Calculate nextSlotIn
  let nextSlotIn: number | null = null
  for (const day of days) {
    if (day.isPast) continue
    const hasUnfilled = day.slots.some(s => !s.filledBy)
    if (hasUnfilled) {
      const diffMs = new Date(day.date).getTime() - new Date(todayStr).getTime()
      nextSlotIn = Math.round(diffMs / 86_400_000)
      break
    }
  }

  return (
    <>
      <CmsTopbar title="Up Next" />
      <div className="p-6 gem-pipeline-theme" style={GEM_CSS_VARS as React.CSSProperties}>
        <PipelineOverview
          celebration={{ items: celebrationItems }}
          modes={{ escrever: escreverItems, gravar: gravarItems, posProducao: posProducaoItems }}
          playlists={playlists}
          suggestion={suggestion}
          activity={activity}
          thisWeek={{ days, nextSlotIn }}
        />
      </div>
    </>
  )
}
