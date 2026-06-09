import { spokenAnchorText, visNotes } from '@/lib/pipeline/video-pos-derive'
import type { RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'

export interface HandoffBeatRow {
  /** 1-indexed display number — fixes prototype views-video-record.jsx:176 `#{i}` → `#{i+1}` (spec §6). */
  displayNum: number
  name: string
  duration?: number
  anchor: string
  cues: string[]
}

/**
 * Project roteiro beats into handoff rows: anchor + b-roll derived from the script.
 * Non-spoken, cue-less beats (KIT, MUST-GET, TIMELINE, PLAYBOOK) are dropped so the
 * brief reads as a Pós reference and not a verbatim ROTEIRO dump. Display numbering is
 * 1-indexed and contiguous over the FILTERED list.
 */
export function handoffBeatRows(beats: RoteiroBeatV3[]): HandoffBeatRow[] {
  const out: HandoffBeatRow[] = []
  beats.forEach((beat) => {
    const anchor = spokenAnchorText(beat)
    const cues = visNotes(beat)
    if (!anchor && cues.length === 0) return // drop non-spoken, cue-less beats
    out.push({ displayNum: out.length + 1, name: beat.name, duration: beat.duration, anchor, cues })
  })
  return out
}
