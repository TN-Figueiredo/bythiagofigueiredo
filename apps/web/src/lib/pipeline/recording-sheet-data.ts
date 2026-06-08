import { videoBeatRead } from '@/lib/pipeline/video-schemas'
import type { RoteiroBeatV3, ScriptLineV3 } from '@/lib/pipeline/roteiro-schemas'

export type RecLineKind = 'line' | 'action' | 'pause' | 'vis' | 'ed' | 'dir' | 'skip'

/**
 * Classify a v3 script item for the recording sheet.
 * `dir` items are talent-facing direction notes — they PRINT (always, like `beat.tone`),
 * so the host sees the inline cue while recording. `vis`/`ed` are editor-facing and only
 * print under showEd. Unknown types → `skip` (never rendered).
 */
export function recLineKind(item: ScriptLineV3): RecLineKind {
  switch (item.type) {
    case 'line':
      return 'line'
    case 'action':
      return 'action'
    case 'pause':
      return 'pause'
    case 'vis':
      return 'vis'
    case 'ed':
      return 'ed'
    case 'dir':
      return 'dir' // talent direction → prints as an inline note
    default:
      return 'skip' // unknown → never rendered on the sheet
  }
}

export interface RecSheetLine {
  kind: 'line' | 'action' | 'pause' | 'vis' | 'ed' | 'dir'
  text?: string
  duration?: number
  key?: boolean
}

/**
 * Project a beat's v3 script into renderable sheet lines.
 * `line`/`action`/`pause`/`dir` always (`dir` = talent direction note); `vis`/`ed` only
 * when showEd; `skip` dropped.
 * `asActions` (an `acao` beat) reinterprets legacy `line` items as actions (do-list).
 */
export function recBeatLines(beat: RoteiroBeatV3, showEd: boolean, asActions = false): RecSheetLine[] {
  const out: RecSheetLine[] = []
  for (const item of beat.script ?? []) {
    const kind = recLineKind(item)
    if (kind === 'skip') continue
    if ((kind === 'vis' || kind === 'ed') && !showEd) continue
    if (kind === 'dir') {
      out.push({ kind: 'dir', text: item.type === 'dir' ? item.text : '' })
    } else if (kind === 'line') {
      out.push({ kind: asActions ? 'action' : 'line', text: item.type === 'line' ? item.text : '', key: item.type === 'line' ? item.key === true : false })
    } else if (kind === 'action') {
      out.push({ kind: 'action', text: item.type === 'action' ? item.text : '', key: item.type === 'action' ? item.key === true : false })
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
