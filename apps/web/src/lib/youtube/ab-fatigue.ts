/**
 * Fatigue detection via log-linear regression on daily views time series.
 *
 * Algorithm:
 * 1. Fit OLS regression on log(views) vs log(days_since_publish) using last 60 days
 * 2. Compute per-day residuals (actual - predicted)
 * 3. Compute 7-day rolling mean of residuals
 * 4. Alert when 7-day rolling mean z-score < -1.5 against the video's own residual distribution
 */

interface DailyMetric {
  date: string
  views: number
}

interface FatigueResult {
  isFatigued: boolean
  zScore: number
  expectedCtr: number
  actualCtr: number
}

export function detectFatigue(
  dailyMetrics: DailyMetric[],
  publishedAt: string,
): FatigueResult | null {
  // Need at least 30 days of data with meaningful views
  const validDays = dailyMetrics.filter(d => d.views >= 50)
  if (validDays.length < 30) return null

  // Compute days since publish for each data point
  const publishDate = new Date(publishedAt).getTime()
  const points = validDays.map(d => ({
    x: Math.log(Math.max((new Date(d.date).getTime() - publishDate) / 86400000, 1)),
    y: Math.log(Math.max(d.views, 1)),
    views: d.views,
  }))

  // OLS regression: y = a + b*x (log-log space)
  const n = points.length
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0)

  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return null

  const b = (n * sumXY - sumX * sumY) / denom
  const a = (sumY - b * sumX) / n

  // Compute residuals
  const residuals = points.map(p => p.y - (a + b * p.x))

  // 7-day rolling mean of the LAST 7 residuals
  const last7 = residuals.slice(-7)
  if (last7.length < 7) return null
  const rollingMean = last7.reduce((s, r) => s + r, 0) / last7.length

  // Z-score against full residual distribution
  const meanResidual = residuals.reduce((s, r) => s + r, 0) / residuals.length
  const stdResidual = Math.sqrt(
    residuals.reduce((s, r) => s + (r - meanResidual) ** 2, 0) / residuals.length,
  )

  if (stdResidual === 0) return null

  const zScore = (rollingMean - meanResidual) / stdResidual

  // Expected views = exp(a + b * log(current_age))
  const currentAge = Math.log(Math.max((Date.now() - publishDate) / 86400000, 1))
  const expectedLogViews = a + b * currentAge
  const expectedCtr = Math.exp(expectedLogViews)
  const actualCtr = validDays[validDays.length - 1]!.views

  return {
    isFatigued: zScore < -1.5,
    zScore: Math.round(zScore * 100) / 100,
    expectedCtr: Math.round(expectedCtr * 10000) / 10000,
    actualCtr: Math.round(actualCtr * 10000) / 10000,
  }
}

export interface FatigueCandidate {
  videoId: string
  publishedAt: string
  metrics: DailyMetric[]
}

export function filterFatigueCandidates(
  videos: Array<{ id: string; published_at: string; view_count: number }>,
  activeTestVideoIds: Set<string>,
): Array<{ id: string; published_at: string }> {
  const thirtyDaysAgo = Date.now() - 30 * 86400000
  return videos.filter(v => {
    if (!v.published_at) return false
    if (new Date(v.published_at).getTime() > thirtyDaysAgo) return false // age >= 30d
    if (activeTestVideoIds.has(v.id)) return false
    return true
  })
}
