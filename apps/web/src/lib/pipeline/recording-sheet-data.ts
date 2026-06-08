import { videoBeatRead } from '@/lib/pipeline/video-schemas'
import type { RoteiroBeatV3, ScriptLineV3 } from '@/lib/pipeline/roteiro-schemas'

export type RecLineKind = 'line' | 'pause' | 'vis' | 'ed' | 'skip'

/** Classify a v3 script item for the recording sheet. `dir` renders NOWHERE (parity views-video-record.jsx:10-18). */
export function recLineKind(item: ScriptLineV3): RecLineKind {
  switch (item.type) {
    case 'line':
      return 'line'
    case 'pause':
      return 'pause'
    case 'vis':
      return 'vis'
    case 'ed':
      return 'ed'
    default:
      return 'skip' // 'dir' and any unknown → never rendered on the sheet
  }
}

export interface RecSheetLine {
  kind: 'line' | 'pause' | 'vis' | 'ed'
  text?: string
  duration?: number
  key?: boolean
}

/**
 * Project a beat's v3 script into renderable sheet lines.
 * `line`/`pause` always; `vis`/`ed` only when showEd; `dir` (and `skip`) dropped.
 */
export function recBeatLines(beat: RoteiroBeatV3, showEd: boolean): RecSheetLine[] {
  const out: RecSheetLine[] = []
  for (const item of beat.script ?? []) {
    const kind = recLineKind(item)
    if (kind === 'skip') continue
    if ((kind === 'vis' || kind === 'ed') && !showEd) continue
    if (kind === 'line') {
      out.push({ kind: 'line', text: item.type === 'line' ? item.text : '', key: item.type === 'line' ? item.key === true : false })
    } else if (kind === 'pause') {
      out.push({ kind: 'pause', duration: item.type === 'pause' ? item.duration : 0 })
    } else {
      out.push({ kind, text: 'text' in item ? item.text : '' })
    }
  }
  return out
}

export interface RecSheetMeta {
  beatsCount: number
  readSeconds: number
}

/** Meta row aggregates: beat count + total read estimate (sum of videoBeatRead, /2.1). */
export function recSheetMeta(beats: RoteiroBeatV3[]): RecSheetMeta {
  return {
    beatsCount: beats.length,
    readSeconds: beats.reduce((acc, b) => acc + videoBeatRead(b), 0),
  }
}

/** A−/A+ stepper: clamp 0.85–1.4, 2-decimal round (prototype views-video-record.jsx:53). */
export function clampRsScale(current: number, delta: number): number {
  return Math.min(1.4, Math.max(0.85, +(current + delta).toFixed(2)))
}
