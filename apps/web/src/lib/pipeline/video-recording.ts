import type { RoteiroBeatV3, RoteiroContentV3 } from './roteiro-schemas'

/**
 * Recording status — durable, per (pipeline_id, lang, beat_id). 3-state, click cycles.
 *   pendente → not yet in the can
 *   gravada  → recorded
 *   refazer  → recorded but needs a retake (optional free-text note elsewhere)
 */
export type RecStatus = 'pendente' | 'gravada' | 'refazer'

/** Cycle the recording status: pendente → gravada → refazer → pendente. Total over the union. */
export function nextStatus(s: RecStatus): RecStatus {
  switch (s) {
    case 'pendente':
      return 'gravada'
    case 'gravada':
      return 'refazer'
    case 'refazer':
      return 'pendente'
  }
}

/**
 * Returns content where every beat carries a stable `id`, assigning `crypto.randomUUID()`
 * to beats that lack one. `changed` is true iff at least one id was assigned. Pure aside
 * from id generation — the input is never mutated (a new object is returned).
 */
export function ensureBeatIds(content: RoteiroContentV3): { content: RoteiroContentV3; changed: boolean } {
  let changed = false
  const beats = content.beats.map((beat) => {
    if (beat.id) return beat
    changed = true
    return { ...beat, id: crypto.randomUUID() }
  })
  if (!changed) return { content, changed }
  return { content: { ...content, beats }, changed }
}

/**
 * The performer-facing text of a beat: its spoken `line` and on-camera `action` item
 * texts, concatenated in order, with `**` emphasis markers stripped, whitespace
 * collapsed, and trimmed. Used to detect "roteiro mudou desde a gravação". Deterministic.
 */
export function normalizeBeatText(beat: RoteiroBeatV3): string {
  return beat.script
    .filter((it): it is RoteiroBeatV3['script'][number] & { type: 'line' | 'action' } =>
      it.type === 'line' || it.type === 'action',
    )
    .map((it) => it.text)
    .join(' ')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A stable, synchronous hash of `normalizeBeatText(beat)` as a base36 string. Same text →
 * same hash; a one-char change → a different hash. Uses FNV-1a (32-bit) — deterministic
 * and dependency-free; NOT async crypto.subtle.
 */
export function beatContentHash(beat: RoteiroBeatV3): string {
  const text = normalizeBeatText(beat)
  // FNV-1a 32-bit
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    // h *= 16777619, kept in 32-bit unsigned space
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}
