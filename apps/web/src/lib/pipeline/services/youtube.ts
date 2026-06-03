import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { getIsoWeek } from '@/lib/youtube/analytics-sync'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { PatchPayloadSchema } from '@/lib/youtube/intelligence-schemas'
import { BatchVariantUpsertSchema, TestTypeSchema } from '@/lib/youtube/ab-schemas'
import { scoreVideo, computeBaseline, computeTrend, assignGrade } from '@/lib/youtube/scoring'
import type { BaselineVideoInput } from '@/lib/youtube/scoring'
import { fetchYtDemographics, fetchYtSearchTerms } from '@/lib/youtube/analytics-client'
import type { VideoScoreInput, TrafficSources, TrendData } from '@/lib/youtube/scoring-types'
import type { TestType, VariantMetadata } from '@/lib/youtube/ab-types'
import type { ServiceContext, ServiceResult } from './types'
import { ok, err } from './types'

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_LABELS = new Set(['B', 'C', 'D'])

// ---------------------------------------------------------------------------
// Types — Intelligence
// ---------------------------------------------------------------------------

export interface ChannelSummary {
  id: string
  channel_id: string
  name: string
  subscriber_count: number | null
}

export interface VideoSnapshot {
  id: string
  video_id: string
  title: string
  thumbnail_url: string | null
  published_at: string
  view_count: number | null
  ctr: number | null
  impressions: number | null
  avg_view_percentage: number | null
  retention_curve: unknown
  traffic_sources: unknown
}

export interface GradeHistoryRow {
  youtube_video_id: string
  grade: string
  score: number
  ctr: number
  retention: number
  reach: number
  engagement: number
  growth: number
  sub_impact: number
  week_iso: string
}

export interface IntelSnapshot {
  channel: ChannelSummary
  videos: VideoSnapshot[]
  grade_history: GradeHistoryRow[]
  optimization_cycles: Record<string, unknown>[]
  ab_tests: Record<string, unknown>[]
  intelligence: Record<string, unknown>[]
}

export type IntelRecommendations = z.infer<typeof PatchPayloadSchema>

export interface TaskResult {
  status: 'ok'
  processed: boolean
}

export interface IntelTask {
  id: string
  site_id: string
  channel_id: string
  trigger_type: string
  requested_at: string
}

// ---------------------------------------------------------------------------
// Types — A/B Tests
// ---------------------------------------------------------------------------

export interface AbTestFilters {
  status?: string | null
}

export interface AbTestListItem {
  id: string
  site_id: string
  youtube_video_id: string
  source_pipeline_id: string | null
  name: string
  status: string
  test_type: string
  config: Record<string, unknown>
  winner_variant_id: string | null
  completed_reason: string | null
  created_at: string
  updated_at: string
  variants: Array<{
    id: string
    label: string
    is_original: boolean
    blob_url: string | null
    title_text: string | null
    description_text: string | null
    metadata: VariantMetadata
    sort_order: number
  }>
}

export interface AbTestDetail {
  id: string
  [key: string]: unknown
  variants: Record<string, unknown>[]
  cycles: Record<string, unknown>[]
  tracked_links: Record<string, unknown>[]
}

export interface PerVariantFunnel {
  variant_id: string
  impressions: number
  clicks: number
  link_clicks: number
}

export interface PerLinkFunnel {
  template_name: string
  variant_id: string
  short_code: string
  clicks: number
}

export interface FunnelMetrics {
  per_variant: PerVariantFunnel[]
  per_link: PerLinkFunnel[]
}

interface WinnerVariant {
  id: string
  label: string
  title_text: string | null
  description_text: string | null
  metadata: {
    title_pattern?: string
    thumbnail_tags?: string[]
    emotional_triggers?: string[]
    visual_description?: string
  }
}

export interface PerformancePatterns {
  completed_tests: number
  winning_patterns: Record<string, number>
  winning_tags: Record<string, { wins: number; tests: number }>
}

// ---------------------------------------------------------------------------
// Types — Variants
// ---------------------------------------------------------------------------

export interface VariantRow {
  id: string
  test_id: string
  label: string
  is_original: boolean
  blob_url: string | null
  blob_key: string | null
  file_size_bytes: number | null
  dimensions: string | null
  title_text: string | null
  description_text: string | null
  metadata: VariantMetadata
  sort_order: number
  created_at: string
}

export type VariantInput = z.infer<typeof BatchVariantUpsertSchema>['variants'][number]

export interface UpsertResult {
  results: Array<{ label: string; ok: boolean; id: string }>
  summary: { total: number; succeeded: number; failed: number }
}

export interface DeleteResult {
  deleted: boolean
  label: string
}

// ---------------------------------------------------------------------------
// Intelligence — GET snapshot
// ---------------------------------------------------------------------------

