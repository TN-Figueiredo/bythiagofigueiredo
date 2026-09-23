'use server'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { scoreVideo, computeOutliers, computeTrend, computeBaseline } from '@/lib/youtube/scoring'
import type { VideoScoreInput } from '@/lib/youtube/scoring-types'
import { latestRow } from '@/lib/youtube/rolling-window'
import type { CoachingOutput } from '@/lib/youtube/intelligence-types'
import { revalidatePath } from 'next/cache'
import type { AnalysisTaskSnapshot, AnalysisTaskStatus } from '@/lib/youtube/analysis-progress'
import { HISTORY_SOURCES, toHistoryEntry, type HistoryEntry } from '@/lib/youtube/analysis-history'
import { z } from 'zod'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Single source of truth for the coaching source allowlist: the same constant decides which
 * per-source queries are issued and feeds the runtime narrowing, so the two can never drift
 * apart. Adding a source here adds a query — the read stays exhaustive without a second edit.
 */
const COACHING_SOURCES = ['cowork', 'forja'] as const
type CoachingSource = (typeof COACHING_SOURCES)[number]

function isCoachingSource(value: unknown): value is CoachingSource {
  return typeof value === 'string' && (COACHING_SOURCES as readonly string[]).includes(value)
}

export interface ChannelCoachingRow {
  coaching: CoachingOutput
  source: CoachingSource
  generatedLabel: string
}

export interface ChannelCoachingResult extends ChannelCoachingRow {
  /**
   * The newest analysis that actually carries priorities, and only when it is NOT the row
   * above. The screen needs both at once: the banner speaks for the newest analysis, the
   * cards for the newest one with something to show. Null covers the two cases where there
   * is a single provenance to print — no analysis carries priorities, or the newest one
   * already does — so the label can never render the same source and date twice.
   */
  cards: ChannelCoachingRow | null
}

/** jsonb, not TypeScript: `priorities` can be absent, null or a non-array on an old row. */
function hasPriorities(coaching: CoachingOutput): boolean {
  return Array.isArray(coaching.priorities) && coaching.priorities.length > 0
}

/**
 * Reads the channel-level coaching rows from the allowlist {cowork, forja} and returns two
 * things: the newest row (the banner) and the newest row that carries priorities (the cards).
 *
 * ONE READ PER SOURCE, each `.limit(1)`, run in parallel — this replaced a single
 * `.limit(COACHING_SOURCES.length)` read. That read leaned on a guarantee that no longer
 * exists: `idx_youtube_intelligence_channel_dedup` used to be UNIQUE on
 * (site_id, channel_id, source) WHERE video_id IS NULL, so the whole channel-level history
 * was at most one row per source and `.limit(2)` was exhaustive by construction. Migration
 * 20260922000001 dropped that uniqueness on purpose, so the channel analysis could
 * accumulate a history instead of each weekly run erasing the one before it. Against a
 * growing history `.limit(2)` becomes "the two newest rows overall" — after two forja runs
 * it would return two forja rows and bury the Cowork analysis, the exact regression below.
 *
 * Why not one query: "the newest row per source" is `DISTINCT ON (source)`, and PostgREST
 * exposes no DISTINCT ON. The alternatives were a SQL view/RPC (new DB surface plus its own
 * RLS story, for a two-value allowlist) or one wide read deduped in app code (a guess at a
 * window size — the same failure mode, just later). `COACHING_SOURCES.length` single-row
 * reads are exact by construction, scale with the allowlist and not with the history, and
 * each one is served straight off `idx_youtube_intelligence_channel_history`
 * (site_id, channel_id, source, generated_at DESC) with no sort.
 *
 * Semantics: per-source LATEST. An older row of the same source is history — it is kept, and
 * readable, but it never speaks for that source again. Scanning the full history for the
 * newest row with priorities would resurrect an arbitrarily old analysis as today's cards.
 *
 * `.limit(1)` across both sources was the original regression: the forja writes a summary
 * with `priorities: []` by design, so the moment it landed it buried the Cowork analysis and
 * the Health Coach tab went from three cards to a single sentence.
 *
 * The rollback guard is the per-source query itself, not app-layer narrowing: the column is
 * plain TEXT with no CHECK, and a retired `forja_retirada_*` row matches no source in the
 * allowlist, so the UI falls back to the next allowlisted row or to the heuristic branch —
 * proven against a real Postgres in test/integration/youtube-intelligence-forja.test.ts.
 *
 * The runtime check below is the `any` -> union boundary of the untyped service client, and
 * fail-closed defense in depth: should that filter ever regress, an unknown source is
 * dropped rather than badged as "por Cowork".
 */
