import { applyPosOverride } from '@/lib/pipeline/video-pos-derive'
import type { PosOverrides } from '@/lib/pipeline/video-schemas'
import { posOverrideKey } from '@/lib/pipeline/video-schemas'
import type { RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'

export interface HandoffBeatRow {
  /** 1-indexed display number — fixes prototype views-video-record.jsx:176 `#{i}` → `#{i+1}` (spec §6). */
  displayNum: number
  /** RAW index of the source beat in the roteiro — joins the row back to `beats[beatIndex]`. */
  beatIndex: number
  /** PosOverrides key of the source beat (durable id ?? positional `i{N}`) — EF edits write here. */
  overrideKey: string
  name: string
  duration?: number
  anchor: string
  /** Momento visual cue (override.cue ?? first vis note). */
  cue: string
  cues: string[]
  /** Which fields are shadowed by a per-beat override (drives the pp-ov edited affordance). */
  ov: { line: boolean; cue: boolean; broll: boolean }
}

/**
 * Project roteiro beats into handoff rows: anchor + b-roll derived from the script,
 * shadowed by the PosBrief per-beat `overrides` (same `applyPosOverride` merge the Pós
 * cards use — the printed sheet always matches the screen). Non-spoken, cue-less beats
 * (KIT, MUST-GET, TIMELINE, PLAYBOOK) are dropped so the brief reads as a Pós reference
 * and not a verbatim ROTEIRO dump. Display numbering is 1-indexed and contiguous over
 * the FILTERED list.
 *
 * THE single beat projection for the Pós: the on-screen "Momentos-chave" and "B-roll por
 * beat" cards render subsets of these rows and show `displayNum` — so "#3" is the same
 * beat on screen and on the printed handoff, always.
 */
export function handoffBeatRows(beats: RoteiroBeatV3[], overrides?: PosOverrides): HandoffBeatRow[] {
  const out: HandoffBeatRow[] = []
  beats.forEach((beat, i) => {
    const eff = applyPosOverride(beat, i, overrides)
    if (!eff.line && eff.broll.length === 0) return // drop non-spoken, cue-less beats
    out.push({
      displayNum: out.length + 1,
      beatIndex: i,
      overrideKey: posOverrideKey(beat, i),
      name: beat.name,
      duration: beat.duration,
      anchor: eff.line,
      cue: eff.cue,
      cues: eff.broll,
      ov: eff.ov,
    })
  })
  return out
}