/** Fetch channel analytics snapshot with videos, grades, cycles, tests and intelligence. */
export async function getIntelligenceSnapshot(
  ctx: ServiceContext,
  channelId: string,
): Promise<ServiceResult<IntelSnapshot>> {
  const { supabase, siteId } = ctx

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('id, channel_id, name, subscriber_count')
    .eq('id', channelId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return err('NOT_FOUND', 'Channel not found', 404)

  const [videosRes, gradesRes, cyclesRes, abTestsRes, intelligenceRes] = await Promise.all([
    supabase
      .from('youtube_videos')
      .select('id, youtube_video_id, title, thumbnail_url, published_at, view_count, ctr, impressions, avg_view_percentage, avg_view_duration_seconds, retention_curve, traffic_sources')
      .eq('channel_id', channel.id)
      .order('published_at', { ascending: false })
      .limit(50),
    supabase
      .from('video_grade_history')
      .select('youtube_video_id, grade, score, ctr, retention, reach, engagement, growth, sub_impact, week_iso')
      .eq('site_id', siteId)
      .order('week_iso', { ascending: false })
      .limit(200),
    supabase
      .from('optimization_cycles')
      .select('*')
      .eq('site_id', siteId)
      .not('state', 'in', '("resolved","exhausted")'),
    supabase
      .from('ab_tests')
      .select('id, youtube_video_id, name, status, test_type, winner_variant_id, completed_reason, config')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('youtube_intelligence')
      .select('*')
      .eq('channel_id', channel.id)
      .order('generated_at', { ascending: false })
      .limit(50),
  ])

  const response: IntelSnapshot = {
    channel: {
      id: channel.id,
      channel_id: channel.channel_id,
      name: channel.name,
      subscriber_count: channel.subscriber_count,
    },
    videos: (videosRes.data ?? []).map(v => ({
      id: v.id,
      video_id: v.youtube_video_id,
      title: v.title,
      thumbnail_url: v.thumbnail_url,
      published_at: v.published_at,
      view_count: v.view_count,
      ctr: v.ctr,
      impressions: v.impressions,
      avg_view_percentage: v.avg_view_percentage,
      retention_curve: v.retention_curve,
      traffic_sources: v.traffic_sources,
    })),
    grade_history: gradesRes.data ?? [],
    optimization_cycles: cyclesRes.data ?? [],
    ab_tests: abTestsRes.data ?? [],
    intelligence: intelligenceRes.data ?? [],
  }

  return ok(response)
}

// ---------------------------------------------------------------------------
// Intelligence — PATCH recommendations
// ---------------------------------------------------------------------------

/** Submit Cowork intelligence recommendations, coaching, and notifications for a running task. */
export async function submitIntelRecommendations(
  ctx: ServiceContext,
  data: IntelRecommendations,
): Promise<ServiceResult<TaskResult>> {
  const { supabase, siteId } = ctx
  const { task_id, video_recommendations, coaching, notifications, channel_insights } = data

  // Validate task
  const { data: task } = await supabase
    .from('youtube_intelligence_tasks')
    .select('id, channel_id, status')
    .eq('id', task_id)
    .eq('site_id', siteId)
    .single()

  if (!task) return err('NOT_FOUND', 'Task not found', 404)
  if (task.status !== 'running') {
    return err('VERSION_CONFLICT', `Task status is '${task.status}', expected 'running'`, 409)
  }

  // Track DB write failures for partial-failure reporting
  const dbErrors: string[] = []

  // Process video recommendations
  if (video_recommendations?.length) {
    const videoIds = video_recommendations.map(r => r.video_id)
    const { data: existing } = await supabase
      .from('youtube_videos')
      .select('id')
      .eq('channel_id', task.channel_id)
      .in('id', videoIds)

    const existingIds = new Set((existing ?? []).map(v => v.id))
    const missing = videoIds.filter(id => !existingIds.has(id))
    if (missing.length > 0) {
      return err(
        'VALIDATION_ERROR',
        `Referential integrity check failed: videos not found: ${missing.join(', ')}`,
        422,
      )
    }

    for (const rec of video_recommendations) {
      const { data: existingIntel } = await supabase
        .from('youtube_intelligence')
        .select('id')
        .eq('site_id', siteId)
        .eq('channel_id', task.channel_id)
        .eq('video_id', rec.video_id)
        .eq('source', 'cowork')
        .maybeSingle()

      const intelPayload = {
        site_id: siteId,
        channel_id: task.channel_id,
        video_id: rec.video_id,
        type: 'video' as const,
        recommendations: rec,
        source: 'cowork',
        generated_at: new Date().toISOString(),
      }

      if (existingIntel) {
        const { error } = await supabase.from('youtube_intelligence').update(intelPayload).eq('id', existingIntel.id)
        if (error) {
          Sentry.captureMessage(`intelligence update failed: ${error.message}`, { extra: { videoId: rec.video_id } })
          dbErrors.push(`video ${rec.video_id}: ${error.message}`)
        }
      } else {
        const { error } = await supabase.from('youtube_intelligence').insert(intelPayload)
        if (error) {
          Sentry.captureMessage(`intelligence insert failed: ${error.message}`, { extra: { videoId: rec.video_id } })
          dbErrors.push(`video ${rec.video_id}: ${error.message}`)
        }
      }

      // Advance optimization cycle from flagged to diagnosed
      const { data: cycle } = await supabase
        .from('optimization_cycles')
        .select('id, state')
        .eq('youtube_video_id', rec.video_id)
        .eq('site_id', siteId)
        .eq('state', 'flagged')
        .single()

      if (cycle) {
        await supabase.from('optimization_cycles').update({
          state: 'diagnosed',
          diagnosed_at: new Date().toISOString(),
          diagnosis_summary: rec.reasoning,
        }).eq('id', cycle.id)
      }
    }
  }

  // Process channel-level coaching/insights
  if (coaching || channel_insights) {
    const { data: existingChannel } = await supabase
      .from('youtube_intelligence')
      .select('id')
      .eq('site_id', siteId)
      .eq('channel_id', task.channel_id)
      .is('video_id', null)
      .eq('source', 'cowork')
      .maybeSingle()

    const channelPayload = {
      site_id: siteId,
      channel_id: task.channel_id,
      video_id: null,
      type: 'channel' as const,
      coaching: coaching ?? null,
      patterns_detected: channel_insights?.patterns_detected ?? null,
      analysis_text: channel_insights?.analysis_text ?? null,
      source: 'cowork',
      generated_at: new Date().toISOString(),
    }

    if (existingChannel) {
      const { error } = await supabase.from('youtube_intelligence').update(channelPayload).eq('id', existingChannel.id)
      if (error) {
        Sentry.captureMessage(`channel intelligence update failed: ${error.message}`)
        dbErrors.push(`channel coaching: ${error.message}`)
      }
    } else {
      const { error } = await supabase.from('youtube_intelligence').insert(channelPayload)
      if (error) {
        Sentry.captureMessage(`channel intelligence insert failed: ${error.message}`)
        dbErrors.push(`channel coaching: ${error.message}`)
      }
    }
  }

  // Process notifications with dedup
  if (notifications?.length) {
    const weekIso = getIsoWeek(new Date())
    for (const n of notifications) {
      const dedupKey = `cowork:${n.type}:${n.video_id ?? 'channel'}:${weekIso}`
      await fanOutToSiteAdmins({
        siteId,
        domain: 'youtube',
        type: `youtube.${n.type}`,
        priority: n.priority,
        title: n.title,
        message: n.message,
        dedupKey,
        payload: {
          ...(n.video_id ? { videoId: n.video_id } : {}),
        },
      })
    }
  }

  // Mark task status based on whether all writes succeeded
  const finalStatus = dbErrors.length > 0 ? 'partial_failure' : 'completed'
  await supabase.from('youtube_intelligence_tasks').update({
    status: finalStatus,
    completed_at: new Date().toISOString(),
    result_summary: {
      recommendations: video_recommendations?.length ?? 0,
      has_coaching: !!coaching,
      ...(dbErrors.length > 0 && { failed_writes: dbErrors.length }),
    },
  }).eq('id', task_id)

  const result: ServiceResult<TaskResult> = ok({ status: 'ok' as const, processed: true })
  if (dbErrors.length > 0) {
    result.warnings = dbErrors
  }
  return result
}

// ---------------------------------------------------------------------------
// Intelligence — GET claim next task
// ---------------------------------------------------------------------------

/** Claim the next pending intelligence task via optimistic CAS. Returns null if none available. */
export async function claimNextTask(
  ctx: ServiceContext,
  statusFilter?: string,
): Promise<ServiceResult<IntelTask | null>> {
  const { supabase, siteId } = ctx
  const status = statusFilter ?? 'pending'

  const { data: task } = await supabase
    .from('youtube_intelligence_tasks')
    .select('id, site_id, channel_id, trigger_type, requested_at')
    .eq('site_id', siteId)
    .eq('status', status)
    .order('requested_at', { ascending: true })
    .limit(1)
    .single()

  if (!task) return ok(null)

  // Optimistic CAS: only claim if still in the expected status
  const { data: claimed } = await supabase
    .from('youtube_intelligence_tasks')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .eq('id', task.id)
    .eq('status', status)
    .select('id')
    .maybeSingle()

  if (!claimed) return ok(null)

  return ok(task as IntelTask)
}

// ---------------------------------------------------------------------------
// A/B Tests — list
// ---------------------------------------------------------------------------

/** List A/B tests for the site, optionally filtered by status. */
export async function listAbTests(
  ctx: ServiceContext,
  filters: AbTestFilters,
): Promise<ServiceResult<AbTestListItem[]>> {
  const { supabase, siteId } = ctx

  let query = supabase
    .from('ab_tests')
    .select(`
      *,
      variants:ab_test_variants!test_id(id, label, is_original, blob_url, title_text, description_text, metadata, sort_order)
    `)
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) return err('DB_ERROR', 'Failed to load tests', 500)

  return ok((data ?? []) as AbTestListItem[])
}

// ---------------------------------------------------------------------------
// A/B Tests — get detail
// ---------------------------------------------------------------------------

/** Get a single A/B test with variants, cycles, and tracked links. */
export async function getAbTest(
  ctx: ServiceContext,
  id: string,
): Promise<ServiceResult<AbTestDetail>> {
  const { supabase, siteId } = ctx

  const { data: test, error } = await supabase
    .from('ab_tests')
    .select(`
      *,
      variants:ab_test_variants!test_id(*),
      cycles:ab_test_cycles!test_id(*),
      tracked_links:ab_test_tracked_links!ab_test_id(*)
    `)
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (error || !test) return err('NOT_FOUND', 'Test not found', 404)

  return ok(test as AbTestDetail)
}

// ---------------------------------------------------------------------------
// A/B Tests — funnel metrics
// ---------------------------------------------------------------------------

interface TrackedLink {
  id: string
  ab_test_id: string
  variant_id: string
  link_id: string
  template_name: string
  short_code: string
  created_at: string
  link: { id: string; code: string; destination_url: string }
}

interface CycleRow {
  variant_id: string
  impressions: number | null
  clicks: number | null
}

/** Compute funnel metrics (impressions -> clicks -> link clicks) for an A/B test. */
export async function getAbTestFunnel(
  ctx: ServiceContext,
  id: string,
): Promise<ServiceResult<FunnelMetrics>> {
  const { supabase, siteId } = ctx

  // Verify test belongs to site
  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (!test) return err('NOT_FOUND', 'Test not found', 404)

  // Fetch tracked links and cycles in parallel
  const [trackedLinksRes, cyclesRes] = await Promise.all([
    supabase
      .from('ab_test_tracked_links')
      .select(`
        *,
        link:tracked_links!link_id(id, code, destination_url)
      `)
      .eq('ab_test_id', id),
    supabase
      .from('ab_test_cycles')
      .select('variant_id, impressions, clicks')
      .eq('test_id', id)
      .not('impressions', 'is', null),
  ])

  const trackedLinks = trackedLinksRes.data as TrackedLink[] | null
  const cycles = cyclesRes.data as CycleRow[] | null

  // Aggregate cycle impressions/clicks per variant
  const variantImpressions: Record<string, { impressions: number; clicks: number }> = {}
  for (const c of cycles ?? []) {
    const v = variantImpressions[c.variant_id] ?? { impressions: 0, clicks: 0 }
    v.impressions += c.impressions ?? 0
    v.clicks += c.clicks ?? 0
    variantImpressions[c.variant_id] = v
  }

  // Fetch link click aggregates
  const linkClicksByLinkId: Record<string, number> = {}
  if (trackedLinks?.length) {
    const linkIds = trackedLinks.map(tl => tl.link_id).filter(Boolean)
    if (linkIds.length) {
      const { data: clickAggs } = await supabase
        .from('link_click_aggregates')
        .select('link_id, total_clicks')
        .in('link_id', linkIds)
      for (const agg of (clickAggs ?? []) as Array<{ link_id: string; total_clicks: number | null }>) {
        linkClicksByLinkId[agg.link_id] = agg.total_clicks ?? 0
      }
    }
  }

  const per_variant = Object.entries(variantImpressions).map(([variantId, stats]) => ({
    variant_id: variantId,
    impressions: stats.impressions,
    clicks: stats.clicks,
    link_clicks: (trackedLinks ?? [])
      .filter(tl => tl.variant_id === variantId)
      .reduce((sum, tl) => sum + (linkClicksByLinkId[tl.link_id] ?? 0), 0),
  }))

  const per_link = (trackedLinks ?? []).map(tl => ({
    template_name: tl.template_name,
    variant_id: tl.variant_id,
    short_code: tl.short_code,
    clicks: linkClicksByLinkId[tl.link_id] ?? 0,
  }))

  return ok({ per_variant, per_link })
}

