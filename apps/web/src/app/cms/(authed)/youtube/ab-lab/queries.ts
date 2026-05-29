import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'
import type {
  AbTestWithVariants,
  AbTestVariantRow,
  AbTestCycleRow,
  AbTestSiteSettings,
  AbTestResults,
  VariantStats,
  AbTestTrackedLinkRow,
} from '@/lib/youtube/ab-types'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}

// ---------------------------------------------------------------------------
// getAbTestsForSite
// ---------------------------------------------------------------------------

export async function getAbTestsForSite(): Promise<{
  active: AbTestWithVariants[]
  draft: AbTestWithVariants[]
  completed: AbTestWithVariants[]
}> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: tests, error } = await supabase
    .from('ab_tests')
    .select(
      `
      *,
      variants:ab_test_variants!test_id(*),
      cycles:ab_test_cycles(*)
    `,
    )
    .eq('site_id', siteId)
    .not('status', 'eq', 'archived')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  type RawTest = typeof tests extends (infer T)[] | null ? T : never

  function toWithVariants(raw: RawTest): AbTestWithVariants {
    const cycles = ((raw as Record<string, unknown>).cycles ?? []) as AbTestCycleRow[]
    const openCycle = cycles.find(c => !c.ended_at) ?? null
    return {
      ...(raw as AbTestWithVariants),
      variants: ((raw as Record<string, unknown>).variants ?? []) as AbTestVariantRow[],
      current_cycle: openCycle,
      total_cycles: cycles.length,
    }
  }

  const all = (tests ?? []).map(toWithVariants)

  const active = all.filter(t => t.status === 'active')
  const drafts = all.filter(t => t.status === 'draft')
  const completedRaw = all.filter(t => t.status === 'completed' || t.status === 'paused')

  const completedGrouped: AbTestWithVariants[] = []
  const round2Map = new Map<string, AbTestWithVariants>()
  for (const t of completedRaw) {
    if (t.parent_test_id) {
      round2Map.set(t.parent_test_id, t)
    }
  }
  const grouped = new Set<string>()
  for (const t of completedRaw) {
    if (t.parent_test_id) continue
    completedGrouped.push(t)
    grouped.add(t.id)
    const playoff = round2Map.get(t.id)
    if (playoff) {
      completedGrouped.push(playoff)
      grouped.add(playoff.id)
    }
  }
  for (const t of completedRaw) {
    if (!grouped.has(t.id)) completedGrouped.push(t)
  }

  return { active, draft: drafts, completed: completedGrouped }
}

// ---------------------------------------------------------------------------
// getTestResults
// ---------------------------------------------------------------------------

export async function getTestResults(testId: string): Promise<AbTestResults | null> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('*')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (testError || !test) return null

  const { data: variants } = await supabase
    .from('ab_test_variants')
    .select('*')
    .eq('test_id', testId)
    .order('sort_order', { ascending: true })

  const { data: cycles } = await supabase
    .from('ab_test_cycles')
    .select('*')
    .eq('test_id', testId)
    .order('cycle_number', { ascending: true })

  const allVariants = (variants ?? []) as AbTestVariantRow[]
  const allCycles = (cycles ?? []) as AbTestCycleRow[]

  const confirmedCycles = allCycles.filter(
    c => c.ended_at !== null && c.backfill_status === 'confirmed',
  )

  const statsMap = new Map<string, VariantStats>()
  for (const v of allVariants) {
    statsMap.set(v.id, {
      variant_id: v.id,
      label: v.label,
      blob_url: v.blob_url,
      title_text: v.title_text,
      description_text: v.description_text,
      metadata: v.metadata,
      is_original: v.is_original,
      total_impressions: 0,
      total_clicks: 0,
      avg_ctr: 0,
      cycles_completed: 0,
    })
  }

  for (const cycle of confirmedCycles) {
    const stats = statsMap.get(cycle.variant_id)
    if (!stats) continue
    stats.total_impressions += cycle.impressions ?? 0
    stats.total_clicks += cycle.clicks ?? 0
    stats.cycles_completed += 1
  }

  for (const stats of statsMap.values()) {
    stats.avg_ctr =
      stats.total_impressions > 0 ? stats.total_clicks / stats.total_impressions : 0
  }

  const variantStats = Array.from(statsMap.values())

  const hasEnoughData = variantStats.every(
    v => v.total_impressions >= 100 && v.cycles_completed >= 1,
  )

  let confidence = 0
  let suggestedWinnerId: string | null = null
  let isSignificant = false

  if (hasEnoughData && variantStats.length >= 2) {
    const bayesian = calculateBayesianConfidence(variantStats)
    confidence = bayesian.confidence
    suggestedWinnerId = bayesian.winnerId || null
    const config = (test as Record<string, unknown>).config as { confidence_threshold?: number } | null
    const threshold = config?.confidence_threshold ?? 0.95
    isSignificant = confidence >= threshold
  }

  const { data: trackedLinks } = await supabase
    .from('ab_test_tracked_links')
    .select('*')
    .eq('ab_test_id', testId)

  return {
    test: test as AbTestResults['test'],
    variants: variantStats,
    confidence,
    is_significant: isSignificant,
    suggested_winner_id: suggestedWinnerId,
    timeline: allCycles,
    data_freshness: new Date().toISOString(),
    tracked_links: (trackedLinks ?? []) as AbTestTrackedLinkRow[],
  } as AbTestResults
}

