import type {
  Axis,
  AxisScore,
  AxisWeights,
  ChannelBaseline,
  ChannelTier,
  DailyViewPoint,
  Grade,
  OutlierResult,
  TrendData,
  TrendDirection,
  VideoLifecycle,
  VideoScore,
  VideoScoreInput,
  UnavailableAxis,
} from './scoring-types'
import { latestRow, latestRowPerVideo } from './rolling-window'
import { GRADE_THRESHOLDS, LOG_TRANSFORM_AXES, SIGMOID_K } from './scoring-types'

export function sigmoid(x: number, k: number, midpoint: number): number {
  const raw = 100 / (1 + Math.exp(-k * (x - midpoint)))
  return Math.max(1, Math.min(99, raw))
}

export function prepareAxisInput(axis: Axis, rawValue: number): number {
  if (LOG_TRANSFORM_AXES.includes(axis)) {
    // Sign-preserving log transform: handles negative values (e.g. negative growth velocity)
    const sign = rawValue >= 0 ? 1 : -1
    return sign * Math.log2(Math.abs(rawValue) + 1)
  }
  return rawValue
}

const TIER_MODIFIERS: Record<ChannelTier, { ctr: number; retention: number }> = {
  nano: { ctr: 0.5, retention: 6 },
  micro: { ctr: 0.3, retention: 3 },
  small: { ctr: 0, retention: 0 },
  medium: { ctr: -0.3, retention: -3 },
  large: { ctr: -0.5, retention: -5 },
}

export function getChannelTier(subscriberCount: number): ChannelTier {
  if (subscriberCount < 1000) return 'nano'
  if (subscriberCount < 10000) return 'micro'
  if (subscriberCount < 100000) return 'small'
  if (subscriberCount < 1000000) return 'medium'
  return 'large'
}

/**
 * Weighted least-squares slope of TRUE daily view counts, as a percentage of
 * the mean.
 *
 * Kept correct and exported for the day a genuine daily source exists, but
 * nothing calls it with real data today: `youtube_video_analytics` stores
 * rolling-window totals, and those are neither summable nor differenceable
 * into daily counts (see `GROWTH_UNAVAILABLE` in `scoreVideo`).
 */
export function computeGrowthVelocity(dailyViews: DailyViewPoint[], recencyExponent: number): number {
  if (dailyViews.length < 7) return 0

  // Sort by date to handle gaps correctly
  const sorted = [...dailyViews].sort((a, b) => a.date.localeCompare(b.date))
  const earliest = new Date(sorted[0]!.date).getTime()
  const n = sorted.length
  let sumW = 0, sumWX = 0, sumWY = 0, sumWXX = 0, sumWXY = 0

  for (let i = 0; i < n; i++) {
    const x = Math.round((new Date(sorted[i]!.date).getTime() - earliest) / 86400000)
    const w = Math.pow(x + 1, recencyExponent)
    sumW += w
    sumWX += w * x
    sumWY += w * sorted[i]!.views
    sumWXX += w * x * x
    sumWXY += w * x * sorted[i]!.views
  }

  const denominator = sumW * sumWXX - sumWX * sumWX
  if (denominator === 0) return 0
  const slope = (sumW * sumWXY - sumWX * sumWY) / denominator
  const meanViews = sumWY / sumW
  if (meanViews < 1) return 0
  return (slope / meanViews) * 100
}

/**
 * Bonus for an old video that still pulls more than the channel's typical video.
 *
 * Both sides are now the SAME unit — views over one rolling sync window. The
 * previous version compared one video's mean against `channelDailyMean`, which
 * was the summed (inflated) channel-wide total divided by the number of sync
 * dates: a channel figure weighed against a per-video figure, so the bonus was
 * decided by how many videos the channel had and how often the cron had run.
 */
export function computeEvergreenBonus(
  ageDays: number,
  windowViews: number[],
  channelMeanWindowViews: number,
): number {
  if (ageDays <= 180 || windowViews.length < 14) return 0
  if (channelMeanWindowViews <= 0) return 0
  const videoMean = windowViews.reduce((a, b) => a + b, 0) / windowViews.length
  if (videoMean < channelMeanWindowViews) return 0
  const stdDev = Math.sqrt(windowViews.reduce((sum, v) => sum + Math.pow(v - videoMean, 2), 0) / windowViews.length)
  if (videoMean === 0 || stdDev / videoMean > 0.8) return 0
  return Math.min(8, Math.max(3, Math.round((videoMean / channelMeanWindowViews) * 2.5)))
}

