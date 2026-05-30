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
  AbTestCardView,
  AbTestDraft,
  AbTestDetailView,
  AbTestActiveView,
  AbTestWinnerView,
  AbTestPlayoffView,
  FullChartVariant,
  VariantThumb,
  DashboardStats,
  DisplayLabel,
  LearningsData,
  LearningsTag,
  SuggestedVideo,
} from '@/lib/youtube/ab-types'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'
import { computeGates } from '@/lib/youtube/ab-gates'
import { toDisplayLabel, variantColor } from './_components/ab-constants'

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

// ---------------------------------------------------------------------------
// Pure computed helpers (Phase 3)
// ---------------------------------------------------------------------------

export function toCardView(test: AbTestWithVariants): AbTestCardView {
  // Build per-variant stats from total impressions * ctr per variant
  // We derive ctr per variant from cycles: avg_ctr = total_clicks / total_impressions
  const statsMap = new Map<string, { impressions: number; clicks: number; ctr: number }>()
  for (const v of test.variants) {
    statsMap.set(v.id, { impressions: 0, clicks: 0, ctr: 0 })
  }

  // Use total_cycles as a proxy — but we don't have cycle data in AbTestWithVariants
  // The leader is determined from winner_variant_id if available, otherwise fall back to original
  const originalVariant = test.variants.find(v => v.is_original) ?? test.variants[0]
  const originalLabel: DisplayLabel = toDisplayLabel(
    originalVariant?.label ?? 'original',
    originalVariant?.is_original ?? true,
  )

  // Determine leader: use winner_variant_id if present, else default to original ('A')
  let leaderVariant = originalVariant
  if (test.winner_variant_id) {
    const winner = test.variants.find(v => v.id === test.winner_variant_id)
    if (winner) leaderVariant = winner
  }

  const leaderLabel: DisplayLabel = toDisplayLabel(
    leaderVariant?.label ?? 'original',
    leaderVariant?.is_original ?? false,
  )
  const leaderIsOriginal = leaderVariant?.is_original ?? false

  // Lift: use result_metadata if available
  const lift = test.result_metadata?.ctr_lift_percent ?? 0

  // dayOf: days since started_at (use completed_at for finished tests)
  const endTime = test.completed_at ? new Date(test.completed_at).getTime() : Date.now()
  const dayOf = test.started_at
    ? Math.floor((endTime - new Date(test.started_at).getTime()) / 86400000)
    : 0

  const confidence = (test.confidence_at_completion ?? 0) * 100

  const variants = test.variants.map(v => ({
    label: toDisplayLabel(v.label, v.is_original),
    color: variantColor(v.label, v.is_original),
    thumbUrl: v.blob_url ?? (v.is_original ? test.original_thumbnail_url : null),
  }))

  const leaderThumbUrl =
    leaderVariant?.blob_url ??
    (leaderIsOriginal ? test.original_thumbnail_url : null) ??
    null

  return {
    id: test.id,
    name: test.name,
    type: test.test_type,
    status: test.status,
    dayOf,
    confidence,
    lift,
    leader: leaderLabel,
    leaderColor: variantColor(leaderVariant?.label ?? 'original', leaderIsOriginal),
    leaderThumbUrl,
    variants,
    hasPlayoff: !!test.playoff_test_id,
    roundNumber: test.round_number,
    createdAt: test.created_at,
  }
}

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  if (diffWeeks < 5) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`
  return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`
}

export function toDraftList(drafts: AbTestWithVariants[]): AbTestDraft[] {
  return [...drafts]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(d => {
      const originalVariant = d.variants.find(v => v.is_original)
      return {
        id: d.id,
        name: d.name,
        type: d.test_type,
        step: d.variants.length,
        thumbUrl: originalVariant?.blob_url ?? d.original_thumbnail_url ?? null,
        createdAt: d.created_at,
        createdAgo: relativeTime(d.created_at),
      }
    })
}

/** @deprecated Use toDraftList instead */
export function toLatestDraft(drafts: AbTestWithVariants[]): AbTestDraft | null {
  const list = toDraftList(drafts)
  return list[0] ?? null
}

