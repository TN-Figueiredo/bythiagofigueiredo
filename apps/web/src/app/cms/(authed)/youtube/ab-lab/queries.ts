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
  TestType,
} from '@/lib/youtube/ab-types'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'
import { computeGates } from '@/lib/youtube/ab-gates'
import { getNextVariantIndex } from '@/lib/youtube/ab-rotation'
import { computeOutlierScore, computeRevenueRange, computeDaysRemaining } from '@/lib/youtube/ab-computed'
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
  paused: AbTestWithVariants[]
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
  const paused = all.filter(t => t.status === 'paused')
  const completedRaw = all.filter(t => t.status === 'completed')

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

  return { active, draft: drafts, completed: completedGrouped, paused }
}

// ---------------------------------------------------------------------------
// getAbDraftById — fetch a single draft test for continuing setup
// ---------------------------------------------------------------------------

export async function getAbDraftById(draftId: string): Promise<{
  id: string
  videoId: string
  videoTitle: string
  thumbnailUrl: string | null
  testType: TestType
  sourcePipelineId: string | null
} | null> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('ab_tests')
    .select('id, youtube_video_id, name, original_thumbnail_url, test_type, source_pipeline_id')
    .eq('id', draftId)
    .eq('site_id', siteId)
    .eq('status', 'draft')
    .single()

  if (error || !data) return null

  return {
    id: data.id as string,
    videoId: data.youtube_video_id as string,
    videoTitle: (data.name as string).replace(/^Test:\s*/i, ''),
    thumbnailUrl: (data.original_thumbnail_url as string) || null,
    testType: data.test_type as TestType,
    sourcePipelineId: (data.source_pipeline_id as string) || null,
  }
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

  // Fetch latest polls for live signal (active/paused tests only)
  let latestPolls: AbTestResults['latestPolls'] = undefined
  if (test.status === 'draft' || test.status === 'active' || test.status === 'paused') {
    const { data: polls } = await supabase
      .from('ab_test_polls')
      .select('variant_id, views, likes, polled_at')
      .eq('test_id', testId)
      .order('polled_at', { ascending: false })
      .limit(10)
    if (polls && polls.length > 0) {
      latestPolls = polls as AbTestResults['latestPolls']
    }
  }

  return {
    test: test as AbTestResults['test'],
    variants: variantStats,
    confidence,
    is_significant: isSignificant,
    suggested_winner_id: suggestedWinnerId,
    timeline: allCycles,
    data_freshness: new Date().toISOString(),
    tracked_links: (trackedLinks ?? []) as AbTestTrackedLinkRow[],
    latestPolls,
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
    name: test.name.replace(/^Test:\s*/i, ''),
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
    statusNote: test.status_note ?? null,
    cycleStartedAt: test.current_cycle?.started_at ?? null,
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
        name: d.name.replace(/^Test:\s*/i, ''),
        type: d.test_type,
        step: d.variants.length,
        thumbUrl: originalVariant?.blob_url ?? d.original_thumbnail_url ?? null,
        createdAt: d.created_at,
        createdAgo: relativeTime(d.created_at),
        videoId: d.youtube_video_id,
        sourcePipelineId: d.source_pipeline_id,
        variants: d.variants.map(v => ({
          label: v.label,
          isOriginal: v.is_original,
          thumbUrl: v.blob_url ?? null,
          titleText: v.title_text ?? '',
          descriptionText: v.description_text ?? '',
        })),
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

  const now = new Date()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Fetch eligible videos: >= 1000 views, published > 14 days ago
  const { data: allVideos } = await supabase
    .from('youtube_videos')
    .select('id, title, thumbnail_url, ctr, view_count, impressions')
    .eq('site_id', siteId)
    .gte('view_count', 1000)
    .lt('published_at', fourteenDaysAgo)
    .order('view_count', { ascending: false })
    .limit(300)

  if (!allVideos || allVideos.length === 0) return []

  // 2. Get video IDs tested in last 60 days
  const { data: recentTests } = await supabase
    .from('ab_tests')
    .select('youtube_video_id')
    .eq('site_id', siteId)
    .gte('created_at', sixtyDaysAgo)

  const recentlyTestedIds = new Set((recentTests ?? []).map(t => t.youtube_video_id as string))

  // 3. Exclude recently-tested videos
  const eligible = allVideos.filter(v => !recentlyTestedIds.has(v.id as string))

  if (eligible.length === 0) return []

  // 4. Compute channel_avg_CTR from videos with CTR > 0 and view_count >= 1000
  const withCtr = eligible.filter(v => (v.ctr as number | null) != null && (v.ctr as number) > 0)
  const channelAvgCtr = withCtr.length > 0
    ? withCtr.reduce((sum, v) => sum + (v.ctr as number), 0) / withCtr.length
    : 0

  // 5. Score each video
  type ScoredVideo = {
    id: string
    title: string
    thumbnailUrl: string | null
    ctr: number
    viewCount: number
    score: number
    hasCtr: boolean
  }

  const scored: ScoredVideo[] = eligible.map(v => {
    const ctr = (v.ctr as number | null) ?? 0
    const viewCount = v.view_count as number
    const hasCtr = ctr > 0 && channelAvgCtr > 0

    // score = views * (1 - CTR / channelAvgCtr)
    // For videos without CTR data, use viewCount as fallback score
    const score = hasCtr
      ? viewCount * (1 - ctr / channelAvgCtr)
      : viewCount

    return {
      id: v.id as string,
      title: v.title as string,
      thumbnailUrl: (v.thumbnail_url as string | null) ?? null,
      ctr,
      viewCount,
      score,
      hasCtr,
    }
  })

  // 6. Boost: underperformers with outlier score (score relative to median < 0.5x)
  const scores = scored.filter(v => v.hasCtr).map(v => v.score)
  const medianScore = scores.length > 0
    ? [...scores].sort((a, b) => a - b)[Math.floor(scores.length / 2)]!
    : 0

  if (medianScore > 0) {
    for (const v of scored) {
      if (v.hasCtr && v.score > medianScore * 2) {
        // Strong underperformer relative to channel — boost priority
        v.score *= 1.2
      }
    }
  }

  // 7. Sort by score DESC, limit 5
  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, 5)

  // 8. Map to SuggestedVideo[] with updated reason text
  return top.map(v => {
    const ratio = channelAvgCtr > 0 && v.hasCtr ? v.ctr / channelAvgCtr : 0
    const belowPercent = Math.round((1 - ratio) * 100)
    const grade: SuggestedVideo['grade'] = !v.hasCtr
      ? 'C'
      : ratio > 0.9 ? 'A' : ratio > 0.7 ? 'B' : ratio > 0.5 ? 'C' : ratio > 0.3 ? 'D' : 'F'

    const reason = v.hasCtr
      ? `Score: ${Math.round(v.score).toLocaleString()} — ${belowPercent}% abaixo da média do canal`
      : `Alto alcance sem teste (${v.viewCount.toLocaleString()} views)`

    return {
      id: v.id,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      ctr: Math.round(v.ctr * 100) / 100,
      channelMedianCtr: Math.round(channelAvgCtr * 100) / 100,
      grade,
      reason,
      suggest: 'thumbnail' as const,
    }
  })
}