export async function fetchChannelCoaching(
  channelId: string,
): Promise<ChannelCoachingResult | null> {
  if (!UUID_RE.test(channelId)) throw new Error('invalid_input')
  const { siteId } = await getSiteContext()
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!auth.ok) throw new Error(auth.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  const supabase = getSupabaseServiceClient()

  const perSource = await Promise.all(
    COACHING_SOURCES.map(src =>
      supabase
        .from('youtube_intelligence')
        .select('coaching, generated_at, source')
        .eq('site_id', siteId)
        .eq('channel_id', channelId)
        .is('video_id', null)
        .eq('source', src)
        .not('coaching', 'is', null)
        .eq('type', 'channel')
        .order('generated_at', { ascending: false })
        .limit(1),
    ),
  )

  // A DB error must never fall through as "no analysis": `data` is null on failure, and the
  // empty return below is the caller's signal for "this channel was never analysed", so a
  // statement timeout would render the heuristic diagnosis and claim it is all there is.
  // Throwing keeps the `| null` contract intact — the page still renders the empty state for
  // a real absence, and an outage is now an outage. Same rule as getConnectedYouTubeChannels.
  // One failed source is enough to throw: a partial answer is a wrong answer here, because
  // the surviving source would silently become "the newest analysis".
  for (const res of perSource) {
    if (res.error) {
      throw new Error(`Failed to read the channel coaching rows: ${res.error.message}`)
    }
  }

  // `generatedAt` is the merge key only — it stays out of ChannelCoachingRow so the shape
  // the UI consumes does not grow a field just because the read needs two queries now.
  const ranked: Array<{ row: ChannelCoachingRow; generatedAt: number }> = []
  for (const res of perSource) {
    for (const row of (res.data ?? []) as Array<{ coaching: unknown; generated_at: unknown; source: unknown }>) {
      if (row.coaching == null) continue
      if (!isCoachingSource(row.source)) continue
      if (typeof row.generated_at !== 'string') continue
      const generatedAt = Date.parse(row.generated_at)
      if (Number.isNaN(generatedAt)) continue
      ranked.push({
        generatedAt,
        row: {
          coaching: row.coaching as CoachingOutput,
          source: row.source,
          // Formatted on the server so the label does not depend on the viewer's timezone.
          generatedLabel: new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo',
          }).format(new Date(row.generated_at)),
        },
      })
    }
  }

  // The per-source reads come back in allowlist order, not recency order — this merge is
  // what makes `rows[0]` the newest again, which everything below depends on.
  ranked.sort((a, b) => b.generatedAt - a.generatedAt)
  const rows: ChannelCoachingRow[] = ranked.map(r => r.row)

  const latest = rows[0]
  if (!latest) return null

  // `rows` is already newest-first, so the first match is the newest analysis with priorities.
  const withPriorities = rows.find(r => hasPriorities(r.coaching))

  return {
    ...latest,
    cards: withPriorities !== undefined && withPriorities !== latest ? withPriorities : null,
  }
}

