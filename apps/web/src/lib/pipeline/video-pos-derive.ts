import type { RoteiroBeatV3, PosOverrides } from '@/lib/pipeline/video-schemas'
import { posOverrideKey } from '@/lib/pipeline/video-schemas'
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
 * The SPOKEN anchor of a beat for the Momentos-chave / handoff surfaces.
 *
 * A "key moment" is a spoken moment, so non-`fala` beats (prep logistics, editor
 * coverage) yield '' here even if they carry a `line` item — that line is hidden from
 * the performer and must not surface as a key moment. This is the single gate shared by
 * `deriveMomentos`, the Pós "Momentos-chave" card, and the handoff sheet anchor.
 */
export function spokenAnchorText(beat: RoteiroBeatV3): string {
  return beatKind(beat) === 'fala' ? keyLineText(beat) : ''
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
/**
 * Momentos-chave derived from beats, #1-indexed; beats with no key/line text are skipped.
 *
 * A "Momento-chave" is a SPOKEN moment, so only performer-spoken (`fala`) beats are
 * considered. A `prep` (logistics) or `editor` (b-roll/coverage) beat can carry a `line`
 * item — but those lines are hidden from the performer's reading flow, so surfacing them
 * here (and in the handoff sheet) as key moments is a coherence leak. B-roll from editor
 * beats still reaches the Pós via `deriveBroll`/`visNotes`; only the spoken-anchor list
 * is gated.
 */
export function deriveMomentos(beats: RoteiroBeatV3[]): Momento[] {
  const out: Momento[] = []
  beats.forEach(b => {
    const text = spokenAnchorText(b)
    if (text) out.push({ n: out.length + 1, beatName: b.name, text })
  })
  return out
}

/** Effective Pós values for a beat: derived from the roteiro, shadowed by any PosBrief override. */
export interface PosEffectiveBeat {
  /** Momento-chave anchor line (override.line ?? spoken anchor). */
  line: string
  /** Visual cue shown under the momento (override.cue ?? first vis note). */
  cue: string
  /** B-roll items (override.broll ?? all vis notes). */
  broll: string[]
  /** Which fields are shadowed by an override (drives the subtle edited affordance). */
  ov: { line: boolean; cue: boolean; broll: boolean }
}

/**
 * THE single merge of derived roteiro values with the PosBrief per-beat overrides — used by
 * BOTH the Pós stage cards and the printed handoff (handoffBeatRows) so screen and paper
 * can never diverge. An absent override key (or field) falls back to the derived value.
 */
export function applyPosOverride(
  beat: RoteiroBeatV3,
  index: number,
  overrides?: PosOverrides,
): PosEffectiveBeat {
  const o = overrides?.[posOverrideKey(beat, index)]
  const vis = visNotes(beat)
  return {
    line: o?.line ?? spokenAnchorText(beat),
    cue: o?.cue ?? vis[0] ?? '',
    broll: o?.broll ?? vis,
    ov: { line: o?.line !== undefined, cue: o?.cue !== undefined, broll: o?.broll !== undefined },
  }
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