export function getAxisWeights(videoAgeDays: number): AxisWeights {
  if (videoAgeDays < 7) {
    return { ctr: 0.30, retention: 0.30, reach: 0.13, engagement: 0.15, growth: 0.04, sub_impact: 0.08 }
  }
  return { ctr: 0.25, retention: 0.25, reach: 0.15, engagement: 0.15, growth: 0.12, sub_impact: 0.08 }
}

export function assignGrade(score: number): Grade {
  if (score >= GRADE_THRESHOLDS.A) return 'A'
  if (score >= GRADE_THRESHOLDS.B) return 'B'
  if (score >= GRADE_THRESHOLDS.C) return 'C'
  return 'D'
}

export function getLifecycle(ageDays: number): VideoLifecycle {
  if (ageDays < 7) return 'fresh'
  if (ageDays <= 90) return 'maturing'
  if (ageDays <= 180) return 'established'
  return 'evergreen'
}

function getRecencyExponent(ageDays: number): number {
  if (ageDays < 7) return 2.0
  if (ageDays <= 90) return 1.5
  return 1.0
}

function computeReachDiversity(sources: VideoScoreInput['trafficSources']): number {
  if (!sources) return 0
  return computeReachDiversityFromRecord(sources as unknown as Record<string, number>)
}

/**
 * Why the growth axis carries no score.
 *
 * `computeGrowthVelocity` needs a series of TRUE daily view counts. Every row
 * of `youtube_video_analytics` is instead the total over a ROLLING window, so:
 *
 *   - summing the rows multiplies the same views by the number of syncs, and
 *   - differencing them gives `daily(D) - daily(D - windowLength)`, not
 *     `daily(D)`. Production proves it: on 2026-09-22, 7 of 233 consecutive
 *     differences on UCRHtzTwaEpcjspAS2hbqmrA were NEGATIVE, and one video's
 *     series ran 10,10,9,9,8,...,4. Daily view counts cannot be negative.
 *
 * Feeding the regression a flat series returned velocity 0 for every video,
 * which sigmoid turned into a definite mid-scale score weighted at 12% of the
 * grade — a measurement manufactured out of nothing. The axis is therefore
 * reported as unavailable and excluded from the weighted sum. It revives on
 * its own the day a genuine daily source fills `dailyViews`.
 */
export const GROWTH_UNAVAILABLE =
  'youtube_video_analytics stores rolling-window totals, not daily counts: a growth rate cannot be derived from them'

export function scoreVideo(input: VideoScoreInput, baseline: ChannelBaseline): VideoScore {
  const rawAge = (Date.now() - new Date(input.publishedAt).getTime()) / 86400000
  const ageDays = Number.isFinite(rawAge) && rawAge >= 0 ? Math.floor(rawAge) : 0
  const lifecycle = getLifecycle(ageDays)
  const weights = getAxisWeights(ageDays)
  const recencyExp = getRecencyExponent(ageDays)

  const tier = getChannelTier(baseline.subscriberCount)
  const tierMod = TIER_MODIFIERS[tier]

  const reachDiversity = computeReachDiversity(input.trafficSources)
  const subImpactRaw = input.impressions > 0 ? (input.subscribersGained / input.impressions) * 1000 : 0

  // When traffic sources are unavailable, fall back to view_count relative performance.
  // Log-scale the ratio so outlier detection can differentiate videos by actual views.
  let reachRaw = reachDiversity
  let reachMidpoint = baseline.medianReach
  if (reachRaw === 0 && input.viewCount > 0 && baseline.medianViewCount > 0) {
    reachRaw = Math.log2(input.viewCount + 1)
    reachMidpoint = Math.log2(baseline.medianViewCount + 1)
  }

  // `axisInputs` omits an axis entirely when its input does not exist. Adding a
  // key here with a placeholder value is how missing data becomes a claim.
  const axisInputs: Partial<Record<Axis, { raw: number; midpoint: number }>> = {
    ctr: { raw: input.ctr, midpoint: baseline.medianCtr - tierMod.ctr },
    retention: { raw: input.avgViewPercentage, midpoint: baseline.medianRetention - tierMod.retention },
    reach: { raw: reachRaw, midpoint: reachMidpoint },
    engagement: { raw: input.engagementRate, midpoint: baseline.medianEngagement },
    sub_impact: { raw: subImpactRaw, midpoint: baseline.medianSubImpact },
  }

  const unavailableAxes: UnavailableAxis[] = []
  for (const axis of Object.keys(weights) as Axis[]) {
    if (axisInputs[axis] === undefined) {
      unavailableAxes.push({ axis, reason: axis === 'growth' ? GROWTH_UNAVAILABLE : 'no input' })
    }
  }

  // Renormalize over the axes that survived, so `overall` stays on the same
  // 0-100 scale instead of being silently capped by the missing axis's weight.
  const availableAxes = (Object.keys(weights) as Axis[]).filter(a => axisInputs[a] !== undefined)
  const weightSum = availableAxes.reduce((sum, a) => sum + weights[a]!, 0)

  const axes: AxisScore[] = availableAxes.map(axis => {
    const { raw, midpoint } = axisInputs[axis]!
    const prepared = prepareAxisInput(axis, raw)
    let normalized = sigmoid(prepared, SIGMOID_K[axis]!, midpoint)
    if (Number.isNaN(normalized)) normalized = 50
    const weight = weightSum > 0 ? weights[axis]! / weightSum : 0
    return { axis, raw, weight, normalized, weighted: normalized * weight }
  })

  const windowViewValues = input.rollingViews.map(d => d.windowViews)
  const evergreenBonus = computeEvergreenBonus(ageDays, windowViewValues, baseline.channelMeanWindowViews)

  const overall = Math.min(100, axes.reduce((sum, a) => sum + a.weighted, 0) + evergreenBonus)
  const grade = assignGrade(overall)

  return { videoId: input.videoId, overall, grade, axes, unavailableAxes, evergreenBonus, lifecycle, ageDays }
}