export function computeDashboardStats(
  active: AbTestWithVariants[],
  completed: AbTestWithVariants[],
): DashboardStats {
  const activeTests = active.length

  // avgConfidence: from completed tests, exclude nulls
  const confidenceValues = completed
    .map(t => t.confidence_at_completion)
    .filter((v): v is number => v !== null)
  const avgConfidence =
    confidenceValues.length > 0
      ? (confidenceValues.reduce((sum, v) => sum + v, 0) / confidenceValues.length) * 100
      : 0

  // Exclude playoff children (parent_test_id !== null)
  const rootCompleted = completed.filter(t => t.parent_test_id === null)

  // winRate: % of root completed tests with a winner
  const winnerCount = rootCompleted.filter(t => t.winner_variant_id !== null).length
  const winRate =
    rootCompleted.length > 0 ? (winnerCount / rootCompleted.length) * 100 : 0

  // avgLift: from root completed tests with winners
  const liftValues = rootCompleted
    .filter(t => t.winner_variant_id !== null && t.result_metadata !== null)
    .map(t => t.result_metadata!.ctr_lift_percent)
  const avgLift =
    liftValues.length > 0
      ? liftValues.reduce((sum, v) => sum + v, 0) / liftValues.length
      : 0

  return { activeTests, avgConfidence, winRate, avgLift, completedTests: rootCompleted.length, testsWon: winnerCount }
}

// ---------------------------------------------------------------------------
// getLearnings
// ---------------------------------------------------------------------------

export async function getLearnings(siteId: string): Promise<LearningsData | null> {
  const supabase = getSupabaseServiceClient()

  const { data: tests } = await supabase
    .from('ab_tests')
    .select('id, result_metadata, winner_variant_id, test_type')
    .eq('site_id', siteId)
    .eq('status', 'completed')
    .not('winner_variant_id', 'is', null)

  if (!tests || tests.length < 3) return null

  const winnerIds = tests.map(t => t.winner_variant_id as string)
  const { data: winners } = await supabase
    .from('ab_test_variants')
    .select('id, metadata')
    .in('id', winnerIds)

  const tagMap = new Map<string, { wins: number; totalLift: number; kind: 'thumb' | 'title' | 'desc' }>()

  for (const test of tests) {
    const winner = (winners ?? []).find(w => (w.id as string) === (test.winner_variant_id as string))
    if (!winner) continue
    const meta = winner.metadata as Record<string, unknown> | null
    const tags = (meta?.thumbnail_tags as string[]) ?? []
    const lift = ((test.result_metadata as Record<string, unknown> | null)?.ctr_lift_percent as number) ?? 0
    const testType = (test.test_type as string) ?? 'thumbnail'
    const kind = testType === 'title' ? 'title' as const : testType === 'description' ? 'desc' as const : 'thumb' as const

    for (const tag of tags) {
      const existing = tagMap.get(tag) ?? { wins: 0, totalLift: 0, kind }
      existing.wins += 1
      existing.totalLift += lift
      tagMap.set(tag, existing)
    }
  }

  const tags: LearningsTag[] = Array.from(tagMap.entries())
    .map(([tag, data]) => ({
      tag,
      wins: data.wins,
      avgLift: data.wins > 0 ? data.totalLift / data.wins : 0,
      kind: data.kind,
      negative: data.wins > 0 && (data.totalLift / data.wins) < 0 ? true : undefined,
    }))
    .sort((a, b) => b.wins - a.wins)

  const topTag = tags[0]
  const insightText = topTag
    ? `"${topTag.tag}" appears in ${topTag.wins} winners with avg ${topTag.avgLift >= 0 ? '+' : ''}${topTag.avgLift.toFixed(1)}% lift`
    : 'Not enough data for insights'

  return { tags, totalTests: tests.length, insightText }
}

// ---------------------------------------------------------------------------
// getSuggestedVideos
// ---------------------------------------------------------------------------

export async function getSuggestedVideos(siteId: string): Promise<SuggestedVideo[]> {
  const supabase = getSupabaseServiceClient()

  const { data: videos } = await supabase
    .from('youtube_videos')
    .select('id, title, thumbnail_url, ctr, youtube_channels!inner(handle)')
    .eq('site_id', siteId)
    .not('ctr', 'is', null)
    .order('published_at', { ascending: false })
    .limit(200)

  if (!videos || videos.length === 0) return []

  const ctrs = videos.map(v => (v.ctr as number) ?? 0).filter(c => c > 0)
  if (ctrs.length === 0) return []
  const sorted = [...ctrs].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]!

  // Get active test video IDs
  const { data: activeTests } = await supabase
    .from('ab_tests')
    .select('youtube_video_id')
    .eq('site_id', siteId)
    .in('status', ['draft', 'active', 'paused'])

  const activeVideoIds = new Set((activeTests ?? []).map(t => t.youtube_video_id as string))

  const suggestions: SuggestedVideo[] = videos
    .filter(v => {
      const ctr = (v.ctr as number) ?? 0
      return ctr < median && ctr > 0 && !activeVideoIds.has(v.id as string)
    })
    .map(v => {
      const ctr = (v.ctr as number) ?? 0
      const ratio = ctr / median
      const grade = ratio > 0.9 ? 'A' : ratio > 0.7 ? 'B' : ratio > 0.5 ? 'C' : ratio > 0.3 ? 'D' : 'F'
      const belowPercent = Math.round((1 - ratio) * 100)
      return {
        id: v.id as string,
        title: v.title as string,
        thumbnailUrl: (v.thumbnail_url as string | null) ?? null,
        ctr: Math.round(ctr * 100) / 100,
        channelMedianCtr: Math.round(median * 100) / 100,
        grade: grade as SuggestedVideo['grade'],
        reason: `CTR ${belowPercent}% below channel median`,
        suggest: 'thumbnail' as const,
      }
    })
    .sort((a, b) => {
      const gradeOrder = { F: 0, D: 1, C: 2, B: 3, A: 4 }
      return gradeOrder[a.grade] - gradeOrder[b.grade]
    })
    .slice(0, 5)

  return suggestions
}