export async function fetchGradesData(channelId: string) {
  if (!UUID_RE.test(channelId)) throw new Error('invalid_input')
  const { siteId } = await getSiteContext()
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!auth.ok) throw new Error(auth.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  const supabase = getSupabaseServiceClient()

  const { data: videos } = await supabase
    .from('youtube_videos')
    .select('id, youtube_video_id, title, thumbnail_url, published_at, view_count, ctr, impressions, avg_view_percentage, avg_view_duration_seconds, retention_curve, traffic_sources')
    .eq('channel_id', channelId)
    .eq('site_id', siteId)
    .order('published_at', { ascending: false })
    .limit(50)

  if (!videos?.length) return { videos: [], outliers: [] }

  const videoIds = videos.map(v => v.id)
  const { data: dailyData } = await supabase
    .from('youtube_video_analytics')
    .select('youtube_video_id, date, views, likes, comments, shares, subscribers_gained, impressions')
    .eq('site_id', siteId)
    .in('youtube_video_id', videoIds)
    .gte('date', new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]!)

  const dailyByVideo = new Map<string, Array<{ date: string; views: number; likes: number; comments: number; shares: number; subscribers_gained: number; impressions: number }>>()
  for (const row of dailyData ?? []) {
    const arr = dailyByVideo.get(row.youtube_video_id) ?? []
    arr.push(row)
    dailyByVideo.set(row.youtube_video_id, arr)
  }

  const { data: gradeHistory } = await supabase
    .from('video_grade_history')
    .select('youtube_video_id, score, week_iso')
    .eq('site_id', siteId)
    .in('youtube_video_id', videoIds)
    .order('week_iso', { ascending: false })
    .limit(200)

  const historyByVideo = new Map<string, number[]>()
  for (const h of gradeHistory ?? []) {
    const arr = historyByVideo.get(h.youtube_video_id) ?? []
    arr.push(Number(h.score))
    historyByVideo.set(h.youtube_video_id, arr)
  }

  const { data: cycles } = await supabase
    .from('optimization_cycles')
    .select('youtube_video_id, state')
    .eq('site_id', siteId)
    .not('state', 'in', '("resolved","exhausted","unmonitored")')

  const cycleByVideo = new Map((cycles ?? []).map(c => [c.youtube_video_id, c.state]))

  const { data: intelligence } = await supabase
    .from('youtube_intelligence')
    .select('video_id, recommendations, analysis_text')
    .eq('site_id', siteId)
    .not('video_id', 'is', null)

  const intelByVideo = new Map((intelligence ?? []).map(i => [i.video_id, i]))

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('subscriber_count')
    .eq('id', channelId)
    .eq('site_id', siteId)
    .single()

  const baseline = computeBaseline(videos, dailyByVideo, channel?.subscriber_count ?? 0)

  const scoredVideos = videos.map(video => {
    const daily = dailyByVideo.get(video.id) ?? []
    const last28 = daily.filter(d => new Date(d.date).getTime() > Date.now() - 28 * 86400000)
    // Every row already holds the rolling-window TOTAL, so the newest row is the
    // answer. Summing 28 rows reported ~17x the real views to the Health Coach.
    const newest = latestRow(last28)
    const totalViews = newest?.views ?? 0
    const totalEng = newest ? newest.likes + newest.comments + newest.shares : 0
    const totalSubs = newest?.subscribers_gained ?? 0

    const input: VideoScoreInput = {
      videoId: video.id,
      publishedAt: video.published_at ?? new Date().toISOString(),
      // NULL passes through as NULL. In production 0 of 35 videos have ctr,
      // impressions or avg_view_percentage (the YouTube Analytics API v2 does
      // not serve them). `?? 0` turned that absence into CTR ~63 and retention
      // 99 on this very tab — the channel medians are 0 too, so a placeholder
      // 0 lands above the tier-shifted sigmoid midpoint for every video.
      ctr: video.ctr,
      avgViewPercentage: video.avg_view_percentage,
      impressions: video.impressions,
      trafficSources: (video.traffic_sources && typeof video.traffic_sources === 'object' && !Array.isArray(video.traffic_sources))
        ? video.traffic_sources as VideoScoreInput['trafficSources']
        : null,
      // No analytics row in the window = no measurement, not "nobody engaged".
      engagementRate: totalViews > 0 ? (totalEng / totalViews) * 100 : null,
      rollingViews: last28.map(d => ({ date: d.date, windowViews: d.views })),
      subscribersGained: totalSubs,
      viewCount: video.view_count ?? 0,
    }

    const scored = scoreVideo(input, baseline)
    const weeklyScores = historyByVideo.get(video.id) ?? []
    const trend = computeTrend([...weeklyScores].reverse())
    const intel = intelByVideo.get(video.id)
    const rec = intel?.recommendations as { reasoning?: string; suggested_variant_description?: string } | null

    return {
      videoId: video.id,
      title: video.title ?? '',
      thumbnailUrl: video.thumbnail_url ?? '',
      grade: scored.grade,
      score: scored.overall,
      axes: scored.axes.map(a => ({ axis: a.axis, normalized: a.normalized })),
      // What could NOT be scored, and why — the screen shows these as
      // "indisponível" instead of letting the axis vanish or read as 0.
      unavailableAxes: scored.unavailableAxes,
      trend: { direction: trend.direction, velocity: trend.velocity },
      optimizationState: cycleByVideo.get(video.id) ?? null,
      retentionCurve: video.retention_curve as number[] | null,
      avgViewPercentage: video.avg_view_percentage,
      diagnosis: rec?.reasoning ?? null,
      recommendation: rec?.suggested_variant_description ?? null,
      trafficSources: video.traffic_sources as Record<string, number> | null,
    }
  })

  const axes: Array<'ctr' | 'retention' | 'reach' | 'engagement' | 'growth' | 'sub_impact'> = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']
  const outliers = axes.flatMap(axis => {
    // A video without a score on this axis is dropped, not scored 50. `?? 50`
    // fed a made-up median into the outlier statistics and let an unmeasured
    // axis (growth) decide which videos looked anomalous.
    const axisScores = scoredVideos.flatMap(v => {
      const found = v.axes.find(a => a.axis === axis)
      return found === undefined ? [] : [{ videoId: v.videoId, score: found.normalized }]
    })
    return computeOutliers(axisScores, axis)
  })

  return { videos: scoredVideos, outliers }
}

