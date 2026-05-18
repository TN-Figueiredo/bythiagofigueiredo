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
} from './scoring-types'
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
  nano: { ctr: 0.5, retention: 0.3 },
  micro: { ctr: 0.2, retention: 0.1 },
  small: { ctr: 0, retention: 0 },
  medium: { ctr: -0.1, retention: -0.1 },
  large: { ctr: -0.3, retention: -0.2 },
}

export function getChannelTier(subscriberCount: number): ChannelTier {
  if (subscriberCount < 1000) return 'nano'
  if (subscriberCount < 10000) return 'micro'
  if (subscriberCount < 100000) return 'small'
  if (subscriberCount < 1000000) return 'medium'
  return 'large'
}

export function computeGrowthVelocity(dailyViews: DailyViewPoint[], recencyExponent: number): number {
  if (dailyViews.length < 7) return 0
  const n = dailyViews.length
  let sumW = 0, sumWX = 0, sumWY = 0, sumWXX = 0, sumWXY = 0

  for (let i = 0; i < n; i++) {
    const w = Math.pow(i + 1, recencyExponent)
    sumW += w
    sumWX += w * i
    sumWY += w * dailyViews[i]!.views
    sumWXX += w * i * i
    sumWXY += w * i * dailyViews[i]!.views
  }

  const denominator = sumW * sumWXX - sumWX * sumWX
  if (denominator === 0) return 0
  const slope = (sumW * sumWXY - sumWX * sumWY) / denominator
  const meanViews = sumWY / sumW
  if (meanViews < 1) return 0
  return (slope / meanViews) * 100
}

export function computeEvergreenBonus(ageDays: number, dailyViews: number[], channelDailyMean: number): number {
  if (ageDays <= 180 || dailyViews.length < 14) return 0
  const videoMean = dailyViews.reduce((a, b) => a + b, 0) / dailyViews.length
  if (videoMean < channelDailyMean) return 0
  const stdDev = Math.sqrt(dailyViews.reduce((sum, v) => sum + Math.pow(v - videoMean, 2), 0) / dailyViews.length)
  if (videoMean === 0 || stdDev / videoMean > 0.8) return 0
  return Math.min(8, Math.max(3, Math.round((videoMean / channelDailyMean) * 2.5)))
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

function getLifecycle(ageDays: number): VideoLifecycle {
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
  const values = [sources.browse, sources.search, sources.suggested, sources.external, sources.direct, sources.notifications, sources.playlists]
  const total = values.reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  const probs = values.map(v => v / total).filter(p => p > 0)
  const entropy = -probs.reduce((sum, p) => sum + p * Math.log2(p), 0)
  const maxEntropy = Math.log2(probs.length)
  return maxEntropy > 0 ? (entropy / maxEntropy) * 100 : 0
}

export function scoreVideo(input: VideoScoreInput, baseline: ChannelBaseline): VideoScore {
  const ageDays = Math.floor((Date.now() - new Date(input.publishedAt).getTime()) / 86400000)
  const lifecycle = getLifecycle(ageDays)
  const weights = getAxisWeights(ageDays)
  const recencyExp = getRecencyExponent(ageDays)

  const tier = getChannelTier(baseline.subscriberCount)
  const tierMod = TIER_MODIFIERS[tier]

  const velocity = computeGrowthVelocity(input.dailyViews, recencyExp)
  const reachDiversity = computeReachDiversity(input.trafficSources)
  const subImpactRaw = input.impressions > 0 ? (input.subscribersGained / input.impressions) * 1000 : 0

  const axisInputs: Record<Axis, { raw: number; midpoint: number }> = {
    ctr: { raw: input.ctr, midpoint: baseline.medianCtr - tierMod.ctr },
    retention: { raw: input.avgViewPercentage, midpoint: baseline.medianRetention - tierMod.retention },
    reach: { raw: reachDiversity, midpoint: baseline.medianReach },
    engagement: { raw: input.engagementRate, midpoint: baseline.medianEngagement },
    growth: { raw: velocity, midpoint: prepareAxisInput('growth', baseline.medianGrowth) },
    sub_impact: { raw: subImpactRaw, midpoint: baseline.medianSubImpact },
  }

  const axes: AxisScore[] = (Object.keys(weights) as Axis[]).map(axis => {
    const { raw, midpoint } = axisInputs[axis]!
    const prepared = prepareAxisInput(axis, raw)
    let normalized = sigmoid(prepared, SIGMOID_K[axis]!, midpoint)
    if (Number.isNaN(normalized)) normalized = 50
    const weight = weights[axis]!
    return { axis, raw, normalized, weight, weighted: normalized * weight }
  })

  const dailyViewValues = input.dailyViews.map(d => d.views)
  const evergreenBonus = computeEvergreenBonus(ageDays, dailyViewValues, baseline.channelDailyMean)

  const overall = Math.min(100, axes.reduce((sum, a) => sum + a.weighted, 0) + evergreenBonus)
  const grade = assignGrade(overall)

  return { videoId: input.videoId, overall, grade, axes, evergreenBonus, lifecycle, ageDays }
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

  if (mad === 0) return []

  return videoScores
    .map(v => {
      const modifiedZ = (0.6745 * (v.score - median)) / mad
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
