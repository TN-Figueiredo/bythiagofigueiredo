import type { VariantStats, BayesianResult, ZTestResult } from './ab-types'

export function normalCdf(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.SQRT2
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1.0 + sign * y)
}

export function calculateZTest(a: VariantStats, b: VariantStats): ZTestResult {
  if (a.total_impressions === 0 || b.total_impressions === 0) {
    return { zScore: 0, pValue: 1, significant: false }
  }
  const pA = a.total_clicks / a.total_impressions
  const pB = b.total_clicks / b.total_impressions
  const pPool = (a.total_clicks + b.total_clicks) / (a.total_impressions + b.total_impressions)
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / a.total_impressions + 1 / b.total_impressions))
  if (se === 0) return { zScore: 0, pValue: 1, significant: false }
  const zScore = (pB - pA) / se
  const pValue = 2 * (1 - normalCdf(Math.abs(zScore)))
  return { zScore, pValue, significant: pValue < 0.05 }
}

function sampleBeta(alpha: number, beta: number): number {
  const gammaA = sampleGamma(alpha)
  const gammaB = sampleGamma(beta)
  return gammaA / (gammaA + gammaB)
}

function sampleGamma(shape: number): number {
  if (shape < 1) {
    return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape)
  }
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x: number, v: number
    do {
      x = randn()
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = Math.random()
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

function randn(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

const MC_SAMPLES = 10_000

export function calculateBayesianConfidence(variants: VariantStats[]): BayesianResult {
  const wins = new Map<string, number>()
  for (const v of variants) wins.set(v.variant_id, 0)

  for (let i = 0; i < MC_SAMPLES; i++) {
    let bestId = ''
    let bestVal = -1
    for (const v of variants) {
      const alpha = v.total_clicks + 1
      const beta = v.total_impressions - v.total_clicks + 1
      const sample = sampleBeta(alpha, beta)
      if (sample > bestVal) {
        bestVal = sample
        bestId = v.variant_id
      }
    }
    if (bestId) wins.set(bestId, (wins.get(bestId) ?? 0) + 1)
  }

  let winnerId = ''
  let maxWins = 0
  const probabilities: Record<string, number> = {}
  for (const v of variants) {
    const w = wins.get(v.variant_id) ?? 0
    probabilities[v.variant_id] = w / MC_SAMPLES
    if (w > maxWins) {
      maxWins = w
      winnerId = v.variant_id
    }
  }

  return { winnerId, confidence: probabilities[winnerId] ?? 0, probabilities }
}