// ---------------------------------------------------------------------------
// A/B Performance — aggregate winning patterns
// ---------------------------------------------------------------------------

/** Aggregate winning patterns and tags from completed A/B tests. */
export async function getAbPerformance(
  ctx: ServiceContext,
): Promise<ServiceResult<PerformancePatterns>> {
  const { supabase, siteId } = ctx

  const { data: completedTests } = await supabase
    .from('ab_tests')
    .select(`
      id, name, test_type, confidence_at_completion, result_metadata,
      winner:ab_test_variants!winner_variant_id(id, label, title_text, description_text, metadata),
      variants:ab_test_variants!test_id(id, metadata)
    `)
    .eq('site_id', siteId)
    .eq('status', 'completed')
    .not('winner_variant_id', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(50)

  const patterns: Record<string, number> = {}
  const tags: Record<string, { wins: number; tests: number }> = {}

  for (const test of completedTests ?? []) {
    const winnerRaw = test.winner as WinnerVariant[] | WinnerVariant | null
    const winner: WinnerVariant | null = Array.isArray(winnerRaw) ? winnerRaw[0] ?? null : winnerRaw
    if (!winner) continue

    const meta = winner.metadata ?? {}
    if (meta.title_pattern) {
      patterns[meta.title_pattern] = (patterns[meta.title_pattern] ?? 0) + 1
    }

    // Count tests: every tag across ALL variants in this test counts as one test appearance
    const allVariants = (test.variants ?? []) as Array<{ id: string; metadata: WinnerVariant['metadata'] | null }>
    const testTags = new Set<string>()
    for (const v of allVariants) {
      for (const tag of v.metadata?.thumbnail_tags ?? []) {
        testTags.add(tag)
      }
    }
    for (const tag of testTags) {
      const entry = tags[tag] ?? { wins: 0, tests: 0 }
      entry.tests++
      tags[tag] = entry
    }

    // Count wins: only tags from the winning variant
    for (const tag of meta.thumbnail_tags ?? []) {
      const entry = tags[tag] ?? { wins: 0, tests: 0 }
      entry.wins++
      tags[tag] = entry
    }
  }

  return ok({
    completed_tests: completedTests?.length ?? 0,
    winning_patterns: patterns,
    winning_tags: tags,
  })
}

// ---------------------------------------------------------------------------
// Variants — list
// ---------------------------------------------------------------------------

/** List all variants for an A/B test, ordered by sort_order. */
export async function listVariants(
  ctx: ServiceContext,
  testId: string,
): Promise<ServiceResult<VariantRow[]>> {
  if (!UUID_REGEX.test(testId)) {
    return err('VALIDATION_ERROR', 'Invalid test ID format', 400)
  }

  const { supabase, siteId } = ctx

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id')
    .eq('id', testId)
    .single()

  if (!test || test.site_id !== siteId) {
    return err('NOT_FOUND', 'Test not found', 404)
  }

  const { data: variants, error } = await supabase
    .from('ab_test_variants')
    .select('*')
    .eq('test_id', testId)
    .order('sort_order', { ascending: true })

  if (error) {
    Sentry.captureException(error, { tags: { component: 'ab-variants' } })
    return err('DB_ERROR', 'Failed to load variants', 500)
  }

  return ok((variants ?? []) as VariantRow[])
}

// ---------------------------------------------------------------------------
// Variants — batch upsert (ON CONFLICT test_id,label)
// ---------------------------------------------------------------------------

/** Validates type-specific required fields for variant payloads. */
function validateTypeSpecificFields(
  testType: TestType,
  variants: Array<{ label: string; title_text?: string | null; description_text?: string | null }>,
): string[] {
  const errors: string[] = []
  for (const v of variants) {
    if (testType === 'title' && !v.title_text) {
      errors.push(`Variant ${v.label}: title_text required for title tests`)
    }
    if (testType === 'description' && !v.description_text) {
      errors.push(`Variant ${v.label}: description_text required for description tests`)
    }
    if (testType === 'combo' && !v.title_text) {
      errors.push(`Variant ${v.label}: title_text required for combo tests`)
    }
  }
  return errors
}

/** Batch upsert variants for a draft A/B test using ON CONFLICT (test_id, label). */
export async function upsertVariants(
  ctx: ServiceContext,
  testId: string,
  variants: VariantInput[],
): Promise<ServiceResult<UpsertResult>> {
  if (!UUID_REGEX.test(testId)) {
    return err('VALIDATION_ERROR', 'Invalid test ID format', 400)
  }

  // Validate batch schema
  const parsed = BatchVariantUpsertSchema.safeParse({ variants })
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
  }

  // Check for duplicate labels
  const labels = parsed.data.variants.map(v => v.label)
  if (new Set(labels).size !== labels.length) {
    return err('VALIDATION_ERROR', 'Duplicate variant labels in batch', 400)
  }

  const { supabase, siteId } = ctx

  // Verify test exists and is draft
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('id, status, site_id, test_type')
    .eq('id', testId)
    .single()

  if (testError) {
    Sentry.captureException(testError, { tags: { component: 'ab-variants' } })
  }
  if (testError || !test) {
    return err('NOT_FOUND', 'Test not found', 404)
  }
  if (test.site_id !== siteId) {
    return err('NOT_FOUND', 'Test not found', 404)
  }
  if (test.status !== 'draft') {
    return err('INVALID_STATUS', 'Variants can only be added to draft tests', 409)
  }

  // Validate test_type
  const parsedType = TestTypeSchema.safeParse(test.test_type)
  if (!parsedType.success) {
    return err('VALIDATION_ERROR', 'Unknown test type', 400)
  }

  // Validate type-specific fields
  const typeErrors = validateTypeSpecificFields(parsedType.data, parsed.data.variants)
  if (typeErrors.length > 0) {
    return err('VALIDATION_ERROR', typeErrors.join('; '), 400)
  }

  // Build upsert rows
  const upsertRows = parsed.data.variants.map((v, i) => ({
    test_id: testId,
    label: v.label,
    is_original: false,
    title_text: v.title_text ?? null,
    description_text: v.description_text ?? null,
    metadata: v.metadata ?? {},
    sort_order: i + 1,
  }))

  const { data: upserted, error: upsertError } = await supabase
    .from('ab_test_variants')
    .upsert(upsertRows, { onConflict: 'test_id,label' })
    .select('id, label')

  if (upsertError) {
    Sentry.captureException(upsertError, { tags: { component: 'ab-variants' } })
    return err('DB_ERROR', 'Failed to save variants', 500)
  }

  const results = (upserted ?? []).map(r => ({
    label: r.label,
    ok: true,
    id: r.id,
  }))

  return ok({
    results,
    summary: { total: results.length, succeeded: results.length, failed: 0 },
  })
}

// ---------------------------------------------------------------------------
// Variants — delete
// ---------------------------------------------------------------------------