export async function requestIntelligenceAnalysis(channelId: string) {
  if (!UUID_RE.test(channelId)) throw new Error('invalid_input')
  const { siteId } = await getSiteContext()
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!auth.ok) throw new Error(auth.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  const supabase = getSupabaseServiceClient()

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('id')
    .eq('id', channelId)
    .eq('site_id', siteId)
    .single()
  if (!channel) return { error: 'channel_not_found' }

  const { data: existing } = await supabase
    .from('youtube_intelligence_tasks')
    .select('id, requested_at')
    .eq('site_id', siteId)
    .eq('channel_id', channelId)
    .in('status', ['pending', 'running'])
    .limit(1)
    .single()

  if (existing) return { error: 'already_active' }

  const { data: recent } = await supabase
    .from('youtube_intelligence_tasks')
    .select('completed_at')
    .eq('site_id', siteId)
    .eq('channel_id', channelId)
    .eq('trigger_type', 'manual')
    .order('requested_at', { ascending: false })
    .limit(1)
    .single()

  if (recent?.completed_at) {
    const hoursSince = (Date.now() - new Date(recent.completed_at).getTime()) / 3600000
    if (hoursSince < 24) return { error: 'cooldown', hours_remaining: Math.ceil(24 - hoursSince) }
  }

  // Checked: an unchecked insert answered `ok` on failure, the button said "Solicitado!" and
  // the request simply never existed — the "it just disappears" the owner saw on 23/09.
  const { error: insertError } = await supabase.from('youtube_intelligence_tasks').insert({
    site_id: siteId,
    channel_id: channelId,
    trigger_type: 'manual',
  })
  if (insertError) return { error: 'insert_failed' }

  return { ok: true }
}

/**
 * The newest task for the channel, for the progress card. Polled every 15 s while a task is
 * pending or running. Closed column list: `result_summary` carries the claimer's key id and
 * never goes to the browser; `error_message` is the forja's short reason code.
 */
