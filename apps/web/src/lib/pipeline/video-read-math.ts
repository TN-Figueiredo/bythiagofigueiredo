import type { RoteiroContentV3 } from './roteiro-schemas'
import { videoLineSecs } from './video-schemas'
import { beatKind } from './video-perform'

/**
 * Returns the ordered list of line keys (`"beatIdx-scriptIdx"`) for the teleprompter
 * cursor index — i.e. spoken `line` items in `fala` beats only. Prep/editor/acao beats
 * are excluded: they aren't read aloud, so they must not pollute the cursor, the read
 * clock, or the spoken counter.
 */
export function videoLineKeys(content: RoteiroContentV3): string[] {
  const keys: string[] = []
  content.beats.forEach((beat, bi) => {
    if (beatKind(beat) !== 'fala') return
    beat.script.forEach((item, si) => {
      if (item.type === 'line') keys.push(`${bi}-${si}`)
    })
  })
  return keys
}

/**
 * Returns the estimated reading duration (in seconds) for each spoken line counted by
 * `videoLineKeys`, in the same order. Uses `videoLineSecs` (÷ 2.1 wps).
 */
export function videoLineSecsFlat(content: RoteiroContentV3): number[] {
  const secs: number[] = []
  for (const beat of content.beats) {
    if (beatKind(beat) !== 'fala') continue
    for (const item of beat.script) {
      if (item.type === 'line') secs.push(videoLineSecs(item.text))
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
