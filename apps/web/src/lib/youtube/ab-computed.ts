interface OutlierResult {
  multiplier: number
  badge: 'blue' | 'purple' | 'red'
}

export function computeOutlierScore(
  currentViews: number,
  predecessorViews: number[],
): OutlierResult | null {
  if (predecessorViews.length < 9) return null

  const sorted = [...predecessorViews].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = Math.max(
    sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2,
    1,
  )

  const multiplier = Math.round(currentViews / median)
  if (multiplier < 2) return null

  const badge = multiplier >= 10 ? 'red' : multiplier >= 5 ? 'purple' : 'blue'
  return { multiplier, badge }
}

interface RevenueRange {
  low: number
  high: number
  currency: 'BRL'
  isDefault: boolean
}

const DEFAULT_RPM: [number, number] = [0.5, 4.0]

export function computeRevenueRange(
  totalViews: number,
  rpm: [number, number] = DEFAULT_RPM,
): RevenueRange {
  const isDefault = rpm[0] === DEFAULT_RPM[0] && rpm[1] === DEFAULT_RPM[1]
  return {
    low: Math.round((totalViews / 1000) * rpm[0]),
    high: Math.round((totalViews / 1000) * rpm[1]),
    currency: 'BRL',
    isDefault,
  }
}

interface DaysRemainingResult {
  days: number
  model: 'exponential' | 'linear'
}

export function computeDaysRemaining(
  dailyImpressions: number[],
  threshold = 50,
): DaysRemainingResult | null {
  if (dailyImpressions.length < 5) return null

  const last5 = dailyImpressions.slice(-5)
  const logValues = last5.map((v, i) => ({ x: i, y: Math.log(Math.max(v, 1)) }))

  const n = logValues.length
  const sumX = logValues.reduce((s, p) => s + p.x, 0)
  const sumY = logValues.reduce((s, p) => s + p.y, 0)
  const sumXY = logValues.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = logValues.reduce((s, p) => s + p.x * p.x, 0)

  const denominator = n * sumX2 - sumX * sumX
  if (denominator === 0) return { days: 999, model: 'linear' }
  const lambda = -((n * sumXY - sumX * sumY) / denominator)

  if (lambda < 0.01 || !isFinite(lambda)) {
    const avgDecrease = (last5[0]! - last5[last5.length - 1]!) / (last5.length - 1)
    if (avgDecrease <= 0) return { days: 999, model: 'linear' }
    const current = last5[last5.length - 1]!
    const days = Math.ceil((current - threshold) / avgDecrease)
    return { days: Math.max(days, 0), model: 'linear' }
  }

  const current = last5[last5.length - 1]!
  if (current <= threshold) return { days: 0, model: 'exponential' }
  const days = Math.ceil(Math.log(current / threshold) / lambda)
  return { days: Math.max(days, 0), model: 'exponential' }
}
