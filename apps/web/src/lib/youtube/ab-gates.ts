import type { GateResult } from './ab-types'

export interface GateInput {
  confidence: number         // 0-1, e.g. 0.97
  threshold: number          // 0-1, e.g. 0.95
  minImpressions: number[]   // per-variant impression counts
  daysSinceStart: number
  confirmedCycles: number
  burnInDays: number
  variantCount: number
  eligibleCycles: number     // cycles after burn-in
  consecutiveConfident: number
  stabilityThreshold: number
}

export function computeGates(input: GateInput): GateResult[] {
  const {
    confidence, threshold, minImpressions, daysSinceStart,
    confirmedCycles, burnInDays, variantCount,
    eligibleCycles, consecutiveConfident, stabilityThreshold,
  } = input

  const minImp = Math.min(...minImpressions)

  return [
    {
      name: 'confidence',
      passed: confidence >= threshold,
      value: `${(confidence * 100).toFixed(1)}% / ${(threshold * 100).toFixed(0)}%`,
      hint: confidence < threshold ? `Need ${((threshold - confidence) * 100).toFixed(1)}% more` : undefined,
    },
    {
      name: 'min_impressions',
      passed: minImpressions.length > 0 && minImp >= 1000,
      value: `${minImp.toLocaleString()} min`,
      hint: minImp < 1000 ? `Need ${(1000 - minImp).toLocaleString()} more on weakest variant` : undefined,
    },
    {
      name: 'min_duration',
      passed: daysSinceStart >= 7,
      value: `${daysSinceStart} / 7 days`,
      hint: daysSinceStart < 7 ? `${7 - daysSinceStart} days remaining` : undefined,
    },
    {
      name: 'min_cycles',
      passed: confirmedCycles >= variantCount * 7,
      value: `${confirmedCycles} / ${variantCount * 7} cycles`,
      hint: confirmedCycles < variantCount * 7 ? `Need ${variantCount * 7 - confirmedCycles} more cycles` : undefined,
    },
    {
      name: 'burn_in',
      passed: burnInDays === 0 || eligibleCycles > 0,
      value: burnInDays === 0 ? 'Skipped' : `${eligibleCycles} eligible`,
      hint: burnInDays > 0 && eligibleCycles === 0 ? 'No cycles completed after burn-in period' : undefined,
    },
    {
      name: 'stability',
      passed: consecutiveConfident >= stabilityThreshold,
      value: `${consecutiveConfident} / ${stabilityThreshold} consecutive`,
      hint: consecutiveConfident < stabilityThreshold ? `Need ${stabilityThreshold - consecutiveConfident} more consecutive confident evaluations` : undefined,
    },
  ]
}