/** Delete a non-original variant from a draft A/B test. Supports dry-run mode. */
export async function deleteVariant(
  ctx: ServiceContext,
  testId: string,
  label: string,
  options?: { dryRun?: boolean },
): Promise<ServiceResult<DeleteResult>> {
  if (!UUID_REGEX.test(testId)) {
    return err('VALIDATION_ERROR', 'Invalid test ID format', 400)
  }

  if (!VALID_LABELS.has(label)) {
    return err('VALIDATION_ERROR', 'Query param "label" must be B, C, or D', 400)
  }

  const { supabase, siteId } = ctx

  // Verify test exists and is draft
  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id, status')
    .eq('id', testId)
    .single()

  if (!test || test.site_id !== siteId) {
    return err('NOT_FOUND', 'Test not found', 404)
  }
  if (test.status !== 'draft') {
    return err('INVALID_STATUS', 'Variants can only be deleted from draft tests', 409)
  }

  // Find variant
  const { data: variant } = await supabase
    .from('ab_test_variants')
    .select('id, is_original')
    .eq('test_id', testId)
    .eq('label', label)
    .single()

  if (!variant) {
    return err('NOT_FOUND', 'Variant not found', 404)
  }
  if (variant.is_original) {
    return err('VALIDATION_ERROR', 'Cannot delete the original variant', 400)
  }

  // Dry-run: return what would be deleted without actually deleting
  if (options?.dryRun) {
    return ok({ deleted: false, label })
  }

  const { error: deleteError } = await supabase
    .from('ab_test_variants')
    .delete()
    .eq('id', variant.id)

  if (deleteError) {
    Sentry.captureException(deleteError, { tags: { component: 'ab-variants' } })
    return err('DB_ERROR', 'Failed to delete variant', 500)
  }

  return ok({ deleted: true, label })
}

// ---------------------------------------------------------------------------
// A/B Tests — learnings (tag win rates + channel insights)
// ---------------------------------------------------------------------------

export interface AbLearningsResponse {
  tagWinRates: Array<{
    tag: string
    wins: number
    total: number
    avgLift: number
    kind: 'thumb' | 'title' | 'desc'
  }>
  channelInsights: Array<{ text: string; type: 'positive' | 'negative' | 'neutral' }>
  totalCompletedTests: number
}

/** Aggregate learnings from completed A/B tests: tag win rates and channel insights. */
export async function getAbLearnings(
  ctx: ServiceContext,
): Promise<ServiceResult<AbLearningsResponse>> {
  const { supabase, siteId } = ctx

  // Fetch completed tests with winners
  const { data: tests } = await supabase
    .from('ab_tests')
    .select('id, result_metadata, winner_variant_id, test_type')
    .eq('site_id', siteId)
    .eq('status', 'completed')
    .not('winner_variant_id', 'is', null)

  if (!tests || tests.length === 0) {
    return ok({ tagWinRates: [], channelInsights: [], totalCompletedTests: 0 })
  }

  const winnerIds = tests.map(t => t.winner_variant_id as string)
  const testIds = tests.map(t => t.id as string)

  const [winnersRes, allVariantsRes] = await Promise.all([
    supabase.from('ab_test_variants').select('id, metadata').in('id', winnerIds),
    supabase.from('ab_test_variants').select('id, metadata').in('test_id', testIds),
  ])

  const winners = winnersRes.data ?? []
  const allVariants = allVariantsRes.data ?? []

  // Build tag aggregation (mirroring queries.ts aggregateTags pattern)
  const tagMap = new Map<string, { wins: number; total: number; totalLift: number; kind: 'thumb' | 'title' | 'desc' }>()

  for (const test of tests) {
    const winner = winners.find(w => (w.id as string) === (test.winner_variant_id as string))
    if (!winner) continue
    const meta = winner.metadata as Record<string, unknown> | null
    const tags = (meta?.thumbnail_tags as string[]) ?? []
    const lift = ((test.result_metadata as Record<string, unknown> | null)?.ctr_lift_percent as number) ?? 0
    const testType = (test.test_type as string | undefined) ?? 'thumbnail'
    const kind = testType === 'title' ? 'title' as const : testType === 'description' ? 'desc' as const : 'thumb' as const

    for (const tag of tags) {
      const existing = tagMap.get(tag) ?? { wins: 0, total: 0, totalLift: 0, kind }
      existing.wins += 1
      existing.totalLift += lift
      tagMap.set(tag, existing)
    }
  }

  // Count total appearances across all variants
  for (const variant of allVariants) {
    const meta = variant.metadata as Record<string, unknown> | null
    const tags = (meta?.thumbnail_tags as string[]) ?? []
    for (const tag of tags) {
      const existing = tagMap.get(tag)
      if (existing) existing.total += 1
    }
  }

  const tagWinRates = Array.from(tagMap.entries())
    .map(([tag, data]) => ({
      tag,
      wins: data.wins,
      total: data.total,
      avgLift: data.wins > 0 ? data.totalLift / data.wins : 0,
      kind: data.kind,
    }))
    .sort((a, b) => b.wins - a.wins)

  // Build channel insights
  const channelInsights: AbLearningsResponse['channelInsights'] = []
  const positive = tagWinRates.filter(t => t.avgLift > 0).slice(0, 3)
  const negative = tagWinRates.filter(t => t.avgLift < 0).slice(0, 2)

  if (positive.length) {
    channelInsights.push({
      text: `Padrões que funcionam: ${positive.map(t => `"${t.tag}" (${t.wins}×)`).join(', ')}`,
      type: 'positive',
    })
  }
  if (negative.length) {
    channelInsights.push({
      text: `Evitar: ${negative.map(t => `"${t.tag}" (${Math.abs(Math.round(t.avgLift))}% queda)`).join(', ')}`,
      type: 'negative',
    })
  }
  if (!positive.length && !negative.length) {
    channelInsights.push({ text: 'Not enough data for insights', type: 'neutral' })
  }

  return ok({
    tagWinRates,
    channelInsights,
    totalCompletedTests: tests.length,
  })
}

// ---------------------------------------------------------------------------
// A/B Tests — suggestions (videos that should be tested)
// ---------------------------------------------------------------------------

export interface AbSuggestionsResponse {
  suggestions: Array<{
    videoId: string
    youtubeVideoId: string
    title: string
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    ctr: number
    suggestedTestType: string
    reason: string
  }>
}

/** Get suggested videos for A/B testing based on underperformance signals. */
export async function getAbSuggestions(
  ctx: ServiceContext,
): Promise<ServiceResult<AbSuggestionsResponse>> {
  const { supabase, siteId } = ctx

  const now = new Date()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch eligible videos: >= 1000 views, published > 14 days ago
  const { data: allVideos } = await supabase
    .from('youtube_videos')
    .select('id, youtube_video_id, title, thumbnail_url, ctr, view_count, impressions')
    .eq('site_id', siteId)
    .gte('view_count', 1000)
    .lt('published_at', fourteenDaysAgo)
    .order('view_count', { ascending: false })
    .limit(300)

  if (!allVideos || allVideos.length === 0) return ok({ suggestions: [] })

  // Exclude recently-tested videos
  const { data: recentTests } = await supabase
    .from('ab_tests')
    .select('youtube_video_id')
    .eq('site_id', siteId)
    .gte('created_at', sixtyDaysAgo)

  const recentlyTestedIds = new Set((recentTests ?? []).map(t => t.youtube_video_id as string))
  const eligible = allVideos.filter(v => !recentlyTestedIds.has(v.id as string))

  if (eligible.length === 0) return ok({ suggestions: [] })

  // Fetch latest grades
  const eligibleIds = eligible.map(v => v.id as string)
  const { data: latestGrades } = await supabase
    .from('video_grade_history')
    .select('youtube_video_id, grade, score')
    .eq('site_id', siteId)
    .in('youtube_video_id', eligibleIds)
    .order('recorded_at', { ascending: false })

  const gradeMap = new Map<string, { grade: string; score: number }>()
  for (const g of latestGrades ?? []) {
    const vid = g.youtube_video_id as string
    if (!gradeMap.has(vid)) {
      gradeMap.set(vid, { grade: g.grade as string, score: Number(g.score) })
    }
  }

  // Channel average CTR
  const withCtr = eligible.filter(v => (v.ctr as number | null) != null && (v.ctr as number) > 0)
  const channelAvgCtr = withCtr.length > 0
    ? withCtr.reduce((sum, v) => sum + (v.ctr as number), 0) / withCtr.length
    : 0

  // Score and rank
  const scored = eligible.map(v => {
    const ctr = (v.ctr as number | null) ?? 0
    const viewCount = v.view_count as number
    const hasCtr = ctr > 0 && channelAvgCtr > 0
    const ratio = channelAvgCtr > 0 && hasCtr ? ctr / channelAvgCtr : 0
    const gradeData = gradeMap.get(v.id as string)
    const gradePenalty = gradeData
      ? (gradeData.grade === 'D' ? 3 : gradeData.grade === 'C' ? 2 : gradeData.grade === 'B' ? 1 : 0.5)
      : 1
    const score = viewCount * gradePenalty

    const belowPercent = Math.round((1 - ratio) * 100)
    const grade: 'A' | 'B' | 'C' | 'D' | 'F' = (gradeData?.grade as 'A' | 'B' | 'C' | 'D' | 'F')
      ?? (!hasCtr ? 'C' : ratio > 0.9 ? 'A' : ratio > 0.7 ? 'B' : ratio > 0.5 ? 'C' : ratio > 0.3 ? 'D' : 'F')

    const reason = hasCtr
      ? `${belowPercent}% abaixo da média do canal`
      : `Alto alcance sem teste (${viewCount.toLocaleString('pt-BR')} views)`

    return {
      videoId: v.id as string,
      youtubeVideoId: (v.youtube_video_id as string) ?? '',
      title: v.title as string,
      grade,
      ctr: Math.round(ctr * 100) / 100,
      suggestedTestType: 'thumbnail',
      reason,
      score,
    }
  })

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, 5)

  return ok({
    suggestions: top.map(({ score: _score, ...rest }) => rest),
  })
}