export function computeOutliers(
  videoScores: { videoId: string; score: number }[],
  axis: Axis,
): OutlierResult[] {
  if (videoScores.length < 5) return []

  const scores = videoScores.map(v => v.score)
  const sorted = [...scores].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
  const deviations = scores.map(s => Math.abs(s - median))
  const sortedDev = [...deviations].sort((a, b) => a - b)
  const midDev = Math.floor(sortedDev.length / 2)
  const mad = sortedDev.length % 2 === 0 ? (sortedDev[midDev - 1]! + sortedDev[midDev]!) / 2 : sortedDev[midDev]!

  let effectiveMad = mad
  if (effectiveMad === 0) {
    // Fallback: use IQR / 1.4826 (consistent estimator of std dev from IQR)
    const q1Idx = Math.floor(sorted.length * 0.25)
    const q3Idx = Math.floor(sorted.length * 0.75)
    const iqr = sorted[q3Idx]! - sorted[q1Idx]!
    effectiveMad = iqr / 1.4826
    if (effectiveMad === 0) return [] // Truly all identical
  }

  return videoScores
    .map(v => {
      const modifiedZ = (0.6745 * (v.score - median)) / effectiveMad
      if (Math.abs(modifiedZ) <= 2.5) return null
      return {
        videoId: v.videoId,
        axis,
        modifiedZ,
        direction: modifiedZ > 0 ? 'positive' as const : 'negative' as const,
      }
    })
    .filter((r): r is OutlierResult => r !== null)
}

export interface BaselineDailyRow {
  date: string
  views: number
  likes?: number
  comments?: number
  shares?: number
  subscribers_gained?: number
  impressions?: number
}

export interface BaselineVideoInput {
  ctr: number | null
  avg_view_percentage: number | null
  traffic_sources?: unknown
  view_count?: number | null
}

export function computeReachDiversityFromRecord(sources: Record<string, number> | null): number {
  if (!sources) return 0
  const keys = ['browse', 'search', 'suggested', 'external', 'direct', 'notifications', 'playlists']
  const values = keys.map(k => sources[k] ?? 0)
  const total = values.reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  const probs = values.map(v => v / total).filter(p => p > 0)
  const entropy = -probs.reduce((sum, p) => sum + p * Math.log2(p), 0)
  const maxEntropy = Math.log2(probs.length)
  return maxEntropy > 0 ? (entropy / maxEntropy) * 100 : 0
}

