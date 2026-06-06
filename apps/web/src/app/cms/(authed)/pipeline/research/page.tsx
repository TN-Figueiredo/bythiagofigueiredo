import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import { ResearchModule } from './_components/research-module'
import type { ResearchFoco, FocoWithRelations, ResearchDecision, ResearchTheme, ThemeId } from '@/lib/pipeline/research-types'

export const dynamic = 'force-dynamic'

export default async function ResearchPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [itemsRes, focosRes, decisionsRes, themesRes, focoThemesRes] = await Promise.all([
    supabase
      .from('research_items')
      .select('id, title, topic_id, theme_id, source, summary, status, word_count, read_min, pinned, takeaways, sources, version, created_at, updated_at')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('research_focos')
      .select('*')
      .eq('site_id', siteId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('research_decisions')
      .select('*')
      .eq('site_id', siteId)
      .neq('status', 'arquivado')
      .order('created_at', { ascending: false }),
    supabase
      .from('research_themes')
      .select('*')
      .eq('site_id', siteId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('research_foco_themes')
      .select('foco_id, theme_id')
      .eq('site_id', siteId),
  ])

  if (itemsRes.error) console.error('[research] items query:', itemsRes.error.message)
  if (focosRes.error) console.error('[research] focos query:', focosRes.error.message)
  if (decisionsRes.error) console.error('[research] decisions query:', decisionsRes.error.message)
  if (themesRes.error) console.error('[research] themes query:', themesRes.error.message)
  if (focoThemesRes.error) console.error('[research] foco_themes query:', focoThemesRes.error.message)

  const items = itemsRes.data ?? []
  const focos = (focosRes.data ?? []) as ResearchFoco[]
  const decisions = (decisionsRes.data ?? []) as ResearchDecision[]
  const themes = (themesRes.data ?? []) as ResearchTheme[]

  // Merge foco ↔ theme junction rows into each foco
  const focoThemeRows = (focoThemesRes.data ?? []) as Array<{ foco_id: string; theme_id: ThemeId }>
  const themesByFoco = new Map<string, ThemeId[]>()
  for (const row of focoThemeRows) {
    const arr = themesByFoco.get(row.foco_id) ?? []
    arr.push(row.theme_id)
    themesByFoco.set(row.foco_id, arr)
  }

  // Query both junction tables in parallel (both depend only on first Promise.all results)
  const focoIds = focos.map(f => f.id)
  const decisionIds = decisions.map(d => d.id)

  const [focoSourcesRes, decisionSourcesRes] = await Promise.all([
    focoIds.length > 0
      ? supabase
          .from('research_foco_sources')
          .select('foco_id, item_id, note')
          .in('foco_id', focoIds)
      : { data: [] as Array<{ foco_id: string; item_id: string; note: string | null }>, error: null },
    decisionIds.length > 0
      ? supabase
          .from('research_decision_sources')
          .select('decision_id, research_id, note')
          .in('decision_id', decisionIds)
      : { data: [] as Array<{ decision_id: string; research_id: string; note: string | null }>, error: null },
  ])

  if (focoSourcesRes.error) console.error('[research] foco_sources query:', focoSourcesRes.error.message)
  if (decisionSourcesRes.error) console.error('[research] decision_sources query:', decisionSourcesRes.error.message)

  // Build map: foco_id -> array of { item_id, note, title }
  type FocoSourceRow = { foco_id: string; item_id: string; note: string | null }
  const focoSourceRows = (focoSourcesRes.data ?? []) as FocoSourceRow[]
  const sourcesByFoco = new Map<string, FocoWithRelations['pinned_research']>()
  for (const src of focoSourceRows) {
    const arr = sourcesByFoco.get(src.foco_id) ?? []
    const item = items.find(i => i.id === src.item_id)
    arr.push({
      item_id: src.item_id,
      note: src.note,
      title: item?.title ?? 'Pesquisa removida',
    })
    sourcesByFoco.set(src.foco_id, arr)
  }

  const focosWithThemes: FocoWithRelations[] = focos.map(f => ({
    ...f,
    themes: themesByFoco.get(f.id) ?? [],
    pinned_research: sourcesByFoco.get(f.id) ?? [],
    decisions: [] as FocoWithRelations['decisions'],
  }))

  // Build lookup: decision_id → backlinks with resolved titles
  const decisionSourcesMap: Record<string, Array<{ research_id: string; research_title: string; note: string | null }>> = {}
  for (const src of (decisionSourcesRes.data ?? []) as Array<{ decision_id: string; research_id: string; note: string | null }>) {
    const arr = decisionSourcesMap[src.decision_id] ?? []
    const item = items.find(i => i.id === src.research_id)
    arr.push({
      research_id: src.research_id,
      research_title: item?.title ?? 'Pesquisa removida',
      note: src.note,
    })
    decisionSourcesMap[src.decision_id] = arr
  }

  const stats = { total: 0, fresca: 0, analise: 0, aplicada: 0, arquivada: 0 }
  for (const item of items) {
    stats.total++
    const status = item.status as keyof typeof stats
    if (status in stats && status !== 'total') stats[status]++
  }

  return (
    <>
      {/* Scroll happens in CmsShell's <main> (overflow-y-auto). This wrapper
          must NOT impose its own fixed height or it clips the module; it only
          provides horizontal padding + comfortable bottom breathing room. */}
      <div className="p-4 pb-14 gem-pipeline-theme" style={{ ...GEM_CSS_VARS } as React.CSSProperties}>
        <ResearchModule
          items={items}
          stats={stats}
          focos={focosWithThemes}
          decisions={decisions}
          themes={themes}
          decisionSources={decisionSourcesMap}
        />
      </div>
    </>
  )
}