// ---------------------------------------------------------------------------
// A/B Tests — fatigue alerts
// ---------------------------------------------------------------------------

export interface AbFatigueAlertsResponse {
  alerts: Array<{
    id: string
    videoId: string
    title: string
    zScore: number
    expectedCtr: number
    actualCtr: number
    createdAt: string
  }>
}

/** Get pending fatigue alerts for videos with declining CTR. */
export async function getAbFatigueAlerts(
  ctx: ServiceContext,
): Promise<ServiceResult<AbFatigueAlertsResponse>> {
  const { supabase, siteId } = ctx

  const { data } = await supabase
    .from('youtube_fatigue_alerts')
    .select('id, video_id, z_score, expected_ctr, actual_ctr, detected_at, youtube_videos!inner(id, title)')
    .eq('site_id', siteId)
    .eq('status', 'pending')
    .order('detected_at', { ascending: false })
    .limit(20)

  const alerts = (data ?? []).map(alert => ({
    id: alert.id as string,
    videoId: alert.video_id as string,
    title: ((alert as Record<string, unknown>).youtube_videos as { title: string } | null)?.title ?? 'Video',
    zScore: alert.z_score as number,
    expectedCtr: alert.expected_ctr as number,
    actualCtr: alert.actual_ctr as number,
    createdAt: alert.detected_at as string,
  }))

  return ok({ alerts })
}

// ---------------------------------------------------------------------------
// A/B Tests — dashboard stats
// ---------------------------------------------------------------------------

export interface AbDashboardResponse {
  activeTests: number
  avgConfidence: number
  winRate: number
  avgLift: number
  testsByStatus: {
    draft: number
    active: number
    paused: number
    completed: number
  }
}

/** Compute aggregate dashboard statistics for A/B tests. */
export async function getAbDashboard(
  ctx: ServiceContext,
): Promise<ServiceResult<AbDashboardResponse>> {
  const { supabase, siteId } = ctx

  const { data: tests } = await supabase
    .from('ab_tests')
    .select('id, status, winner_variant_id, confidence_at_completion, result_metadata, parent_test_id')
    .eq('site_id', siteId)
    .not('status', 'eq', 'archived')

  const all = tests ?? []

  // Count by status
  const draft = all.filter(t => t.status === 'draft').length
  const active = all.filter(t => t.status === 'active' || t.status === 'queued').length
  const paused = all.filter(t => t.status === 'paused').length
  const completed = all.filter(t => t.status === 'completed')

  // Avg confidence from completed tests
  const confidenceValues = completed
    .map(t => t.confidence_at_completion as number | null)
    .filter((v): v is number => v !== null)
  const avgConfidence = confidenceValues.length > 0
    ? (confidenceValues.reduce((sum, v) => sum + v, 0) / confidenceValues.length) * 100
    : 0

  // Win rate and avg lift from root completed tests (exclude playoff children)
  const rootCompleted = completed.filter(t => t.parent_test_id === null)
  const winnerCount = rootCompleted.filter(t => t.winner_variant_id !== null).length
  const winRate = rootCompleted.length > 0 ? (winnerCount / rootCompleted.length) * 100 : 0

  const liftValues = rootCompleted
    .filter(t => t.winner_variant_id !== null && t.result_metadata !== null)
    .map(t => ((t.result_metadata as Record<string, unknown> | null)?.ctr_lift_percent as number) ?? 0)
  const avgLift = liftValues.length > 0
    ? liftValues.reduce((sum, v) => sum + v, 0) / liftValues.length
    : 0

  return ok({
    activeTests: active,
    avgConfidence,
    winRate,
    avgLift,
    testsByStatus: {
      draft,
      active,
      paused,
      completed: completed.length,
    },
  })
}

// ---------------------------------------------------------------------------
// A/B Tests — video test history
// ---------------------------------------------------------------------------

export interface AbVideoHistoryResponse {
  videoId: string
  tests: Array<{
    id: string
    type: string
    status: string
    winner: string | null
    liftPercent: number | null
    startedAt: string | null
    endedAt: string | null
  }>
}

/** Get all test history for a specific video by its youtube_video_id. */
export async function getAbVideoHistory(
  ctx: ServiceContext,
  youtubeVideoId: string,
): Promise<ServiceResult<AbVideoHistoryResponse>> {
  const { supabase, siteId } = ctx

  const { data: tests } = await supabase
    .from('ab_tests')
    .select(`
      id, test_type, status, started_at, completed_at, result_metadata,
      winner:ab_test_variants!winner_variant_id(label)
    `)
    .eq('youtube_video_id', youtubeVideoId)
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })

  const mappedTests = (tests ?? []).map(t => ({
    id: t.id as string,
    type: (t.test_type as string) ?? 'thumbnail',
    status: t.status as string,
    winner: ((Array.isArray(t.winner) ? t.winner[0] : t.winner) as { label: string } | null)?.label ?? null,
    liftPercent: ((t.result_metadata as Record<string, unknown> | null)?.ctr_lift_percent as number) ?? null,
    startedAt: t.started_at as string | null,
    endedAt: t.completed_at as string | null,
  }))

  return ok({
    videoId: youtubeVideoId,
    tests: mappedTests,
  })
}

// ---------------------------------------------------------------------------
// Thumbnail Library — GET
// ---------------------------------------------------------------------------

export interface ThumbnailLibraryItem {
  id: string
  videoTitle: string | null
  imageUrl: string
  lift: number | null
  tags: string[]
  longevityScore: string | null
  sourceType: string
}

export interface ThumbnailLibraryResponse {
  thumbnails: ThumbnailLibraryItem[]
}

/** Fetch thumbnail library entries with longevity data. */
export async function getThumbnailLibrary(
  ctx: ServiceContext,
): Promise<ServiceResult<ThumbnailLibraryResponse>> {
  const { supabase, siteId } = ctx

  const { data, error } = await supabase
    .from('thumbnail_library')
    .select('id, blob_url, title, video_title, tags, lift_at_win, source_type, thumbnail_longevity(checkpoint_days, status, change_percent)')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return err('DB_ERROR', 'Failed to load thumbnail library', 500)

  const thumbnails: ThumbnailLibraryItem[] = (data ?? []).map(entry => {
    const longevity = (entry as Record<string, unknown>).thumbnail_longevity as Array<{ checkpoint_days: number; status: string; change_percent: number | null }> | null
    // Use the latest checkpoint as the longevity score
    const latestCheckpoint = longevity?.length
      ? longevity.reduce((latest, cp) => cp.checkpoint_days > latest.checkpoint_days ? cp : latest, longevity[0]!)
      : null

    return {
      id: entry.id as string,
      videoTitle: entry.video_title as string | null,
      imageUrl: entry.blob_url as string,
      lift: entry.lift_at_win as number | null,
      tags: (entry.tags as string[]) ?? [],
      longevityScore: latestCheckpoint?.status ?? null,
      sourceType: entry.source_type as string,
    }
  })

  return ok({ thumbnails })
}

// ---------------------------------------------------------------------------
// Thumbnail Fatigue Alerts — GET
// ---------------------------------------------------------------------------

export interface ThumbnailFatigueAlert {
  videoId: string
  title: string
  zScore: number
  expectedCtr: number
  actualCtr: number
  daysSinceChange: number
}

export interface ThumbnailFatigueResponse {
  alerts: ThumbnailFatigueAlert[]
}

/** Fetch pending fatigue alerts with longevity checkpoint data. */
export async function getThumbnailFatigueAlerts(
  ctx: ServiceContext,
): Promise<ServiceResult<ThumbnailFatigueResponse>> {
  const { supabase, siteId } = ctx

  // Fetch pending fatigue alerts with video info
  const { data: alertData, error: alertError } = await supabase
    .from('youtube_fatigue_alerts')
    .select('id, video_id, z_score, expected_ctr, actual_ctr, detected_at, youtube_videos!inner(id, title)')
    .eq('site_id', siteId)
    .eq('status', 'pending')
    .order('detected_at', { ascending: false })
    .limit(20)

  if (alertError) return err('DB_ERROR', 'Failed to load fatigue alerts', 500)

  const now = Date.now()

  const alerts: ThumbnailFatigueAlert[] = (alertData ?? []).map(alert => {
    const video = (alert as Record<string, unknown>).youtube_videos as { title: string } | null
    const detectedAt = new Date(alert.detected_at as string).getTime()
    const daysSinceChange = Math.floor((now - detectedAt) / 86400000)

    return {
      videoId: alert.video_id as string,
      title: video?.title ?? 'Video',
      zScore: alert.z_score as number,
      expectedCtr: alert.expected_ctr as number,
      actualCtr: alert.actual_ctr as number,
      daysSinceChange,
    }
  })

  return ok({ alerts })
}

