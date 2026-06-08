import type { RoteiroBeatV3, RoteiroContentV3 } from './roteiro-schemas'
import { videoLineSecs } from './video-schemas'
import { beatKind, type ScriptSection } from './video-perform'

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

// ── Honest per-language reading estimate ─────────────────────────────────────
// Separate from the teleprompter clock (VIDEO_READ_WPS = 2.1 wps, ~126 wpm), which
// must stay untouched. These power the "~Xs · leitura, sem pausas de cena" label on
// the print sheet and reader. PT-BR averages slightly slower than EN (longer words,
// more syllables per word), so the two cadences differ — by design.
//   PT-BR ~150 wpm — a comfortable spoken-delivery pace for Brazilian Portuguese.
//   EN    ~165 wpm — English averages a touch faster (shorter words/syllable count).
export const READ_WPM_PT = 150
export const READ_WPM_EN = 165
export const READ_WPS_PT = READ_WPM_PT / 60
export const READ_WPS_EN = READ_WPM_EN / 60

type ReadLang = 'pt' | 'en'

const MAX_WORD_COUNT_LENGTH = 100_000

/** Word count of a spoken-line text, with `**` emphasis markers stripped (clock parity). */
function countLineWords(text: string): number {
  const stripped = text.replace(/\*\*/g, '')
  const safe = stripped.length > MAX_WORD_COUNT_LENGTH ? stripped.slice(0, MAX_WORD_COUNT_LENGTH) : stripped
  return safe.split(/\s+/).filter(Boolean).length
}

function wpsFor(lang: ReadLang): number {
  return lang === 'en' ? READ_WPS_EN : READ_WPS_PT
}

/**
 * Honest reading estimate (seconds) for a beat in the given language: spoken-line words ÷
 * per-language wps PLUS the explicit `pause.duration` of every pause item in the beat.
 * Only `line` items count toward the spoken estimate (action/dir/vis/ed are excluded).
 * Empty beat → 0. Rounded to the nearest second.
 */
export function beatReadSecs(beat: RoteiroBeatV3, lang: ReadLang): number {
  let words = 0
  let pauses = 0
  for (const it of beat.script) {
    if (it.type === 'line') words += countLineWords(it.text)
    else if (it.type === 'pause') pauses += it.duration
  }
  if (words === 0 && pauses === 0) return 0
  return Math.round(words / wpsFor(lang) + pauses)
}

/**
 * Honest reading estimate (seconds) for a single derived section, over the section's
 * `lineIdxs` only. A `pause` that falls strictly between the section's first and last line
 * index is folded in (it reads as part of the take); pauses outside the section are not.
 * Rounded to the nearest second.
 */
export function sectionReadSecs(beat: RoteiroBeatV3, section: ScriptSection, lang: ReadLang): number {
  if (section.lineIdxs.length === 0) return 0
  const idxSet = new Set(section.lineIdxs)
  const first = section.lineIdxs[0]!
  const last = section.lineIdxs[section.lineIdxs.length - 1]!
  let words = 0
  let pauses = 0
  beat.script.forEach((it, i) => {
    if (it.type === 'line' && idxSet.has(i)) {
      words += countLineWords(it.text)
    } else if (it.type === 'pause' && i > first && i < last) {
      pauses += it.duration
    }
  })
  if (words === 0 && pauses === 0) return 0
  return Math.round(words / wpsFor(lang) + pauses)
}