// ---------------------------------------------------------------------------
// toDetailView — maps AbTestResults → discriminated AbTestDetailView
// ---------------------------------------------------------------------------

export function toDetailView(results: AbTestResults): AbTestDetailView {
  const test = results.test
  const variants: FullChartVariant[] = results.variants.map(v => ({
    label: toDisplayLabel(v.label, v.is_original),
    color: variantColor(v.label, v.is_original),
    ctr: v.avg_ctr * 100,
    impressions: v.total_impressions,
    clicks: v.total_clicks,
    pBest: 0,
    pTop2: 0,
  }))

  // Compute Bayesian probabilities if enough data
  if (results.variants.length >= 2 && results.variants.every(v => v.total_impressions >= 100)) {
    const bayesian = calculateBayesianConfidence(results.variants)
    for (const v of variants) {
      const variantId = results.variants.find(
        rv => toDisplayLabel(rv.label, rv.is_original) === v.label,
      )?.variant_id
      if (variantId && bayesian.probabilities[variantId]) {
        v.pBest = bayesian.probabilities[variantId]!
      }
    }

    // Approximate pTop2 from pBest ranking
    if (variants.length === 2) {
      // Trivially both are in top 2 of 2
      for (const v of variants) v.pTop2 = 1.0
    } else {
      // For 3+ variants, top 2 by pBest get boosted probability, rest get reduced
      const sorted = [...variants].sort((a, b) => b.pBest - a.pBest)
      for (let i = 0; i < sorted.length; i++) {
        sorted[i]!.pTop2 = i < 2
          ? Math.min(1, sorted[i]!.pBest + (1 - sorted[i]!.pBest) * 0.3)
          : sorted[i]!.pBest * 0.5
      }
    }
  }

  const variantThumbs: VariantThumb[] = results.variants.map(v => ({
    label: toDisplayLabel(v.label, v.is_original),
    color: variantColor(v.label, v.is_original),
    thumbUrl: v.blob_url ?? (v.is_original ? test.original_thumbnail_url : null),
    isOriginal: v.is_original,
  }))

  // Build confTrend from progressive cycle confidence
  const confTrend = results.confidence > 0 ? [results.confidence * 100] : []

  // Build daily CTR per variant
  const daily: Record<DisplayLabel, number[]> = {} as Record<DisplayLabel, number[]>
  for (const v of results.variants) {
    const label = toDisplayLabel(v.label, v.is_original)
    daily[label] = []
  }
  const confirmedCycles = results.timeline.filter(
    c => c.ended_at && c.backfill_status === 'confirmed',
  )
  for (const cycle of confirmedCycles) {
    const variant = results.variants.find(v => v.variant_id === cycle.variant_id)
    if (variant) {
      const label = toDisplayLabel(variant.label, variant.is_original)
      if (daily[label]) daily[label]!.push((cycle.ctr ?? 0) * 100)
    }
  }

  // Build ABBA sequence
  const abbaSeq: DisplayLabel[] = [...results.timeline]
    .sort((a, b) => a.cycle_number - b.cycle_number)
    .map(c => {
      const v = results.variants.find(rv => rv.variant_id === c.variant_id)
      return v ? toDisplayLabel(v.label, v.is_original) : ('A' as DisplayLabel)
    })

  const totalCycles = results.timeline.length
  const doneCycles = results.timeline.filter(c => c.ended_at !== null).length

  // Compute gates
  const gateInput = {
    confidence: results.confidence,
    threshold: test.config.confidence_threshold,
    minImpressions: results.variants.map(v => v.total_impressions),
    daysSinceStart: test.started_at
      ? Math.floor((Date.now() - new Date(test.started_at).getTime()) / 86400000)
      : 0,
    confirmedCycles: confirmedCycles.length,
    burnInDays: test.config.burn_in_days,
    variantCount: results.variants.length,
    eligibleCycles: confirmedCycles.length,
    consecutiveConfident: test.consecutive_confident_evals,
    stabilityThreshold: test.config.stability_threshold,
  }
  const gates = computeGates(gateInput)

  const base = {
    id: test.id,
    videoTitle: test.original_title ?? test.name,
    flag: test.test_type,
    status: test.status,
    variants,
    variantThumbs,
    confTrend,
    daily,
    abbaSeq,
    cycles: { total: totalCycles, done: doneCycles },
    durationDays: test.config.max_duration_days,
    confidenceTarget: test.config.confidence_threshold,
    totalRounds: test.round_number,
    hasPlayoff: !!test.playoff_test_id,
    gates,
  }

  // Discriminate by status/outcome
  if (test.status === 'draft' || test.status === 'active' || test.status === 'paused') {
    const leader = variants.length > 0
      ? variants.reduce((best, v) => (v.pBest > best.pBest ? v : best), variants[0]!)
      : { label: 'A' as DisplayLabel, color: '#8A8F98', pBest: 0, ctr: 0 }
    const originalCtr = variants.find(v => v.label === 'A')?.ctr ?? 0
    return {
      ...base,
      status: (test.status === 'draft' ? 'active' : test.status) as 'active' | 'paused',
      confirmedData: {
        confidence: results.confidence * 100,
        leader: leader.label,
        leaderColor: leader.color,
        lift: leader.label !== 'A' && originalCtr > 0
          ? ((leader.ctr - originalCtr) / originalCtr) * 100
          : 0,
      },
    } satisfies AbTestActiveView
  }

  if (test.completed_reason === 'inconclusive' && test.playoff_test_id) {
    const finalistLabels = [...variants].sort((a, b) => b.pTop2 - a.pTop2).slice(0, 2)
    return {
      ...base,
      status: 'completed' as const,
      outcome: 'playoff' as const,
      playoffTestId: test.playoff_test_id,
      startsIn: test.playoff_start_after ?? 'soon',
      finalists: finalistLabels.map(f => ({
        label: f.label,
        color: f.color,
        ctr: f.ctr,
        thumbnailUrl: variantThumbs.find(t => t.label === f.label)?.thumbUrl ?? null,
      })),
      confidenceReached: results.confidence * 100,
      reason: test.status_note ?? 'No clear winner after full duration',
    } satisfies AbTestPlayoffView
  }

  // Guard: completed test with no real winner → treat as inconclusive
  if (!test.winner_variant_id || results.variants.every(v => v.total_impressions === 0)) {
    return {
      ...base,
      status: 'completed' as const,
      outcome: 'playoff' as const,
      playoffTestId: test.playoff_test_id ?? '',
      startsIn: '',
      finalists: [],
      confidenceReached: results.confidence * 100,
      reason: test.status_note ?? 'Teste concluído sem dados suficientes para declarar um vencedor',
    } satisfies AbTestPlayoffView
  }

  // Winner view (default for completed)
  const winnerVariant = test.winner_variant_id
    ? results.variants.find(v => v.variant_id === test.winner_variant_id)
    : null
  const winnerLabel = winnerVariant
    ? toDisplayLabel(winnerVariant.label, winnerVariant.is_original)
    : ('A' as DisplayLabel)
  const winnerColor = winnerVariant
    ? variantColor(winnerVariant.label, winnerVariant.is_original)
    : '#8A8F98'
  const originalVariant = results.variants.find(v => v.is_original)
  const winnerCtr = winnerVariant?.avg_ctr ?? 0
  const originalCtr = originalVariant?.avg_ctr ?? 0
  const lift = originalCtr > 0 ? ((winnerCtr - originalCtr) / originalCtr) * 100 : 0

  return {
    ...base,
    status: 'completed' as const,
    outcome: 'winner' as const,
    winnerLabel,
    winnerColor,
    lift,
    confidence: results.confidence * 100,
    resultMeta: {
      ctrBefore: originalCtr * 100,
      ctrAfter: winnerCtr * 100,
      totalImpressions: results.variants.reduce((sum, v) => sum + v.total_impressions, 0),
      abbaCycles: totalCycles,
      monthlyExtraClicks: test.result_metadata?.estimated_monthly_extra_clicks ?? 0,
    },
    learning: test.status_note ?? undefined,
  } satisfies AbTestWinnerView
}
