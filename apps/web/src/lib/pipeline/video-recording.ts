import type { RoteiroBeatV3, RoteiroContentV3 } from './roteiro-schemas'
import { beatKind } from './video-perform'

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
 * Per-line marking granularity for the recording overlay AND the printed script.
 *   off   → no pen tick-boxes at all (default — a clean script to read, not a quiz)
 *   beat  → one box on each beat header (a few per page)
 *   secao → one box at the start of each derived section (run of `line` items)
 *   linha → the legacy per-line box (opt-in; the thing the creator hates by default)
 * Defaults to `off` everywhere — ESPECIALLY on paper.
 */
export type MarkGran = 'off' | 'beat' | 'secao' | 'linha'

/** All granularities in display order — drives the segmented control + class gating. */
export const MARK_GRANS: MarkGran[] = ['off', 'beat', 'secao', 'linha']

/** The default granularity: zero checkboxes anywhere (clean script). */
export const DEFAULT_MARK_GRAN: MarkGran = 'off'

/** Short PT labels for the segmented control. */
export const MARK_GRAN_LABEL: Record<MarkGran, string> = {
  off: 'Off',
  beat: 'Beat',
  secao: 'Seção',
  linha: 'Linha',
}

/** The CSS class that gates tick visibility on `.rot-doc`/`.rec-overlay` per granularity. */
export function markGranClass(gran: MarkGran): string {
  return `mark-${gran}`
}

/** Type guard / coercion for an untrusted persisted value → a valid MarkGran (fallback off). */
export function asMarkGran(v: unknown): MarkGran {
  return v === 'off' || v === 'beat' || v === 'secao' || v === 'linha' ? v : DEFAULT_MARK_GRAN
}

/**
 * Returns content where every beat carries a stable `id`.
 *
 * Beats lacking an `id` get `crypto.randomUUID()`. Existing ids are preserved
 * (back-compat — never overwritten). The beat `kind` is intentionally left
 * UNSTAMPED: classification stays heuristic until the user (or an explicit
 * record action) confirms it, so the "é fala?" recovery affordance can still
 * detect heuristic-classified beats and an unconfirmed guess is never frozen
 * without consent.
 *
 * `changed` is true iff at least one id was assigned. Pure aside from id
 * generation — the input is never mutated (a new object is returned).
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
 * collapsed, trimmed, and Unicode-normalized to NFC. The NFC pass ensures that
 * composed vs decomposed accents (e.g. `á` U+00E1 vs `a`+U+0301) hash identically,
 * killing spurious "roteiro mudou desde a gravação" staleness. Deterministic.
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
    .normalize('NFC')
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

// ---------------------------------------------------------------------------
// Reconciliation — match durable rows to the current roteiro beats.
//
// The durable ledger keys status on (pipeline_id, lang, beat_id). A roteiro write
// overwrites the whole content, so on every load we re-derive the current `fala`
// beats and match the stored rows to them by `beat_id`:
//   • same beat_id + same content_hash → carry status/note verbatim (stale: false)
//   • same beat_id, different hash      → carry status/note but stale: true
//                                         ("roteiro mudou desde a gravação")
//   • beat with no row                  → status 'pendente', stale: false
//   • row whose beat_id is gone         → orphan (surfaced for explicit purge)
// Pure & deterministic — no IO, no clock, no id generation.
// ---------------------------------------------------------------------------

/** A persisted recording-status row, as stored in `video_recording_status`. */
export interface StoredRecRow {
  beat_id: string
  status: RecStatus
  retake_note: string | null
  beat_name: string | null
  content_hash: string | null
  /** Server timestamp of the row (ISO 8601). Surfaced for if_unmodified_since + cross-device. */
  updated_at?: string
}

/** A current `fala` beat reconciled against the durable ledger. */
export interface ReconciledBeat {
  beat_id: string
  /** Display name of the beat at reconciliation time (from the live roteiro). */
  beat_name: string
  status: RecStatus
  retake_note: string | null
  /** Hash of the beat's current performer text — what a write should persist. */
  content_hash: string
  /** True when a stored row exists but the roteiro changed since it was recorded. */
  stale: boolean
  /** Server timestamp of the matched row (ISO 8601), if any. Undefined for fresh pendente beats. */
  updated_at?: string
}

/**
 * Reconcile the durable recording rows against the live roteiro beats.
 *
 * Only `fala` beats carry recording status (one `fala` beat ≈ one take); `acao`/`prep`/
 * `editor` beats are skipped here. Beats without a stable `id` cannot be matched and are
 * treated as fresh `pendente` (no row, no orphan) — callers should `ensureBeatIds` first.
 *
 * Returns the reconciled current beats (in roteiro order) plus the orphan rows whose
 * `beat_id` is absent from the current beats (never auto-deleted — surfaced for purge).
 */
export function reconcileRecording(
  beats: RoteiroBeatV3[],
  rows: StoredRecRow[],
): { beats: ReconciledBeat[]; orphans: StoredRecRow[] } {
  const rowByBeat = new Map<string, StoredRecRow>()
  for (const row of rows) rowByBeat.set(row.beat_id, row)

  const reconciled: ReconciledBeat[] = []
  const matched = new Set<string>()

  for (const beat of beats) {
    if (beatKind(beat) !== 'fala') continue
    if (!beat.id) {
      // No stable identity → cannot match a durable row. Fresh pendente.
      reconciled.push({
        beat_id: '',
        beat_name: beat.name,
        status: 'pendente',
        retake_note: null,
        content_hash: beatContentHash(beat),
        stale: false,
      })
      continue
    }

    const hash = beatContentHash(beat)
    const row = rowByBeat.get(beat.id)

    if (!row) {
      reconciled.push({
        beat_id: beat.id,
        beat_name: beat.name,
        status: 'pendente',
        retake_note: null,
        content_hash: hash,
        stale: false,
      })
      continue
    }

    matched.add(beat.id)
    reconciled.push({
      beat_id: beat.id,
      beat_name: beat.name,
      status: row.status,
      retake_note: row.retake_note,
      content_hash: hash,
      // A row recorded against a now-changed roteiro is stale (loud, never a silent ✓).
      stale: row.content_hash !== null && row.content_hash !== hash,
      updated_at: row.updated_at,
    })
  }

  const orphans = rows.filter((row) => !matched.has(row.beat_id))
  return { beats: reconciled, orphans }
}
