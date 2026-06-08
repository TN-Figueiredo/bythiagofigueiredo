import type { RoteiroBeatV3 } from '@/lib/pipeline/video-schemas'
import { beatKind } from '@/lib/pipeline/video-perform'

/** First `key` line's text; fallback to first `line` text; '' if none. */
export function keyLineText(beat: RoteiroBeatV3): string {
  const lines = beat.script.filter((s): s is Extract<typeof s, { type: 'line' }> => s.type === 'line')
  const keyLine = lines.find(l => l.key === true)
  // Strip `**` emphasis markers (mirrors handoff: k.text.replace(/\*\*/g,'')) so the
  // momento line doesn't surface literal markdown asterisks.
  return ((keyLine ?? lines[0])?.text ?? '').replace(/\*\*/g, '')
}

/**
 * B-roll notes for a beat, in script order.
 *
 * `vis` items are always b-roll (editor → b-roll), for every beat. Additionally, when
 * the beat is editor-kind (e.g. a legacy "B-ROLL SHOT LIST" beat whose shots were
 * authored as plain `line`/`action` items before the `editor`/`vis` types existed),
 * those `line`/`action` texts ARE the shot list — so they must reach the Pós editor
 * brief too. Without this, an editor-kind beat's shots are routed out of the actor's
 * flow (by `splitBeats`) yet never surface in "B-roll por beat" — they vanish.
 */
export function visNotes(beat: RoteiroBeatV3): string[] {
  const isEditor = beatKind(beat) === 'editor'
  return beat.script
    .filter((s): s is Extract<typeof s, { type: 'vis' | 'line' | 'action' }> =>
      s.type === 'vis' || (isEditor && (s.type === 'line' || s.type === 'action')))
    .map(s => s.text)
}

export interface Momento { n: number; beatName: string; text: string }
/** Momentos-chave derived from beats, #1-indexed; beats with no key/line text are skipped. */
export function deriveMomentos(beats: RoteiroBeatV3[]): Momento[] {
  const out: Momento[] = []
  beats.forEach(b => {
    const text = keyLineText(b)
    if (text) out.push({ n: out.length + 1, beatName: b.name, text })
  })
  return out
}

export interface BrollGroup { n: number; beatName: string; notes: string[] }
/** B-roll por beat derived from beats, #1-indexed; only beats carrying vis items. */
export function deriveBroll(beats: RoteiroBeatV3[]): BrollGroup[] {
  const out: BrollGroup[] = []
  beats.forEach(b => {
    const notes = visNotes(b)
    if (notes.length > 0) out.push({ n: out.length + 1, beatName: b.name, notes })
  })
  return out
}