export function computeBaseline(
  videos: BaselineVideoInput[],
  dailyByVideo: Map<string, Array<BaselineDailyRow>>,
  subscriberCount: number,
): ChannelBaseline {
  const ctrs = videos.map(v => v.ctr ?? 0).filter(c => c > 0).sort((a, b) => a - b)
  const retentions = videos.map(v => v.avg_view_percentage ?? 0).filter(r => r > 0).sort((a, b) => a - b)
  const reachDiversities = videos
    .map(v => computeReachDiversityFromRecord(v.traffic_sources as Record<string, number> | null))
    .filter(r => r > 0)
    .sort((a, b) => a - b)
  const viewCounts = videos.map(v => v.view_count ?? 0).filter(c => c > 0).sort((a, b) => a - b)

  // Each video contributes its CURRENT window total exactly once. The old code
  // flattened every row of every video and summed them, then divided by the
  // number of distinct sync dates — inflating by the sync count AND mixing a
  // channel-wide figure with the per-video figure it was later compared to.
  const latestWindowTotals: number[] = []
  for (const rows of dailyByVideo.values()) {
    const newest = latestRow(rows)
    if (newest !== null) latestWindowTotals.push(newest.views)
  }
  const channelMeanWindowViews = latestWindowTotals.length > 0
    ? latestWindowTotals.reduce((a, b) => a + b, 0) / latestWindowTotals.length
    : 0

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0
    const mid = Math.floor(arr.length / 2)
    return arr.length % 2 === 0 ? (arr[mid - 1]! + arr[mid]!) / 2 : arr[mid]!
  }

  // Per-video engagement / sub-impact, read off each video's most recent row.
  // Every metric on a row covers the same rolling window, so the ratios between
  // them are meaningful — whereas summing rows inflated numerator and
  // denominator by the sync count each and drowned the real figure in noise.
  const cutoff28d = Date.now() - 28 * 86400000
  const engagementRates: number[] = []
  const subImpacts: number[] = []

  for (const [, rows] of dailyByVideo) {
    const recent = rows.filter(r => new Date(r.date).getTime() > cutoff28d)
    const newest = latestRow(recent)
    if (newest === null) continue

    const windowViews = newest.views
    const windowEngagement = (newest.likes ?? 0) + (newest.comments ?? 0) + (newest.shares ?? 0)

    if (windowViews > 0) {
      engagementRates.push((windowEngagement / windowViews) * 100)
    }
    const windowImpressions = newest.impressions ?? 0
    if (windowImpressions > 0) {
      subImpacts.push(((newest.subscribers_gained ?? 0) / windowImpressions) * 1000)
    }

    // No growth velocity: see GROWTH_UNAVAILABLE. A median built from a metric
    // that is always 0 is not a baseline, it is a fiction with a mean.
  }

  engagementRates.sort((a, b) => a - b)
  subImpacts.sort((a, b) => a - b)

  return {
    medianCtr: median(ctrs),
    medianRetention: median(retentions),
    medianReach: median(reachDiversities),
    medianEngagement: engagementRates.length > 0 ? median(engagementRates) : 4.0,
    medianSubImpact: subImpacts.length > 0 ? median(subImpacts) : 0.5,
    channelMeanWindowViews,
    subscriberCount,
    medianViewCount: median(viewCounts),
  }
}

export function computeTrend(weeklyScores: number[]): TrendData {
  if (weeklyScores.length < 3) {
    return { direction: 'flat', velocity: 0, streak: 0, label: null }
  }

  const weights = [0.4, 0.3, 0.2, 0.1]
  const deltas: number[] = []
  for (let i = 1; i < weeklyScores.length; i++) {
    deltas.push(weeklyScores[i]! - weeklyScores[i - 1]!)
  }

  let weightedDelta = 0
  let weightSum = 0
  for (let i = deltas.length - 1; i >= 0 && deltas.length - 1 - i < weights.length; i--) {
    const w = weights[deltas.length - 1 - i]!
    weightedDelta += deltas[i]! * w
    weightSum += w
  }
  const velocity = weightSum > 0 ? weightedDelta / weightSum : 0

  let direction: TrendDirection = 'flat'
  if (velocity > 1.5) direction = 'up'
  else if (velocity < -1.5) direction = 'down'

  let streak = 0
  if (direction !== 'flat') {
    for (let i = deltas.length - 1; i >= 0; i--) {
      if ((direction === 'up' && deltas[i]! > 0) || (direction === 'down' && deltas[i]! < 0)) {
        streak++
      } else break
    }
  }

  let label: string | null = null
  if (Math.abs(velocity) > 5) {
    label = velocity > 0 ? 'Acelerando rápido' : 'Queda acentuada'
  } else if (streak >= 3) {
    label = velocity > 0 ? 'Tendência de alta' : 'Tendência de queda'
  }

  return { direction, velocity, streak, label }
}