// ---------------------------------------------------------------------------
// Videos — list with category join
// ---------------------------------------------------------------------------

export interface VideoListFilters {
  channelId: string
  categoryId?: string | null
  limit?: number
  cursor?: string | null
}

export interface VideoListItem {
  id: string
  youtube_video_id: string
  title: string
  views: number
  likes: number
  comments: number
  ctr: number | null
  avg_view_percentage: number | null
  published_at: string
  category_slug: string | null
  thumbnail_url: string | null
  duration_seconds: number
  is_featured: boolean
}

export interface VideoListResult {
  videos: VideoListItem[]
  count: number
}

/** List videos for a channel with optional category filter and cursor pagination. */
export async function listVideos(
  ctx: ServiceContext,
  filters: VideoListFilters,
): Promise<ServiceResult<VideoListResult>> {
  const { supabase, siteId } = ctx
  const limit = Math.min(filters.limit ?? 50, 100)

  // Verify channel belongs to site
  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('id')
    .eq('id', filters.channelId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return err('NOT_FOUND', 'Channel not found', 404)

  let query = supabase
    .from('youtube_videos')
    .select('id, youtube_video_id, title, view_count, like_count, comment_count, ctr, avg_view_percentage, published_at, category_id, thumbnail_url, duration_seconds, is_featured, youtube_categories(slug)')
    .eq('channel_id', filters.channelId)
    .eq('is_hidden', false)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (filters.categoryId) {
    query = query.eq('category_id', filters.categoryId)
  }

  if (filters.cursor) {
    query = query.lt('published_at', filters.cursor)
  }

  const { data, error } = await query

  if (error) return err('DB_ERROR', 'Failed to load videos', 500)

  const videos: VideoListItem[] = (data ?? []).map((v: Record<string, unknown>) => {
    const cat = v.youtube_categories as { slug: string } | null
    return {
      id: v.id as string,
      youtube_video_id: v.youtube_video_id as string,
      title: v.title as string,
      views: v.view_count as number,
      likes: v.like_count as number,
      comments: v.comment_count as number,
      ctr: v.ctr as number | null,
      avg_view_percentage: v.avg_view_percentage as number | null,
      published_at: v.published_at as string,
      category_slug: cat?.slug ?? null,
      thumbnail_url: v.thumbnail_url as string | null,
      duration_seconds: v.duration_seconds as number,
      is_featured: v.is_featured as boolean,
    }
  })

  return ok({ videos, count: videos.length })
}

// ---------------------------------------------------------------------------
// Videos — detail with scoring
// ---------------------------------------------------------------------------

export interface VideoAxisDetail {
  axis: string
  score: number
  grade: string
  channelMedian: number
}

export interface VideoDetailResult {
  id: string
  title: string
  axes: VideoAxisDetail[]
  retentionCurve: unknown
  trafficSources: unknown
  optimizationState: string | null
  trend: TrendData
  gradeHistory: Array<{ week: string; score: number }>
}

/** Fetch a single video with full 6-axis scoring breakdown, retention, traffic, optimization state, and grade trend. */
export async function getVideoDetail(
  ctx: ServiceContext,
  videoId: string,
): Promise<ServiceResult<VideoDetailResult>> {
  if (!UUID_REGEX.test(videoId)) {
    return err('VALIDATION_ERROR', 'Invalid video ID format', 400)
  }

  const { supabase, siteId } = ctx

  // Fetch video
  const { data: video, error: videoError } = await supabase
    .from('youtube_videos')
    .select('id, youtube_video_id, title, published_at, ctr, impressions, avg_view_percentage, avg_view_duration_seconds, retention_curve, traffic_sources, view_count, like_count, comment_count, channel_id')
    .eq('id', videoId)
    .eq('site_id', siteId)
    .single()

  if (videoError || !video) return err('NOT_FOUND', 'Video not found', 404)

  // Fetch channel for subscriber count
  const { data: channelData } = await supabase
    .from('youtube_channels')
    .select('id, subscriber_count')
    .eq('id', video.channel_id)
    .single()

  const subscriberCount = channelData?.subscriber_count ?? 0

  // Parallel: channel videos for baseline, daily analytics, optimization cycles, grade history
  const [channelVideosRes, dailyRes, cycleRes, gradeHistoryRes] = await Promise.all([
    supabase
      .from('youtube_videos')
      .select('id, ctr, avg_view_percentage, traffic_sources, view_count')
      .eq('channel_id', video.channel_id)
      .eq('is_hidden', false)
      .order('published_at', { ascending: false })
      .limit(50),
    supabase
      .from('youtube_video_analytics')
      .select('date, views, likes, comments, shares, subscribers_gained, impressions')
      .eq('youtube_video_id', videoId)
      .order('date', { ascending: true })
      .limit(90),
    supabase
      .from('optimization_cycles')
      .select('state')
      .eq('youtube_video_id', videoId)
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('video_grade_history')
      .select('week_iso, score')
      .eq('youtube_video_id', videoId)
      .eq('site_id', siteId)
      .order('week_iso', { ascending: true }),
  ])

  // Build baseline from channel videos
  const channelVideos = channelVideosRes.data ?? []
  const dailyRows = dailyRes.data ?? []

  const dailyByVideo = new Map<string, Array<{ date: string; views: number; likes?: number; comments?: number; shares?: number; subscribers_gained?: number; impressions?: number }>>()
  dailyByVideo.set(videoId, dailyRows)

  const baseline = computeBaseline(
    channelVideos as BaselineVideoInput[],
    dailyByVideo,
    subscriberCount,
  )

  // Build score input for this video
  const viewCount = video.view_count ?? 0
  const likeCount = video.like_count ?? 0
  const commentCount = video.comment_count ?? 0
  const totalImpressions = video.impressions ?? 0
  const engagementRate = viewCount > 0 ? ((likeCount + commentCount) / viewCount) * 100 : 0
  const subscribersGained = dailyRows.reduce((s: number, r: { subscribers_gained?: number }) => s + (r.subscribers_gained ?? 0), 0)

  const dailyViews = dailyRows.map((r: { date: string; views: number }) => ({ date: r.date, views: r.views }))

  const scoreInput: VideoScoreInput = {
    videoId,
    publishedAt: video.published_at,
    ctr: Number(video.ctr) || 0,
    avgViewPercentage: Number(video.avg_view_percentage) || 0,
    impressions: totalImpressions,
    trafficSources: (video.traffic_sources as TrafficSources) ?? null,
    engagementRate,
    dailyViews,
    subscribersGained,
    viewCount,
  }

  const videoScore = scoreVideo(scoreInput, baseline)

  // Map axes with channel medians
  const medianMap: Record<string, number> = {
    ctr: baseline.medianCtr,
    retention: baseline.medianRetention,
    reach: baseline.medianReach,
    engagement: baseline.medianEngagement,
    growth: baseline.medianGrowth,
    sub_impact: baseline.medianSubImpact,
  }

  const axes: VideoAxisDetail[] = videoScore.axes.map(a => ({
    axis: a.axis,
    score: Math.round(a.normalized * 10) / 10,
    grade: assignGrade(a.normalized),
    channelMedian: medianMap[a.axis] ?? 0,
  }))

  // Grade history for trend
  const gradeHistoryData = gradeHistoryRes.data ?? []
  const weeklyScores = gradeHistoryData.map((g: { score: number }) => g.score)
  const trend = computeTrend(weeklyScores)

  const optimizationState = (cycleRes.data?.[0] as { state: string } | undefined)?.state ?? null

  const result: VideoDetailResult = {
    id: video.id,
    title: video.title,
    axes,
    retentionCurve: video.retention_curve,
    trafficSources: video.traffic_sources,
    optimizationState,
    trend,
    gradeHistory: gradeHistoryData.map((g: { week_iso: string; score: number }) => ({
      week: g.week_iso,
      score: g.score,
    })),
  }

  return ok(result)
}

// ---------------------------------------------------------------------------
// Categories — list with video counts
// ---------------------------------------------------------------------------

export interface CategoryListItem {
  id: string
  slug: string
  name_pt: string
  match_keywords: string[]
  auto_approve: boolean
  video_count: number
}

/** List all categories for the site with video counts. */
export async function listCategories(
  ctx: ServiceContext,
): Promise<ServiceResult<{ categories: CategoryListItem[] }>> {
  const { supabase, siteId } = ctx

  const [categoriesRes, videosRes] = await Promise.all([
    supabase
      .from('youtube_categories')
      .select('id, slug, name_pt, match_keywords, auto_approve')
      .eq('site_id', siteId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('youtube_videos')
      .select('category_id')
      .eq('site_id', siteId)
      .eq('is_hidden', false)
      .not('category_id', 'is', null),
  ])

  if (categoriesRes.error) return err('DB_ERROR', 'Failed to load categories', 500)

  // Count videos per category
  const countMap = new Map<string, number>()
  for (const v of videosRes.data ?? []) {
    const catId = v.category_id as string
    countMap.set(catId, (countMap.get(catId) ?? 0) + 1)
  }

  const categories: CategoryListItem[] = (categoriesRes.data ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    slug: c.slug as string,
    name_pt: c.name_pt as string,
    match_keywords: c.match_keywords as string[],
    auto_approve: c.auto_approve as boolean,
    video_count: countMap.get(c.id as string) ?? 0,
  }))

  return ok({ categories })
}