// ---------------------------------------------------------------------------
// toDetailView — maps AbTestResults → discriminated AbTestDetailView
// ---------------------------------------------------------------------------

export async function toDetailView(results: AbTestResults): Promise<AbTestDetailView> {
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

  // Build ABBA sequence — merge real cycle data with planned rotation slots.
  // When the timeline has fewer entries than the planned total (e.g. a fresh
  // test with 0 cycles), we fill in the remaining slots using the rotation
  // algorithm so the UI always shows the full planned pattern.
  const variantCount = results.variants.length
  const blockSize = variantCount >= 2 ? 2 * variantCount : 2
  const plannedTotal = Math.max(
    results.timeline.length,
    // At least one full rotation block, rounded up to a full block
    Math.ceil(test.config.max_duration_days / blockSize) * blockSize,
  )

  // Map variant sort order to DisplayLabel for rotation-generated slots
  const sortedVariants = [...results.variants].sort((a, b) => {
    // Original first (index 0 = 'A'), then by label order
    if (a.is_original !== b.is_original) return a.is_original ? -1 : 1
    return a.label.localeCompare(b.label)
  })
  const indexToLabel = (idx: number): DisplayLabel =>
    sortedVariants[idx]
      ? toDisplayLabel(sortedVariants[idx]!.label, sortedVariants[idx]!.is_original)
      : ('A' as DisplayLabel)

  // Real timeline entries keyed by cycle_number
  const timelineByNumber = new Map(
    results.timeline.map(c => [c.cycle_number, c]),
  )

  const abbaSeq: DisplayLabel[] = []
  for (let i = 0; i < plannedTotal; i++) {
    const cycle = timelineByNumber.get(i)
    if (cycle) {
      const v = results.variants.find(rv => rv.variant_id === cycle.variant_id)
      abbaSeq.push(v ? toDisplayLabel(v.label, v.is_original) : ('A' as DisplayLabel))
    } else {
      // Planned slot — use the rotation algorithm
      const idx = getNextVariantIndex(test.config.rotation_pattern, variantCount, i)
      abbaSeq.push(indexToLabel(idx))
    }
  }

  const totalCycles = plannedTotal
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

  // Determine which variant is currently on air from the open cycle
  const openCycle = results.timeline.find(c => !c.ended_at)
  let activeNow: DisplayLabel | null = null
  if (openCycle) {
    const onAirVariant = results.variants.find(v => v.variant_id === openCycle.variant_id)
    if (onAirVariant) activeNow = toDisplayLabel(onAirVariant.label, onAirVariant.is_original)
  }

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
    activeNow,
  }

  // Discriminate by status/outcome
  if (test.status === 'draft' || test.status === 'active' || test.status === 'paused') {
    const leader = variants.length > 0
      ? variants.reduce((best, v) => (v.pBest > best.pBest ? v : best), variants[0]!)
      : { label: 'A' as DisplayLabel, color: '#8A8F98', pBest: 0, ctr: 0 }
    const originalCtr = variants.find(v => v.label === 'A')?.ctr ?? 0

    // Compute live delta from the two most recent polls
    const latestPolls = results.latestPolls
    let liveViewsDelta = 0
    let liveLikesDelta = 0
    let lastPolledAt: string | null = null

    if (latestPolls && latestPolls.length >= 2) {
      lastPolledAt = latestPolls[0]!.polled_at
      // Group by variant, compute delta for each
      const seen = new Set<string>()
      const pairs: Array<{ curr: typeof latestPolls[0]; prev: typeof latestPolls[0] }> = []
      for (const poll of latestPolls) {
        if (seen.has(poll.variant_id)) {
          const curr = latestPolls.find((p: typeof latestPolls[0]) => p.variant_id === poll.variant_id && p !== poll)
          if (curr) pairs.push({ curr, prev: poll })
        }
        seen.add(poll.variant_id)
      }
      for (const { curr, prev } of pairs) {
        liveViewsDelta += (curr!.views - prev!.views)
        liveLikesDelta += (curr!.likes - prev!.likes)
      }
    } else if (latestPolls && latestPolls.length === 1) {
      lastPolledAt = latestPolls[0]!.polled_at
    }

    // Compute outlier, revenue, and days remaining metrics
    const supabase = getSupabaseServiceClient()

    const { data: videoStats } = await supabase
      .from('youtube_videos')
      .select('view_count, published_at, channel_id')
      .eq('id', test.youtube_video_id)
      .single()

    let outlier: AbTestActiveView['outlier'] = undefined
    let revenue: AbTestActiveView['revenue'] = undefined
    let daysRemaining: AbTestActiveView['daysRemaining'] = undefined

    if (videoStats) {
      // Outlier: compare views at same age milestone vs previous 9 uploads
      const ageHours = videoStats.published_at
        ? (Date.now() - new Date(videoStats.published_at).getTime()) / 3_600_000
        : null

      let milestoneColumn: string | null = null
      if (ageHours !== null) {
        if (ageHours >= 720) milestoneColumn = 'views_at_30d'
        else if (ageHours >= 168) milestoneColumn = 'views_at_7d'
        else if (ageHours >= 48) milestoneColumn = 'views_at_48h'
        else if (ageHours >= 24) milestoneColumn = 'views_at_24h'
      }

      if (milestoneColumn) {
        // Get current video's milestone views
        const { data: currentMilestone } = await supabase
          .from('youtube_video_analytics')
          .select(milestoneColumn)
          .eq('youtube_video_id', test.youtube_video_id)
          .not(milestoneColumn, 'is', null)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle()

        const currentViews = (currentMilestone as unknown as Record<string, number> | null)?.[milestoneColumn] ?? videoStats.view_count ?? 0

        // Get predecessors' milestone views
        const { data: milestonePredecessors } = await supabase
          .from('youtube_videos')
          .select(`id, youtube_video_analytics!inner(${milestoneColumn})`)
          .eq('channel_id', videoStats.channel_id)
          .eq('site_id', test.site_id)
          .neq('id', test.youtube_video_id)
          .order('published_at', { ascending: false })
          .limit(9)

        const predecessorViews = (milestonePredecessors as unknown as Array<{ youtube_video_analytics: Record<string, number>[] }> ?? [])
          .map(p => p.youtube_video_analytics?.[0]?.[milestoneColumn!] ?? 0)
          .filter((v: number) => v > 0)

        outlier = computeOutlierScore(currentViews, predecessorViews)
      } else {
        // Fallback to lifetime views if no milestone available yet
        const { data: predecessors } = await supabase
          .from('youtube_videos')
          .select('view_count')
          .eq('channel_id', videoStats.channel_id)
          .eq('site_id', test.site_id)
          .neq('id', test.youtube_video_id)
          .not('view_count', 'is', null)
          .order('published_at', { ascending: false })
          .limit(9)

        outlier = computeOutlierScore(
          videoStats.view_count ?? 0,
          (predecessors ?? []).map(p => p.view_count ?? 0),
        )
      }

      // Revenue: compute from last 28 days of views, annualized
      const { data: recentViews } = await supabase
        .from('youtube_video_analytics')
        .select('views')
        .eq('youtube_video_id', test.youtube_video_id)
        .gte('date', new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10))

      const views28d = (recentViews ?? []).reduce((sum, r) => sum + ((r.views as number) ?? 0), 0)
      revenue = computeRevenueRange(views28d * 13) // annualize: 28d × 13 ≈ 365d

      // Days remaining (from last 5 daily analytics)
      const { data: dailyStats } = await supabase
        .from('youtube_video_analytics')
        .select('views')
        .eq('youtube_video_id', test.youtube_video_id)
        .order('date', { ascending: false })
        .limit(5)

      if (dailyStats && dailyStats.length >= 5) {
        daysRemaining = computeDaysRemaining(dailyStats.map(d => d.views).reverse())
      }
    }

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
      liveData: lastPolledAt ? {
        confidence: results.confidence * 100,
        leader: leader.label,
        leaderColor: leader.color,
        lift: leader.label !== 'A' && originalCtr > 0
          ? ((leader.ctr - originalCtr) / originalCtr) * 100
          : 0,
      } : undefined,
      pollData: lastPolledAt ? {
        viewsDelta: liveViewsDelta,
        likesDelta: liveLikesDelta,
        polledAt: lastPolledAt,
      } : undefined,
      outlier,
      revenue,
      daysRemaining,
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
