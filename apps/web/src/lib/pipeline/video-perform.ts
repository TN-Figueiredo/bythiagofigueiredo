import type { BeatKind, RoteiroBeatV3, RoteiroContentV3, ScriptLineV3 } from './roteiro-schemas'

/**
 * Performer-flow model for the Roteiro stage.
 *
 * The Roteiro is the actor's view: what Thiago SAYS and DOES in front of the camera.
 * Everything else — shoot-day logistics (kit, capture timeline, must-gets) and
 * editor-directed coverage (b-roll shot lists, visual cues) — is demoted out of the
 * reading flow so it never competes with the lines while filming.
 *
 * A beat declares its role via `beat.kind`. Legacy roteiros (generated before kind
 * existed) carry none, so `beatKind()` classifies them at read time from the beat
 * name. This is intentionally NON-DESTRUCTIVE: nothing is rewritten on disk; the
 * classification happens every render. An explicit `beat.kind` always wins.
 */

const strip = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// Logistics the talent handles before/around the shoot — never lines to read.
// Kept deliberately narrow (no bare "setup"/"materiais"/"preparo"/"list" — they'd
// false-positive a spoken beat like "O Setup Mental"; a mis-file is recoverable in-UI).
// PT + common EN tokens (multi-lang system): kit/checklist/gear/timeline/schedule/
// must-get/prep/setup list/packing.
const PREP_RE = /\b(kit|timeline|cronograma|schedule|must[\s-]?get|checklist|gear|equipamento|antes de gravar|logistica|packing|prep\b|setup list)\b/
// Editor-directed coverage — goes to the editor (Pós), suggested by the talent.
// PT + EN: b-roll/broll/shot list/shotlist/coverage/cutaway/overlay/inserts.
const EDITOR_RE = /\b(b[\s-]?roll|shot[\s-]?list|cutaways?|coverage|overlays?|planos de corte|imagens de apoio|inserts?|recursos visuais)\b/
// On-camera actions/prompts — the talent DOES these (no fixed script).
// "abordagem"/"prompt" dropped (too generic for hook names); inference is a fallback —
// explicit `beat.kind` always wins and the UI offers a "é fala?" recovery.
// PT + EN: interview/questions/capture/b-roll capture/ask/approach/shorts/verticals.
const ACTION_RE = /\b(entradas?\b.*\bperguntas?|perguntas? de entrevista|entrevistas?|interviews?|questions?|captacao|capture|ask\b|approach|verticais|verticals?|shorts?)\b/

/** Classify a beat. Explicit `beat.kind` wins; otherwise heuristic on the name. */
export function beatKind(beat: RoteiroBeatV3): BeatKind {
  if (beat.kind) return beat.kind
  const n = strip(beat.name)
  if (PREP_RE.test(n)) return 'prep'
  if (EDITOR_RE.test(n)) return 'editor'
  if (ACTION_RE.test(n)) return 'acao'
  return 'fala'
}

/** A beat the talent performs on camera (spoken lines or actions). */
export function isPerformerBeat(beat: RoteiroBeatV3): boolean {
  const k = beatKind(beat)
  return k === 'fala' || k === 'acao'
}

export interface KindedBeat {
  beat: RoteiroBeatV3
  /** Original index into content.beats — the stable key for `spoken`/scroll anchors. */
  idx: number
  kind: BeatKind
}

function tag(beats: RoteiroBeatV3[]): KindedBeat[] {
  return beats.map((beat, idx) => ({ beat, idx, kind: beatKind(beat) }))
}

/** Split a roteiro's beats into the three lanes the Roteiro stage renders. */
export function splitBeats(content: RoteiroContentV3 | null | undefined): {
  performer: KindedBeat[]
  prep: KindedBeat[]
  editor: KindedBeat[]
} {
  const all = tag(content?.beats ?? [])
  return {
    performer: all.filter((b) => b.kind === 'fala' || b.kind === 'acao'),
    prep: all.filter((b) => b.kind === 'prep'),
    editor: all.filter((b) => b.kind === 'editor'),
  }
}

/**
 * The MARKABLE items of a performer beat — what the per-beat progress and the global
 * counter track. In a `fala` beat these are spoken `line` items. In an `acao` beat
 * they are `action` items, plus legacy `line` items (older roteiros authored prompts
 * as lines before the action type existed), reinterpreted as actions.
 */
export function markableIdxs(beat: RoteiroBeatV3, kind: BeatKind): number[] {
  if (kind === 'acao') {
    return beat.script.map((it, i) => (it.type === 'action' || it.type === 'line' ? i : -1)).filter((i) => i >= 0)
  }
  return beat.script.map((it, i) => (it.type === 'line' ? i : -1)).filter((i) => i >= 0)
}

/** Does an item read as a teleprompter line in this beat (i.e. part of the read clock)? */
export function isSpokenLine(it: ScriptLineV3, kind: BeatKind): boolean {
  return kind === 'fala' && it.type === 'line'
}

/** Plain text of an item, for prep/editor bullet rendering. */
export function itemText(it: ScriptLineV3): string {
  return it.type === 'pause' ? `respira ${String(it.duration).replace('.', ',')}s` : it.text
}
