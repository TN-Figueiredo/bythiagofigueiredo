import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { AB_SITE_SETTINGS_DEFAULTS, ehVitoriaHumana } from '@/lib/youtube/ab-types'
import type {
  AbTestWithVariants,
  AbTestVariantRow,
  AbTestCycleRow,
  CicloSemEntrega,
  AbTestSiteSettings,
  AbTestResults,
  VariantStats,
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
  ChannelLearningsData,
  SuggestedVideo,
  TestType,
} from '@/lib/youtube/ab-types'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'
import { TIPOS_DE_TESTE } from '@/lib/youtube/ab-schemas'
import { computeGates } from '@/lib/youtube/ab-gates'
import { getNextVariantIndex } from '@/lib/youtube/ab-rotation'
import { computeOutlierScore, computeDaysRemaining } from '@/lib/youtube/ab-computed'
import { toDisplayLabel, variantColor, ordemDesc } from './_components/ab-constants'
import { latestRowPerVideo } from '@/lib/youtube/rolling-window'
import { paraRestoreStatus } from '@/lib/youtube/ab-restore'
import { diaDoTeste, duracaoPrevista } from '@/lib/youtube/ab-dia-do-teste'

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
      cycles:ab_test_cycles(id, test_id, variant_id, cycle_number, started_at, ended_at, backfill_status, backfill_attempts, applied_metadata, created_at)
    `,
    )
    .eq('site_id', siteId)
    .not('status', 'eq', 'archived')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  type RawTest = typeof tests extends (infer T)[] | null ? T : never

  function toWithVariants(raw: RawTest): AbTestWithVariants {
    const cycles = ((raw as Record<string, unknown>).cycles ?? []) as CicloSemEntrega[]
    const openCycle = cycles.find(c => !c.ended_at) ?? null
    return {
      ...(raw as AbTestWithVariants),
      variants: ((raw as Record<string, unknown>).variants ?? []) as AbTestVariantRow[],
      current_cycle: openCycle,
      total_cycles: cycles.length,
    }
  }

  const all = (tests ?? []).map(toWithVariants)

  const active = all.filter(t => t.status === 'active' || t.status === 'queued')
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
    .select('*, youtube_videos(youtube_video_id)')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (testError || !test) return null
  // `ab_tests.youtube_video_id` é a FK (uuid); o id do YouTube vem do join com `youtube_videos`.
  const videoJoin = (test as { youtube_videos?: { youtube_video_id?: string | null } | Array<{ youtube_video_id?: string | null }> | null }).youtube_videos
  const youtubeId = (Array.isArray(videoJoin) ? videoJoin[0] : videoJoin)?.youtube_video_id ?? null

  const { data: variants } = await supabase
    .from('ab_test_variants')
    .select('*')
    .eq('test_id', testId)
    .order('sort_order', { ascending: true })

  const { data: cycles } = await supabase
    .from('ab_test_cycles')
    .select('id, test_id, variant_id, cycle_number, started_at, ended_at, backfill_status, backfill_attempts, applied_metadata, created_at')
    .eq('test_id', testId)
    .order('cycle_number', { ascending: true })

  const allVariants = (variants ?? []) as AbTestVariantRow[]
  const allCycles = (cycles ?? []) as CicloSemEntrega[]

  // Ciclo fechado conta, inclusive o fechado por pausa, drift ou falha (D-P4). Impressões, cliques e CTR dos ciclos
  // vinham de views (ab-backfill) e não são entrega: ficam nulos até a F3 trazer a medição real.
  const closed = allCycles.filter(c => c.ended_at !== null)
  const variantStats: VariantStats[] = allVariants.map(v => ({
    variant_id: v.id,
    label: v.label,
    blob_url: v.blob_url,
    title_text: v.title_text,
    dimensions: v.dimensions,
    metadata: v.metadata,
    is_original: v.is_original,
    total_impressions: null,
    total_clicks: null,
    avg_ctr: null,
    cycles_completed: closed.filter(c => c.variant_id === v.id).length,
  }))

  let confidence: number | null = null
  let suggestedWinnerId: string | null = null
  let isSignificant = false

  if (temVolumeParaBayes(variantStats) && variantStats.length >= 2) {
    const bayesian = calculateBayesianConfidence(variantStats)
    if (bayesian.estado === 'calculado') {
      confidence = bayesian.confidence
      suggestedWinnerId = bayesian.winnerId || null
      const config = (test as Record<string, unknown>).config as { confidence_threshold?: number } | null
      const threshold = config?.confidence_threshold ?? 0.95
      isSignificant = confidence >= threshold
    }
  }

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
    latestPolls,
    youtubeId,
  } satisfies AbTestResults
}

/** Bayes só com todas as variantes medidas (impressões e cliques não nulos), >= 100 impressões e 1 ciclo fechado. */
export function temVolumeParaBayes(variants: readonly VariantStats[]): boolean {
  return variants.every(v =>
    v.total_impressions !== null && v.total_clicks !== null &&
    v.total_impressions >= 100 && v.cycles_completed >= 1,
  )
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
    const isActive = ['draft', 'active', 'paused', 'queued'].includes(t.status as string)
    // P2: lift gravado pelo avaliador automático não aparece mais em tela nenhuma.
    const lift: number | null = null

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
      completed_reason,
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
    // S8-F2: derivados de views/views, sem escritor desde a P2; não saem mais para a tela.
    ctr_lift_percent: null,
    confidence_at_completion: null,
  }))
}

// ---------------------------------------------------------------------------
// Pure computed helpers (Phase 3)
// ---------------------------------------------------------------------------

export function toCardView(test: AbTestWithVariants): AbTestCardView {
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

  // P2: lift e confiança gravados vieram do avaliador automático, que foi desligado.
  // Nenhuma tela os mostra (o banco não é tocado); o card cai na frase fixa.
  const lift: number | null = null

  // dayOf: dias corridos desde started_at (completed_at nos encerrados); conta única em ab-dia-do-teste
  const dayOf = diaDoTeste(test.started_at, test.completed_at, new Date()) ?? 0

  const confidence: number | null = null

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
    durationDays: duracaoPrevista(test.config),
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
    queueStartAfter: test.queue_start_after ?? null,
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

  // Mesma regra do pipeline (E10): só raiz (sem filho de playoff); conta quando uma pessoa (ou o limite de
  // duração) encerrou; o veredito da máquina (auto_resolve) e razão desconhecida ficam fora do numerador e
  // do denominador. Sem teste que conte, winRate é null, nunca 0. Confiança e lift médios saíram (eram
  // calculados sobre views, sem medição de entrega).
  const rootCompleted = completed.filter(t => t.parent_test_id === null)
  const contam = rootCompleted.filter(t => t.completed_reason !== null && t.completed_reason !== 'auto_resolve')
  const testsWon = contam.filter(t => ehVitoriaHumana(t)).length
  const winRate = contam.length > 0 ? (testsWon / contam.length) * 100 : null

  return { activeTests, winRate, completedTests: rootCompleted.length, winRateBase: contam.length, testsWon }
}

// ---------------------------------------------------------------------------
// aggregateTags (shared helper for learnings)
// ---------------------------------------------------------------------------

interface TestForLearning {
  winner_variant_id: string | null
  result_metadata: unknown
  test_type?: string | null
}

function wilsonScore(wins: number, total: number, z = 1.96): number {
  if (total === 0) return 0
  const p = wins / total
  const denom = 1 + (z * z) / total
  const center = p + (z * z) / (2 * total)
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)
  return (center - spread) / denom
}

export function aggregateTags(
  winners: Array<{ id: unknown; metadata: unknown }>,
  tests: TestForLearning[],
  allVariants?: Array<{ id: unknown; metadata: unknown }>,
): LearningsTag[] {
  const tagMap = new Map<string, { wins: number; total: number; totalLift: number; liftMedidos: number; kind: 'thumb' | 'title' }>()

  // Count wins (tag appeared on the winning variant)
  for (const test of tests) {
    const winner = winners.find(w => (w.id as string) === (test.winner_variant_id as string))
    if (!winner) continue
    const meta = winner.metadata as Record<string, unknown> | null
    const tags = (meta?.thumbnail_tags as string[]) ?? []
    // S8-F2: o lift guardado (views/views) não chega mais à tela nem ao briefing; nulo = não medido.
    const lift: number | null = null
    const testType = (test.test_type as string | undefined) ?? 'thumbnail'
    if (!(TIPOS_DE_TESTE as readonly string[]).includes(testType)) continue
    const kind = testType === 'title' ? 'title' as const : 'thumb' as const

    for (const tag of tags) {
      const existing = tagMap.get(tag) ?? { wins: 0, total: 0, totalLift: 0, liftMedidos: 0, kind }
      existing.wins += 1
      if (lift !== null) {
        existing.totalLift += lift
        existing.liftMedidos += 1
      }
      tagMap.set(tag, existing)
    }
  }

  // Count total appearances (tag appeared on ANY variant in a completed test)
  if (allVariants) {
    // Build a set of test_ids from our tests (the completed ones with winners)
    const testVariantIds = new Set<string>()
    for (const v of allVariants) testVariantIds.add(v.id as string)

    for (const variant of allVariants) {
      const meta = variant.metadata as Record<string, unknown> | null
      const tags = (meta?.thumbnail_tags as string[]) ?? []
      for (const tag of tags) {
        const existing = tagMap.get(tag)
        if (existing) existing.total += 1
      }
    }
  } else {
    // Fallback: total = wins (all appearances were on winners)
    for (const entry of tagMap.values()) {
      entry.total = entry.wins
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, data]) => ({
      tag,
      wins: data.wins,
      total: data.total,
      confidence: wilsonScore(data.wins, data.total),
      avgLift: data.liftMedidos > 0 ? data.totalLift / data.liftMedidos : null,
      kind: data.kind,
      negative: data.liftMedidos > 0 && (data.totalLift / data.liftMedidos) < 0 ? true : undefined,
    }))
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
}

function buildInsightText(tags: LearningsTag[]): string {
  if (!tags.length) return 'Not enough data for insights'
  const positive = tags.filter(t => !t.negative).slice(0, 3)
  const negative = tags.filter(t => t.negative).slice(0, 2)

  const parts: string[] = []
  if (positive.length) {
    parts.push(`Padrões que funcionam: ${positive.map(t => `"${t.tag}" (${t.wins}×)`).join(', ')}`)
  }
  if (negative.length) {
    parts.push(`Evitar: ${negative.map(t => `"${t.tag}" (${t.avgLift === null ? 'lift não medido' : `${Math.abs(Math.round(t.avgLift))}% queda`})`).join(', ')}`)
  }
  return parts.join('. ') || 'Not enough data for insights'
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

  const testIds = tests.map(t => t.id as string)
  const winnerIds = tests.map(t => t.winner_variant_id as string)

  const { data: winners } = await supabase
    .from('ab_test_variants')
    .select('id, metadata')
    .in('id', winnerIds)

  // Fetch all variants for total count (tag appeared on ANY variant)
  const { data: allVariants } = await supabase
    .from('ab_test_variants')
    .select('id, metadata')
    .in('test_id', testIds)

  const tags = aggregateTags(winners ?? [], tests, allVariants ?? undefined)
  return { tags, totalTests: tests.length, insightText: buildInsightText(tags) }
}

// ---------------------------------------------------------------------------
// getChannelLearnings
// ---------------------------------------------------------------------------

export async function getChannelLearnings(siteId: string): Promise<ChannelLearningsData | null> {
  const supabase = getSupabaseServiceClient()

  // Get all completed tests with winner, including channel info
  const { data: tests } = await supabase
    .from('ab_tests')
    .select('id, youtube_video_id, result_metadata, winner_variant_id, test_type, youtube_videos!inner(channel_id)')
    .eq('site_id', siteId)
    .eq('status', 'completed')
    .not('winner_variant_id', 'is', null)

  if (!tests?.length || tests.length < 3) {
    return null
  }

  // Group tests by channel
  const byChannel = new Map<string, typeof tests>()
  for (const test of tests) {
    const channelId = (test as Record<string, unknown>).youtube_videos
      ? ((test as Record<string, unknown>).youtube_videos as Record<string, unknown>)?.channel_id as string | undefined
      : undefined
    if (!channelId) continue
    const group = byChannel.get(channelId) ?? []
    group.push(test)
    byChannel.set(channelId, group)
  }

  // Get channel names
  const channelIds = [...byChannel.keys()]
  const { data: channels } = await supabase
    .from('youtube_channels')
    .select('id, name')
    .in('id', channelIds)

  const channelNameMap = new Map((channels ?? []).map(c => [c.id as string, (c.name as string | null) ?? 'Canal']))

  // Get all winner variants in one query
  const allWinnerIds = tests.map(t => t.winner_variant_id as string)
  const { data: allWinners } = await supabase
    .from('ab_test_variants')
    .select('id, metadata')
    .in('id', allWinnerIds)

  // Fetch ALL variants for total count
  const allTestIds = tests.map(t => t.id as string)
  const { data: everyVariant } = await supabase
    .from('ab_test_variants')
    .select('id, test_id, metadata')
    .in('test_id', allTestIds)

  // Compute learnings per channel (only channels with 3+ tests)
  const channelLearnings: ChannelLearningsData['channels'] = []

  for (const [channelId, channelTests] of byChannel) {
    if (channelTests.length < 3) continue

    const channelTestIds = new Set(channelTests.map(t => t.id as string))
    const channelWinnerIds = new Set(channelTests.map(t => t.winner_variant_id as string))
    const channelWinners = (allWinners ?? []).filter(w => channelWinnerIds.has(w.id as string))
    const channelAllVariants = (everyVariant ?? []).filter(v => channelTestIds.has(v.test_id as string))
    const tags = aggregateTags(channelWinners, channelTests, channelAllVariants)

    channelLearnings.push({
      channelId,
      channelName: channelNameMap.get(channelId) ?? 'Canal',
      learnings: {
        tags,
        totalTests: channelTests.length,
        insightText: buildInsightText(tags),
      },
    })
  }

  // Combined learnings from all tests
  const combinedTags = aggregateTags(allWinners ?? [], tests, everyVariant ?? undefined)
  const combined: LearningsData = {
    tags: combinedTags,
    totalTests: tests.length,
    insightText: buildInsightText(combinedTags),
  }

  return { channels: channelLearnings, combined }
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

  // 3b. Fetch latest grades from video_grade_history (6-axis scoring)
  const eligibleIds = eligible.map(v => v.id as string)
  const { data: latestGrades } = await supabase
    .from('video_grade_history')
    .select('youtube_video_id, grade, score, ctr, retention, reach, engagement, week_iso')
    .eq('site_id', siteId)
    .in('youtube_video_id', eligibleIds)
    .order('recorded_at', { ascending: false })

  const gradeMap = new Map<string, { grade: SuggestedVideo['grade']; score: number; ctr: number | null }>()
  for (const g of latestGrades ?? []) {
    const vid = g.youtube_video_id as string
    if (!gradeMap.has(vid)) {
      gradeMap.set(vid, {
        grade: g.grade as SuggestedVideo['grade'],
        score: Number(g.score),
        ctr: g.ctr != null ? Number(g.ctr) : null,
      })
    }
  }

  // 4. Compute channel average using rolling 28-day window from analytics
  const twentyEightDaysAgo = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10)
  const { data: recentAnalytics } = await supabase
    .from('youtube_video_analytics')
    .select('youtube_video_id, date, views')
    .eq('site_id', siteId)
    .gte('date', twentyEightDaysAgo)

  // Window total per video = the value on its most recent row. Accumulating
  // `+= row.views` across dates re-counted the same views once per sync (17x on
  // production data), inflating the channel average every video is judged against.
  const viewsLast28d = new Map<string, number>()
  for (const [videoId, row] of latestRowPerVideo(
    (recentAnalytics ?? []) as Array<{ youtube_video_id: string; date: string; views: number }>,
  )) {
    viewsLast28d.set(videoId, row.views)
  }

  // channelAvgViews28d = average across videos with data
  const videosWithRecentData = [...viewsLast28d.values()]
  const channelAvgViews28d = videosWithRecentData.length > 0
    ? videosWithRecentData.reduce((s, v) => s + v, 0) / videosWithRecentData.length
    : 1

  // Keep legacy CTR avg for grade display
  const withCtr = eligible.filter(v => (v.ctr as number | null) != null && (v.ctr as number) > 0)
  const channelAvgCtr = withCtr.length > 0
    ? withCtr.reduce((sum, v) => sum + (v.ctr as number), 0) / withCtr.length
    : 0

  // 5. Score each video using 28d rolling window
  type ScoredVideo = {
    id: string
    title: string
    thumbnailUrl: string | null
    ctr: number
    viewCount: number
    impressions: number | null
    score: number
    hasCtr: boolean
    reason: string
  }

  const scored: ScoredVideo[] = eligible.map(v => {
    const ctr = (v.ctr as number | null) ?? 0
    const viewCount = v.view_count as number
    const videoViews28d = viewsLast28d.get(v.id as string) ?? 0
    const ratio = channelAvgViews28d > 0 ? videoViews28d / channelAvgViews28d : 1

    // Use grade-based scoring when available, fall back to crude formula
    const gradeData = gradeMap.get(v.id as string)
    const gradePenalty = gradeData
      ? (gradeData.grade === 'D' ? 3 : gradeData.grade === 'C' ? 2 : gradeData.grade === 'B' ? 1 : 0.5)
      : 1
    const score = viewCount * gradePenalty * Math.max(1 - ratio, 0.1)

    return {
      id: v.id as string,
      title: v.title as string,
      thumbnailUrl: (v.thumbnail_url as string | null) ?? null,
      ctr,
      viewCount,
      impressions: (v.impressions as number | null) ?? null,
      score,
      hasCtr: ctr > 0 && channelAvgCtr > 0,
      reason: '',
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

  // 8. Map to SuggestedVideo[]: nota (grade) do vídeo e texto do motivo (score + queda abaixo da média do canal, ou alcance sem teste)
  return top.map(v => {
    const ratio = channelAvgCtr > 0 && v.hasCtr ? v.ctr / channelAvgCtr : 0
    const belowPercent = Math.round((1 - ratio) * 100)
    const grade: SuggestedVideo['grade'] = gradeMap.get(v.id)?.grade
      ?? (!v.hasCtr ? 'C' : ratio > 0.9 ? 'A' : ratio > 0.7 ? 'B' : ratio > 0.5 ? 'C' : ratio > 0.3 ? 'D' : 'F')

    const baseReason = v.hasCtr
      ? `Score: ${Math.round(v.score).toLocaleString('pt-BR')} — ${belowPercent}% abaixo da média do canal`
      : `Alto alcance sem teste (${v.viewCount.toLocaleString('pt-BR')} views)`
    const reason = v.reason ? `${v.reason} — ${baseReason}` : baseReason

    return {
      id: v.id,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      ctr: Math.round(v.ctr * 100) / 100,
      channelMedianCtr: Math.round(channelAvgCtr * 100) / 100,
      impressions: v.impressions,
      grade,
      reason,
      suggest: 'thumbnail' as const,
    }
  })
}

// ---------------------------------------------------------------------------
// toDetailView — maps AbTestResults → discriminated AbTestDetailView
// ---------------------------------------------------------------------------

/** Soma; nulo se a lista é vazia ou se algum item é nulo (nulo = não medido, nunca 0). */
function somaOuNulo(xs: ReadonlyArray<number | null>): number | null {
  if (xs.length === 0 || xs.some(x => x === null)) return null
  return xs.reduce<number>((a, x) => a + (x ?? 0), 0)
}

export async function toDetailView(results: AbTestResults): Promise<AbTestDetailView> {
  const test = results.test
  const variants: FullChartVariant[] = results.variants.map(v => ({
    label: toDisplayLabel(v.label, v.is_original),
    color: variantColor(v.label, v.is_original),
    ctr: v.avg_ctr,
    impressions: v.total_impressions,
    clicks: v.total_clicks,
    pBest: null,
  }))

  // Compute Bayesian probabilities if enough data
  if (results.variants.length >= 2 && temVolumeParaBayes(results.variants)) {
    const bayesian = calculateBayesianConfidence(results.variants)
    if (bayesian.estado === 'calculado') {
      for (const v of variants) {
        const variantId = results.variants.find(
          rv => toDisplayLabel(rv.label, rv.is_original) === v.label,
        )?.variant_id
        const p = variantId === undefined ? undefined : bayesian.probabilities[variantId]
        if (p !== undefined) v.pBest = p
      }
    }
  }

  const variantThumbs: VariantThumb[] = results.variants.map(v => ({
    label: toDisplayLabel(v.label, v.is_original),
    color: variantColor(v.label, v.is_original),
    thumbUrl: v.blob_url ?? (v.is_original ? test.original_thumbnail_url : null),
    isOriginal: v.is_original,
    titleText: v.title_text,
  }))

  // Build confTrend from progressive cycle confidence
  const confTrend = results.confidence !== null && results.confidence > 0 ? [results.confidence * 100] : []

  // Build daily CTR per variant
  const daily: Record<DisplayLabel, number[]> = {} as Record<DisplayLabel, number[]>
  for (const v of results.variants) {
    const label = toDisplayLabel(v.label, v.is_original)
    daily[label] = []
  }
  const closed = results.timeline.filter(c => c.ended_at !== null)

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
    confirmedCycles: closed.length,
    burnInDays: test.config.burn_in_days,
    variantCount: results.variants.length,
    eligibleCycles: closed.length,
    consecutiveConfident: results.confidence === null ? null : test.consecutive_confident_evals,
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

  const variantDb: import('@/lib/youtube/ab-types').VariantDbEntry[] = results.variants.map(v => ({
    id: v.variant_id,
    label: toDisplayLabel(v.label, v.is_original),
    is_original: v.is_original,
    blob_url: v.blob_url ?? (v.is_original ? test.original_thumbnail_url : null),
    title_text: v.is_original ? (v.title_text ?? test.original_title ?? null) : v.title_text,
    dimensions: v.dimensions ?? null,
  }))

  // Variante do último ciclo fechado: a que estava no ar quando o teste saiu (rótulo da faixa de restauração).
  const ultimoFechado = results.timeline.filter(c => c.ended_at !== null).sort((a, b) => b.cycle_number - a.cycle_number)[0]
  const varNoAr = ultimoFechado ? results.variants.find(v => v.variant_id === ultimoFechado.variant_id) : undefined
  const noArAntes = ultimoFechado && varNoAr
    ? { label: toDisplayLabel(varNoAr.label, varNoAr.is_original), desde: ultimoFechado.started_at ?? null }
    : null

  const base = {
    id: test.id,
    videoTitle: test.original_title ?? test.name,
    flag: test.test_type,
    status: test.status,
    variants,
    variantThumbs,
    variantDb,
    confTrend,
    daily,
    abbaSeq,
    cycles: { total: totalCycles, done: doneCycles },
    dayOf: diaDoTeste(test.started_at, test.completed_at, new Date()) ?? 0,
    durationDays: duracaoPrevista(test.config),
    confidenceTarget: test.config.confidence_threshold,
    totalRounds: test.round_number,
    hasPlayoff: !!test.playoff_test_id,
    gates,
    activeNow,
    createdAt: test.created_at,
    restoreStatus: paraRestoreStatus(test.restore_status),
    restoreSeq: test.restore_seq ?? 0,
    youtubeVideoId: results.youtubeId ?? null,
    noArAntes,
    noArAgora: openCycle && activeNow ? { label: activeNow, desde: openCycle.started_at ?? null } : null,
  }

  // Discriminate by status/outcome
  if (test.status === 'draft' || test.status === 'active' || test.status === 'paused') {
    const comPBest = variants.filter((v): v is typeof v & { pBest: number } => v.pBest !== null)
    const leader: { label: DisplayLabel; color: string; ctr: number | null } = comPBest.length > 0
      ? comPBest.reduce((best, v) => (v.pBest > best.pBest ? v : best), comPBest[0]!)
      : (variants.find(v => v.label === 'A') ?? variants[0] ?? { label: 'A' as DisplayLabel, color: '#8A8F98', ctr: null })
    const originalCtr: number | null = variants.find(v => v.label === 'A')?.ctr ?? null
    const liftDoLider: number | null = leader.label !== 'A' && leader.ctr !== null && originalCtr !== null && originalCtr > 0
      ? ((leader.ctr - originalCtr) / originalCtr) * 100
      : null

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

      // Days remaining stays unknown. `computeDaysRemaining` fits a DECAY curve
      // to a series of daily view counts; `youtube_video_analytics` holds
      // overlapping rolling-window totals, which decay only when a busier day
      // falls off the back of the window. Feeding it those rows produced a
      // near-flat series, so it answered `{ days: 999 }` — rendered as "~∞" —
      // for every test, every time. That is a claim, not a measurement. The
      // view already has an empty state for `undefined`, so it shows that
      // instead until a true daily series exists.
    }

    return {
      ...base,
      status: (test.status === 'draft' ? 'active' : test.status) as 'active' | 'paused',
      confirmedData: {
        confidence: results.confidence === null ? null : results.confidence * 100,
        leader: leader.label,
        leaderColor: leader.color,
        lift: liftDoLider,
      },
      liveData: lastPolledAt ? {
        confidence: results.confidence === null ? null : results.confidence * 100,
        leader: leader.label,
        leaderColor: leader.color,
        lift: liftDoLider,
      } : undefined,
      pollData: lastPolledAt ? {
        viewsDelta: liveViewsDelta,
        likesDelta: liveLikesDelta,
        polledAt: lastPolledAt,
      } : undefined,
      outlier,
      daysRemaining,
      statusNote: test.status_note ?? null,
      driftAcknowledgedAt: test.drift_acknowledged_at ?? null,
      variantDb,
      graceExpiresAt: test.grace_expires_at,
      winnerAppliedAt: test.winner_applied_at,
    } satisfies AbTestActiveView
  }

  if (test.completed_reason === 'inconclusive' && test.playoff_test_id) {
    const finalistLabels = [...variants].sort((a, b) => ordemDesc(a.pBest, b.pBest)).slice(0, 2)
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
      confidenceReached: null,
      reason: test.status_note ?? 'No clear winner after full duration',
    } satisfies AbTestPlayoffView
  }

  // Guard: completed test with no real winner → treat as inconclusive
  if (!test.winner_variant_id || (!ehVitoriaHumana(test) && results.variants.every(v => v.total_impressions === null || v.total_impressions === 0))) {
    return {
      ...base,
      status: 'completed' as const,
      outcome: 'playoff' as const,
      playoffTestId: test.playoff_test_id ?? '',
      startsIn: '',
      finalists: [],
      confidenceReached: null,
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
  const winnerCtr: number | null = winnerVariant?.avg_ctr ?? null
  const originalCtr: number | null = originalVariant?.avg_ctr ?? null
  const lift: number | null = winnerCtr !== null && originalCtr !== null && originalCtr > 0
    ? ((winnerCtr - originalCtr) / originalCtr) * 100
    : null

  return {
    ...base,
    status: 'completed' as const,
    outcome: 'winner' as const,
    winnerLabel,
    winnerColor,
    lift,
    // A confiança calculada sobre views não é medição de entrega: a tela mostra a frase fixa.
    confidence: null,
    resultMeta: {
      ctrBefore: originalCtr === null ? null : originalCtr * 100,
      ctrAfter: winnerCtr === null ? null : winnerCtr * 100,
      totalImpressions: somaOuNulo(results.variants.map(v => v.total_impressions)),
      abbaCycles: totalCycles,
      // A estimativa guardada vinha de views, sem medição de entrega: a tela mostra a frase fixa.
      monthlyExtraClicks: null,
    },
    learning: test.status_note ?? undefined,
    revertExpiresAt: test.revert_expires_at,
    winnerAppliedAt: test.winner_applied_at,
  } satisfies AbTestWinnerView
}
