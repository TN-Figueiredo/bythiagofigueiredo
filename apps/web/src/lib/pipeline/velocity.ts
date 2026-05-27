import { EFFORT_DEFAULTS } from './up-next-constants'
import type { VelocityEntry, VelocityMap, VelocityTransitionRow } from './up-next-types'

const MAX_DURATION_MINUTES = 30 * 24 * 60
const COLD_START_THRESHOLD = 10

export function computeP90(values: number[]): number {
  if (values.length === 0) throw new Error('computeP90: empty array')
  if (values.some(v => !Number.isFinite(v))) throw new Error('computeP90: non-finite value')
  if (values.length === 1) return values[0]!
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil(0.9 * sorted.length) - 1
  return sorted[index]!
}

export function blendVelocity(sampleCount: number, historicalMedian: number, defaultMinutes: number): number {
  const weight = Math.min(sampleCount / COLD_START_THRESHOLD, 1)
  return Math.round(weight * historicalMedian + (1 - weight) * defaultMinutes)
}

function computeMedian(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
  return sorted[mid]!
}

export function buildVelocityMap(rows: VelocityTransitionRow[]): VelocityMap {
  if (rows.length === 0) return {}

  // Group by pipeline_id
  const byPipeline = new Map<string, VelocityTransitionRow[]>()
  for (const row of rows) {
    const group = byPipeline.get(row.pipeline_id)
    if (group) group.push(row)
    else byPipeline.set(row.pipeline_id, [row])
  }

  // Collect durations per format:stage
  const durationsByKey = new Map<string, number[]>()
  for (const [, pipelineRows] of byPipeline) {
    pipelineRows.sort((a, b) => a.changed_at.localeCompare(b.changed_at))
    for (let i = 1; i < pipelineRows.length; i++) {
      const prev = pipelineRows[i - 1]!
      const curr = pipelineRows[i]!
      const durationMs = new Date(curr.changed_at).getTime() - new Date(prev.changed_at).getTime()
      if (durationMs <= 0) continue
      const durationMinutes = Math.floor(durationMs / 60_000)
      if (durationMinutes <= 0 || durationMinutes >= MAX_DURATION_MINUTES) continue
      if (!curr.format || !curr.from_value) continue
      const key = `${curr.format}:${curr.from_value}`
      const durations = durationsByKey.get(key)
      if (durations) durations.push(durationMinutes)
      else durationsByKey.set(key, [durationMinutes])
    }
  }

  const map: VelocityMap = {}
  for (const [key, durations] of durationsByKey) {
    const sorted = [...durations].sort((a, b) => a - b)
    const medianMinutes = computeMedian(sorted)
    const p90Minutes = computeP90(sorted)
    const sampleCount = sorted.length
    const defaultMinutes = EFFORT_DEFAULTS[key]?.minutes ?? 60
    const effectiveMinutes = blendVelocity(sampleCount, medianMinutes, defaultMinutes)
    map[key] = { medianMinutes, p90Minutes, sampleCount, effectiveMinutes }
  }
  return map
}


