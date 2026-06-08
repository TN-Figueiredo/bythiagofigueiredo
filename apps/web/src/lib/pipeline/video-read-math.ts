import type { RoteiroContentV3 } from './roteiro-schemas'
import { videoLineSecs } from './video-schemas'

/**
 * Returns the ordered list of line keys (`"beatIdx-scriptIdx"`) for all `type === 'line'`
 * items across all beats in a RoteiroContentV3. Used as the teleprompter cursor index.
 */
export function videoLineKeys(content: RoteiroContentV3): string[] {
  const keys: string[] = []
  content.beats.forEach((beat, bi) => {
    beat.script.forEach((item, si) => {
      if (item.type === 'line') keys.push(`${bi}-${si}`)
    })
  })
  return keys
}

/**
 * Returns the estimated reading duration (in seconds) for each `type === 'line'` item,
 * in the same order as `videoLineKeys`. Uses `videoLineSecs` (÷ 2.6 wps).
 */
export function videoLineSecsFlat(content: RoteiroContentV3): number[] {
  const secs: number[] = []
  for (const beat of content.beats) {
    for (const item of beat.script) {
      if (item.type === 'line') {
        secs.push(videoLineSecs(item.text))
      }
    }
  }
  return secs
}

/**
 * Returns a percentage (0–100) of elapsed / total reading seconds.
 * Safe against total = 0 (returns 0).
 */
export function readPctOf(elapsed: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((elapsed / total) * 100))
}