// ---------------------------------------------------------------------------
// Categories — update match_keywords
// ---------------------------------------------------------------------------

export interface CategoryUpdateInput {
  id: string
  match_keywords: string[]
}

/** Update match_keywords for a category (used by Cowork to improve auto-categorization). */
export async function updateCategoryKeywords(
  ctx: ServiceContext,
  input: CategoryUpdateInput,
): Promise<ServiceResult<{ id: string; match_keywords: string[] }>> {
  if (!UUID_REGEX.test(input.id)) {
    return err('VALIDATION_ERROR', 'Invalid category ID format', 400)
  }

  if (!Array.isArray(input.match_keywords)) {
    return err('VALIDATION_ERROR', 'match_keywords must be an array of strings', 400)
  }

  const { supabase, siteId } = ctx

  const { data: category } = await supabase
    .from('youtube_categories')
    .select('id, site_id')
    .eq('id', input.id)
    .single()

  if (!category || category.site_id !== siteId) {
    return err('NOT_FOUND', 'Category not found', 404)
  }

  const { error: updateError } = await supabase
    .from('youtube_categories')
    .update({
      match_keywords: input.match_keywords,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)

  if (updateError) {
    Sentry.captureException(updateError, { tags: { component: 'youtube-categories' } })
    return err('DB_ERROR', 'Failed to update category', 500)
  }

  return ok({ id: input.id, match_keywords: input.match_keywords })
}

// ---------------------------------------------------------------------------
// Analytics — Overview (health score + KPIs + baseline)
// ---------------------------------------------------------------------------

export interface HealthAxis {
  axis: string
  score: number
  grade: string
}

export interface AnalyticsOverview {
  health: {
    overall: number
    axes: HealthAxis[]
  }
  kpis: {
    views: number
    watchTime: number
    subscribers: number
    avgCtr: number
    avgRetention: number
  }
  baseline: {
    medianCtr: number
    medianRetention: number
  }
}

function assignAxisGrade(score: number): string {
  if (score >= 85) return 'A'
  if (score >= 65) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

/** Compute channel health overview with per-axis scores, KPIs, and baseline medians. */
export async function getAnalyticsOverview(
  ctx: ServiceContext,
  channelId: string,
  days: number,
): Promise<ServiceResult<AnalyticsOverview>> {
  const { supabase, siteId } = ctx

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('id, channel_id, subscriber_count')
    .eq('id', channelId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return err('NOT_FOUND', 'Channel not found', 404)

  const { data: videos } = await supabase
    .from('youtube_videos')
    .select('id, youtube_video_id, title, published_at, view_count, ctr, impressions, avg_view_percentage, avg_view_duration_seconds, retention_curve, traffic_sources')
    .eq('channel_id', channel.id)
    .eq('site_id', siteId)
    .order('published_at', { ascending: false })
    .limit(50)

  if (!videos?.length) {
    return ok({
      health: { overall: 0, axes: [] },
      kpis: { views: 0, watchTime: 0, subscribers: 0, avgCtr: 0, avgRetention: 0 },
      baseline: { medianCtr: 0, medianRetention: 0 },
    })
  }

  const videoIds = videos.map(v => v.id)
  const cutoffDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]!

  const { data: dailyData } = await supabase
    .from('youtube_video_analytics')
    .select('youtube_video_id, date, views, likes, comments, shares, subscribers_gained, impressions')
    .eq('site_id', siteId)
    .in('youtube_video_id', videoIds)
    .gte('date', cutoffDate)

  const dailyByVideo = new Map<string, Array<{ date: string; views: number; likes: number; comments: number; shares: number; subscribers_gained: number; impressions: number }>>()
  for (const row of dailyData ?? []) {
    const arr = dailyByVideo.get(row.youtube_video_id) ?? []
    arr.push(row)
    dailyByVideo.set(row.youtube_video_id, arr)
  }

  const baseline = computeBaseline(videos, dailyByVideo, channel.subscriber_count ?? 0)

  const axisAccum: Record<string, { total: number; count: number }> = {}
  let overallSum = 0

  for (const video of videos) {
    const daily = dailyByVideo.get(video.id) ?? []
    const totalViews = daily.reduce((s, d) => s + d.views, 0)
    const totalEng = daily.reduce((s, d) => s + d.likes + d.comments + d.shares, 0)
    const totalSubs = daily.reduce((s, d) => s + d.subscribers_gained, 0)

    const input: VideoScoreInput = {
      videoId: video.id,
      publishedAt: video.published_at ?? new Date().toISOString(),
      ctr: video.ctr ?? 0,
      avgViewPercentage: video.avg_view_percentage ?? 0,
      impressions: video.impressions ?? 0,
      trafficSources: (video.traffic_sources && typeof video.traffic_sources === 'object' && !Array.isArray(video.traffic_sources))
        ? video.traffic_sources as VideoScoreInput['trafficSources']
        : null,
      engagementRate: totalViews > 0 ? (totalEng / totalViews) * 100 : 0,
      dailyViews: daily.map(d => ({ date: d.date, views: d.views })),
      subscribersGained: totalSubs,
      viewCount: video.view_count ?? 0,
    }

    const scored = scoreVideo(input, baseline)
    overallSum += scored.overall

    for (const a of scored.axes) {
      const acc = axisAccum[a.axis] ?? { total: 0, count: 0 }
      acc.total += a.normalized
      acc.count++
      axisAccum[a.axis] = acc
    }
  }

  const axes: HealthAxis[] = Object.entries(axisAccum).map(([axis, acc]) => {
    const score = Math.round(acc.total / acc.count)
    return { axis, score, grade: assignAxisGrade(score) }
  })

  const overallHealth = Math.round(overallSum / videos.length)

  const allDaily = Array.from(dailyByVideo.values()).flat()
  const totalViews = allDaily.reduce((s, d) => s + d.views, 0)
  const totalSubs = allDaily.reduce((s, d) => s + d.subscribers_gained, 0)

  const ctrs = videos.map(v => v.ctr ?? 0).filter(c => c > 0)
  const retentions = videos.map(v => v.avg_view_percentage ?? 0).filter(r => r > 0)
  const avgCtr = ctrs.length > 0 ? ctrs.reduce((a, b) => a + b, 0) / ctrs.length : 0
  const avgRetention = retentions.length > 0 ? retentions.reduce((a, b) => a + b, 0) / retentions.length : 0

  const watchTime = videos.reduce((s, v) => {
    const dur = (v.avg_view_duration_seconds as number | null) ?? 0
    return s + dur * (v.view_count ?? 0)
  }, 0)

  return ok({
    health: { overall: overallHealth, axes },
    kpis: {
      views: totalViews,
      watchTime: Math.round(watchTime / 60),
      subscribers: totalSubs,
      avgCtr: Math.round(avgCtr * 100) / 100,
      avgRetention: Math.round(avgRetention * 100) / 100,
    },
    baseline: {
      medianCtr: Math.round(baseline.medianCtr * 100) / 100,
      medianRetention: Math.round(baseline.medianRetention * 100) / 100,
    },
  })
}

// ---------------------------------------------------------------------------
// Analytics — Grades (per-video scores with sorting)
// ---------------------------------------------------------------------------

export interface VideoGradeRow {
  id: string
  title: string
  score: number
  grade: string
  trend: { direction: string; velocity: number }
  ctr: number
  retention: number
  views: number
  published_at: string
}

export interface GradesResponse {
  videos: VideoGradeRow[]
  top5: VideoGradeRow[]
  bottom5: VideoGradeRow[]
}

/** List per-video scores with sort, limit, and top5/bottom5 slices. */
export async function getAnalyticsGrades(
  ctx: ServiceContext,
  channelId: string,
  sort: 'score' | 'published_at' | 'views',
  limit: number,
): Promise<ServiceResult<GradesResponse>> {
  const { supabase, siteId } = ctx

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('id, subscriber_count')
    .eq('id', channelId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return err('NOT_FOUND', 'Channel not found', 404)

  const { data: videos } = await supabase
    .from('youtube_videos')
    .select('id, youtube_video_id, title, published_at, view_count, ctr, impressions, avg_view_percentage, avg_view_duration_seconds, retention_curve, traffic_sources')
    .eq('channel_id', channel.id)
    .eq('site_id', siteId)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (!videos?.length) {
    return ok({ videos: [], top5: [], bottom5: [] })
  }

  const videoIds = videos.map(v => v.id)
  const cutoff90d = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]!

  const [dailyRes, gradesRes] = await Promise.all([
    supabase
      .from('youtube_video_analytics')
      .select('youtube_video_id, date, views, likes, comments, shares, subscribers_gained, impressions')
      .eq('site_id', siteId)
      .in('youtube_video_id', videoIds)
      .gte('date', cutoff90d),
    supabase
      .from('video_grade_history')
      .select('youtube_video_id, score, week_iso')
      .eq('site_id', siteId)
      .in('youtube_video_id', videoIds)
      .order('week_iso', { ascending: false })
      .limit(200),
  ])

  const dailyByVideo = new Map<string, Array<{ date: string; views: number; likes: number; comments: number; shares: number; subscribers_gained: number; impressions: number }>>()
  for (const row of dailyRes.data ?? []) {
    const arr = dailyByVideo.get(row.youtube_video_id) ?? []
    arr.push(row)
    dailyByVideo.set(row.youtube_video_id, arr)
  }

  const historyByVideo = new Map<string, number[]>()
  for (const h of gradesRes.data ?? []) {
    const arr = historyByVideo.get(h.youtube_video_id) ?? []
    arr.push(Number(h.score))
    historyByVideo.set(h.youtube_video_id, arr)
  }

  const baseline = computeBaseline(videos, dailyByVideo, channel.subscriber_count ?? 0)

  const scored: VideoGradeRow[] = videos.map(video => {
    const daily = dailyByVideo.get(video.id) ?? []
    const last28 = daily.filter(d => new Date(d.date).getTime() > Date.now() - 28 * 86400000)
    const totalViews = last28.reduce((s, d) => s + d.views, 0)
    const totalEng = last28.reduce((s, d) => s + d.likes + d.comments + d.shares, 0)
    const totalSubs = last28.reduce((s, d) => s + d.subscribers_gained, 0)

    const input: VideoScoreInput = {
      videoId: video.id,
      publishedAt: video.published_at ?? new Date().toISOString(),
      ctr: video.ctr ?? 0,
      avgViewPercentage: video.avg_view_percentage ?? 0,
      impressions: video.impressions ?? 0,
      trafficSources: (video.traffic_sources && typeof video.traffic_sources === 'object' && !Array.isArray(video.traffic_sources))
        ? video.traffic_sources as VideoScoreInput['trafficSources']
        : null,
      engagementRate: totalViews > 0 ? (totalEng / totalViews) * 100 : 0,
      dailyViews: last28.map(d => ({ date: d.date, views: d.views })),
      subscribersGained: totalSubs,
      viewCount: video.view_count ?? 0,
    }

    const result = scoreVideo(input, baseline)
    const weeklyScores = historyByVideo.get(video.id) ?? []
    const trend = computeTrend([...weeklyScores].reverse())

    return {
      id: video.id,
      title: video.title ?? '',
      score: Math.round(result.overall * 10) / 10,
      grade: result.grade,
      trend: { direction: trend.direction, velocity: Math.round(trend.velocity * 10) / 10 },
      ctr: Math.round((video.ctr ?? 0) * 100) / 100,
      retention: Math.round((video.avg_view_percentage ?? 0) * 100) / 100,
      views: video.view_count ?? 0,
      published_at: video.published_at ?? '',
    }
  })

  if (sort === 'score') {
    scored.sort((a, b) => b.score - a.score)
  } else if (sort === 'views') {
    scored.sort((a, b) => b.views - a.views)
  }

  const byScore = [...scored].sort((a, b) => b.score - a.score)
  const top5 = byScore.slice(0, 5)
  const bottom5 = byScore.slice(-5).reverse()

  return ok({ videos: scored, top5, bottom5 })
}

// ---------------------------------------------------------------------------
// Analytics — Demographics
// ---------------------------------------------------------------------------

export interface DemographicsResponse {
  ageGender: { ageGroup: string; male: number; female: number }[]
  countries: { country: string; views: number; percentage: number }[]
  devices: { deviceType: string; views: number; percentage: number }[]
}

/** Fetch demographics data via YouTube Analytics API. */
export async function getAnalyticsDemographics(
  ctx: ServiceContext,
  channelId: string,
  days: number,
): Promise<ServiceResult<DemographicsResponse>> {
  const { supabase, siteId } = ctx

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('id, channel_id')
    .eq('id', channelId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return err('NOT_FOUND', 'Channel not found', 404)

  try {
    const demographics = await fetchYtDemographics(siteId, days, channel.channel_id)
    return ok(demographics)
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'pipeline-analytics-demographics' } })
    return err('UPSTREAM_ERROR', 'Failed to fetch demographics from YouTube', 502)
  }
}

