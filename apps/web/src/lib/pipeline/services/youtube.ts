import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { getIsoWeek } from '@/lib/youtube/analytics-sync'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { PatchPayloadSchema } from '@/lib/youtube/intelligence-schemas'
import { BatchVariantUpsertSchema, TestTypeSchema } from '@/lib/youtube/ab-schemas'
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
