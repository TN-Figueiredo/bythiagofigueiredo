import type { DailyMetric, PredictionResult } from '../types.js'

/**
 * Predict future clicks using OLS (Ordinary Least Squares) linear regression.
 *
 * @param daily - Historical daily metrics (must be sorted by date ascending)
 * @param forecastDays - Number of future days to predict
 * @returns Prediction result with slope, intercept, confidence, and predicted values
 */
export function predictClicks(daily: DailyMetric[], forecastDays: number): PredictionResult {
  const n = daily.length

  if (n < 2) {
    return {
      forecastDays,
      predictedClicks: Array(forecastDays).fill(0) as number[],
      slope: 0,
      intercept: 0,
      confidence: 0,
      dates: generateFutureDates(daily[daily.length - 1]?.date ?? todayStr(), forecastDays),
    }
  }

  // x = 0, 1, 2, ... n-1 (day index)
  // y = clicks per day
  const xs = daily.map((_, i) => i)
  const ys = daily.map((d) => d.clicks)

  const { slope, intercept } = olsRegression(xs, ys)
  const rSquared = computeRSquared(xs, ys, slope, intercept)

  // Data sufficiency: 1.0 when >=30 data points, scales linearly below
  const dataSufficiency = Math.min(1, n / 30)
  const confidence = Math.max(0, Math.min(1, rSquared * dataSufficiency))

  // Generate predictions
  const lastDate = daily[n - 1]!.date
  const dates = generateFutureDates(lastDate, forecastDays)
  const predictedClicks: number[] = []

  for (let i = 0; i < forecastDays; i++) {
    const x = n + i
    const predicted = Math.max(0, Math.round(slope * x + intercept))
    predictedClicks.push(predicted)
  }

  return {
    forecastDays,
    predictedClicks,
    slope,
    intercept,
    confidence,
    dates,
  }
}

/**
 * OLS linear regression: y = slope * x + intercept
 */
function olsRegression(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  for (let i = 0; i < n; i++) {
    sumX += xs[i]!
    sumY += ys[i]!
    sumXY += xs[i]! * ys[i]!
    sumX2 += xs[i]! * xs[i]!
  }

  const denominator = n * sumX2 - sumX * sumX
  if (denominator === 0) return { slope: 0, intercept: sumY / n }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  return { slope, intercept }
}

/**
 * Compute R-squared (coefficient of determination)
 */
function computeRSquared(xs: number[], ys: number[], slope: number, intercept: number): number {
  const n = ys.length
  const meanY = ys.reduce((a, b) => a + b, 0) / n

  let ssRes = 0
  let ssTot = 0

  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i]! + intercept
    ssRes += (ys[i]! - predicted) ** 2
    ssTot += (ys[i]! - meanY) ** 2
  }

  if (ssTot === 0) return 0

  return 1 - ssRes / ssTot
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function generateFutureDates(lastDate: string, count: number): string[] {
  const dates: string[] = []
  const base = new Date(lastDate + 'T00:00:00Z')

  for (let i = 1; i <= count; i++) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }

  return dates
}