// ---------------------------------------------------------------------------
// Analytics — Search Terms
// ---------------------------------------------------------------------------

export interface SearchTermsResponse {
  terms: { query: string; views: number; watchTimeMinutes: number }[]
}

/** Fetch top search terms driving traffic via YouTube Analytics API. */
export async function getAnalyticsSearchTerms(
  ctx: ServiceContext,
  channelId: string,
  days: number,
): Promise<ServiceResult<SearchTermsResponse>> {
  const { supabase, siteId } = ctx

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('id, channel_id')
    .eq('id', channelId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return err('NOT_FOUND', 'Channel not found', 404)

  try {
    const terms = await fetchYtSearchTerms(siteId, days, channel.channel_id)
    return ok({
      terms: terms.map(t => ({
        query: t.term,
        views: t.views,
        watchTimeMinutes: Math.round(t.estimatedMinutesWatched),
      })),
    })
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'pipeline-analytics-search-terms' } })
    return err('UPSTREAM_ERROR', 'Failed to fetch search terms from YouTube', 502)
  }
}

// ---------------------------------------------------------------------------
// Analytics — Notes (list + create bot note)
// ---------------------------------------------------------------------------

export interface NoteItem {
  id: string
  author: string
  text: string
  timestamp: string
  isBot: boolean
  source: string | null
}

export interface NotesListResponse {
  notes: NoteItem[]
}

export interface NoteCreateResponse {
  ok: boolean
  id: string
}

/** List analytics notes for a channel. */
export async function listAnalyticsNotes(
  ctx: ServiceContext,
  channelId: string,
): Promise<ServiceResult<NotesListResponse>> {
  const { supabase, siteId } = ctx

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('id')
    .eq('id', channelId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return err('NOT_FOUND', 'Channel not found', 404)

  const { data } = await supabase
    .from('youtube_notes')
    .select('id, author_name, text, is_bot, source, created_at')
    .eq('site_id', siteId)
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(100)

  const notes: NoteItem[] = (data ?? []).map(n => ({
    id: n.id as string,
    author: n.author_name as string,
    text: n.text as string,
    timestamp: n.created_at as string,
    isBot: n.is_bot as boolean,
    source: n.source as string | null,
  }))

  return ok({ notes })
}

const botNoteSchema = z.object({
  channel_id: z.string().regex(UUID_REGEX),
  text: z.string().min(1).max(5000),
})

/** Create a bot note (Cowork-authored) for a channel. */
export async function createBotNote(
  ctx: ServiceContext,
  body: unknown,
): Promise<ServiceResult<NoteCreateResponse>> {
  const parsed = botNoteSchema.safeParse(body)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
  }

  const { channel_id, text } = parsed.data
  const { supabase, siteId } = ctx

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('id')
    .eq('id', channel_id)
    .eq('site_id', siteId)
    .single()

  if (!channel) return err('NOT_FOUND', 'Channel not found', 404)

  const { data: inserted, error } = await supabase
    .from('youtube_notes')
    .insert({
      site_id: siteId,
      channel_id: channel_id,
      author_name: 'Cowork',
      text,
      is_bot: true,
      source: 'cowork',
    })
    .select('id')
    .single()

  if (error || !inserted) {
    Sentry.captureException(error, { tags: { component: 'pipeline-analytics-notes' } })
    return err('DB_ERROR', 'Failed to create note', 500)
  }

  return ok({ ok: true, id: inserted.id as string })
}
