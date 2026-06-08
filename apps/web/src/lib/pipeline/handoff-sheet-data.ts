import { keyLineText, visNotes } from '@/lib/pipeline/video-pos-derive'
import type { RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'

export interface HandoffBeatRow {
  /** 1-indexed display number — fixes prototype views-video-record.jsx:176 `#{i}` → `#{i+1}` (spec §6). */
  displayNum: number
  name: string
  duration?: number
  anchor: string
  cues: string[]
}

/** Project roteiro beats into handoff rows: 1-indexed, anchor + b-roll derived from the script. */
export function handoffBeatRows(beats: RoteiroBeatV3[]): HandoffBeatRow[] {
  return beats.map((beat, i) => ({
    displayNum: i + 1,
    name: beat.name,
    duration: beat.duration,
    anchor: keyLineText(beat),
    cues: visNotes(beat),
  }))
}