export async function fetchLatestAnalysisTask(channelId: string): Promise<AnalysisTaskSnapshot | null> {
  if (!UUID_RE.test(channelId)) throw new Error('invalid_input')
  const { siteId } = await getSiteContext()
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!auth.ok) throw new Error(auth.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('youtube_intelligence_tasks')
    .select('id, status, requested_at, started_at, completed_at, failed_at, updated_at, retry_count, error_message')
    .eq('site_id', siteId)
    .eq('channel_id', channelId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Failed to read the analysis task: ${error.message}`)
  if (!data) return null
  if (!isTaskStatus(data.status)) return null
  return {
    id: data.id,
    status: data.status,
    requestedAt: data.requested_at,
    startedAt: data.started_at,
    completedAt: data.completed_at,
    failedAt: data.failed_at,
    updatedAt: data.updated_at,
    retryCount: data.retry_count,
    errorMessage: data.error_message,
  }
}

const TASK_STATUSES: readonly AnalysisTaskStatus[] = ['pending', 'running', 'completed', 'failed', 'stale']
function isTaskStatus(v: unknown): v is AnalysisTaskStatus {
  return (TASK_STATUSES as readonly unknown[]).includes(v)
}

/** How many analyses the history lists. The mockup's "ver todas" is deferred until a channel
 *  actually has more than this — at a weekly cadence that is ten weeks away. */
const HISTORY_LIMIT = 10

/**
 * The channel-level analyses, newest first, from both producers. Only allowlisted sources: a
 * retired `forja_retirada_*` row (the rollback path) never reappears here as history.
 */
export async function fetchAnalysisHistory(channelId: string): Promise<HistoryEntry[]> {
  if (!UUID_RE.test(channelId)) throw new Error('invalid_input')
  const { siteId } = await getSiteContext()
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!auth.ok) throw new Error(auth.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('youtube_intelligence')
    .select('id, source, generated_at, coaching, patterns_detected')
    .eq('site_id', siteId)
    .eq('channel_id', channelId)
    .is('video_id', null)
    .eq('type', 'channel')
    .in('source', [...HISTORY_SOURCES])
    .order('generated_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  if (error) throw new Error(`Failed to read the analysis history: ${error.message}`)
  return (data ?? []).flatMap(row => {
    const entry = toHistoryEntry(row)
    return entry ? [entry] : []
  })
}

/* ─── Notes ─── */

const noteInputSchema = z.object({
  channelId: z.string().regex(UUID_RE),
  text: z.string().min(1).max(5000),
})

export interface NoteRow {
  id: string
  author_name: string
  text: string
  is_bot: boolean
  source: string | null
  created_at: string
}

export async function listNotes(channelId: string) {
  if (!UUID_RE.test(channelId)) throw new Error('invalid_input')
  const { siteId } = await getSiteContext()
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!auth.ok) throw new Error(auth.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  const supabase = getSupabaseServiceClient()

  const { data } = await supabase
    .from('youtube_notes')
    .select('id, author_name, text, is_bot, source, created_at')
    .eq('site_id', siteId)
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(100)

  return (data ?? []).map((n: NoteRow) => ({
    id: n.id,
    author: n.author_name,
    text: n.text,
    timestamp: n.created_at,
    isBot: n.is_bot,
  }))
}

export async function createNote(input: { channelId: string; text: string }): Promise<{ ok: boolean; error?: string }> {
  const parsed = noteInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }
  const { channelId, text } = parsed.data

  const { siteId } = await getSiteContext()
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!auth.ok) return { ok: false, error: auth.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden' }

  const supabase = getSupabaseServiceClient()
  const { data: { user } } = await supabase.auth.admin.getUserById(auth.user.id)
  const authorName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Anonimo'

  const { error } = await supabase.from('youtube_notes').insert({
    site_id: siteId,
    channel_id: channelId,
    author_id: auth.user.id,
    author_name: authorName,
    text,
    source: 'manual',
  })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/youtube/analytics')
  return { ok: true }
}

export async function deleteNote(noteId: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(noteId)) return { ok: false, error: 'invalid_input' }
  const { siteId } = await getSiteContext()
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!auth.ok) return { ok: false, error: auth.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden' }

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('youtube_notes')
    .delete()
    .eq('id', noteId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/youtube/analytics')
  return { ok: true }
}

