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
      .limit(1),

    supabase
      .from('content_pipeline')
      .select('id, code, title_pt, format, stage, priority')
      .eq('site_id', siteId)
      .eq('is_archived', false)
      .eq('stage', 'gravacao')
      .order('priority', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1),

    supabase
      .from('content_pipeline')
      .select('id, code, title_pt, format, stage, priority')
      .eq('site_id', siteId)
      .eq('is_archived', false)
      .in('stage', [...POST_PROD_STAGES])
      .order('priority', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1),

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

  function extractModeItem(data: typeof writeModeRes.data): ModeCardItem | null {
    const row = data?.[0]
    if (!row) return null
    return {
      id: row.id,
      code: row.code,
      title_pt: row.title_pt,
      format: row.format,
      stage: row.stage,
      priority: row.priority,
      playlistName: null,
      playlistProgress: null,
    }
  }

  const escrever = extractModeItem(writeModeRes.data)
  const gravar = extractModeItem(recordModeRes.data)
  const posProducao = extractModeItem(postProdModeRes.data)

  const modeItems = [escrever, gravar, posProducao].filter((m): m is ModeCardItem => m !== null)
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

  return (
    <>
      <CmsTopbar title="Up Next" />
      <div className="p-6 gem-pipeline-theme" style={GEM_CSS_VARS as React.CSSProperties}>
        <PipelineOverview
          celebration={{ items: celebrationItems }}
          modes={{ escrever, gravar, posProducao }}
          playlists={playlists}
          suggestion={suggestion}
          activity={activity}
        />
      </div>
    </>
  )
}