// ---------------------------------------------------------------------------
// getAbSiteSettings
// ---------------------------------------------------------------------------

export async function getAbSiteSettings(): Promise<AbTestSiteSettings> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: site } = await supabase
    .from('sites')
    .select('settings')
    .eq('id', siteId)
    .single()

  const settings = (site?.settings as Record<string, unknown> | null) ?? {}
  const abSettings = (settings.ab_test as Partial<AbTestSiteSettings> | null) ?? {}

  return { ...AB_SITE_SETTINGS_DEFAULTS, ...abSettings }
}

// ---------------------------------------------------------------------------
// getEligibleVideosForPicker
// ---------------------------------------------------------------------------

export async function getEligibleVideosForPicker(): Promise<Array<{
  id: string
  title: string
  thumbnailUrl: string | null
  durationSeconds: number
  channelHandle: string
  hasActiveTest: boolean
  previousLift: number | null
  sourcePipelineId: string | null
}>> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: videos } = await supabase
    .from('youtube_videos')
    .select('id, title, thumbnail_url, duration_seconds, youtube_channels!inner(handle)')
    .eq('site_id', siteId)
    .order('published_at', { ascending: false })
    .limit(100)

  if (!videos) return []

  const videoIds = videos.map(v => v.id as string)
  const { data: tests } = await supabase
    .from('ab_tests')
    .select('youtube_video_id, status, result_metadata, source_pipeline_id')
    .eq('site_id', siteId)
    .in('youtube_video_id', videoIds)

  const testMap = new Map<string, { hasActive: boolean; lift: number | null; pipelineId: string | null }>()
  for (const t of (tests ?? [])) {
    const vid = t.youtube_video_id as string
    const existing = testMap.get(vid)
    const isActive = ['draft', 'active', 'paused'].includes(t.status as string)
    const lift = (t.result_metadata as { ctr_lift_percent: number } | null)?.ctr_lift_percent ?? null

    testMap.set(vid, {
      hasActive: existing?.hasActive || isActive,
      lift: lift ?? existing?.lift ?? null,
      pipelineId: (t.source_pipeline_id as string | null) ?? existing?.pipelineId ?? null,
    })
  }

  return videos.map(v => {
    const channel = v.youtube_channels as unknown as { handle: string }
    const testInfo = testMap.get(v.id as string)
    return {
      id: v.id as string,
      title: v.title as string,
      thumbnailUrl: (v.thumbnail_url as string | null) ?? null,
      durationSeconds: (v.duration_seconds as number) ?? 0,
      channelHandle: channel?.handle ?? '',
      hasActiveTest: testInfo?.hasActive ?? false,
      previousLift: testInfo?.lift ?? null,
      sourcePipelineId: testInfo?.pipelineId ?? null,
    }
  })
}

// ---------------------------------------------------------------------------
// getVideoTestHistory
// ---------------------------------------------------------------------------

export async function getVideoTestHistory(youtubeVideoId: string): Promise<Array<{
  id: string
  name: string
  test_type: string
  status: string
  started_at: string | null
  completed_at: string | null
  completed_reason: string | null
  winner_label: string | null
  ctr_lift_percent: number | null
  confidence_at_completion: number | null
}>> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: tests } = await supabase
    .from('ab_tests')
    .select(`
      id, name, test_type, status, started_at, completed_at,
      completed_reason, confidence_at_completion, result_metadata,
      winner:ab_test_variants!winner_variant_id(label)
    `)
    .eq('youtube_video_id', youtubeVideoId)
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })

  return (tests ?? []).map(t => ({
    id: t.id as string,
    name: t.name as string,
    test_type: (t.test_type as string) ?? 'thumbnail',
    status: t.status as string,
    started_at: t.started_at as string | null,
    completed_at: t.completed_at as string | null,
    completed_reason: t.completed_reason as string | null,
    winner_label: ((Array.isArray(t.winner) ? t.winner[0] : t.winner) as { label: string } | null)?.label ?? null,
    ctr_lift_percent: (t.result_metadata as { ctr_lift_percent?: number } | null)?.ctr_lift_percent ?? null,
    confidence_at_completion: t.confidence_at_completion as number | null,
  }))
}
