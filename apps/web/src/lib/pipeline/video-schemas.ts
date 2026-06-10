import { z } from 'zod'
import type { RoteiroBeatV3, ScriptLineV3 } from './roteiro-schemas'

export type { RoteiroBeatV3 } from './roteiro-schemas'

/** Video reading cadence — 2.1 wps (~125 wpm; words ÷ 2.1 + pause seconds, per the v3 handoff). */
export const VIDEO_READ_WPS = 2.1

const MAX_WORD_COUNT_LENGTH = 100_000

function countWords(text: string): number {
  const stripped = text.replace(/\*\*/g, '')
  const safe = stripped.length > MAX_WORD_COUNT_LENGTH ? stripped.slice(0, MAX_WORD_COUNT_LENGTH) : stripped
  return safe.split(/\s+/).filter(Boolean).length
}

/** Per-line reading seconds = max(1, round(words / 2.1)). */
export function videoLineSecs(text: string): number {
  return Math.max(1, Math.round(countWords(text) / VIDEO_READ_WPS))
}

function beatWordCountV3(beat: RoteiroBeatV3): number {
  return beat.script
    .filter((l): l is ScriptLineV3 & { type: 'line' } => l.type === 'line')
    .reduce((n, l) => n + countWords(l.text), 0)
}

/** Beat read estimate = ceil(beatWordCount / 2.1 + sum(pause.duration)). */
export function videoBeatRead(beat: RoteiroBeatV3): number {
  const pauses = beat.script
    .filter((l): l is ScriptLineV3 & { type: 'pause' } => l.type === 'pause')
    .reduce((n, l) => n + l.duration, 0)
  return Math.ceil(beatWordCountV3(beat) / VIDEO_READ_WPS + pauses)
}

/** Summed target duration + read estimate across beats. */
export function vidTotals(beats: RoteiroBeatV3[]): { dur: number; read: number } {
  return (beats ?? []).reduce(
    (a, b) => ({ dur: a.dur + (b.duration ?? 0), read: a.read + videoBeatRead(b) }),
    { dur: 0, read: 0 },
  )
}

/** Reading clock m:ss (e.g. 128 → "2:08"). */
export function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const ss = Math.round(sec % 60)
  return `${m}:${String(ss).padStart(2, '0')}`
}

/** Ideia section payload (per-language; production fields live in format_metadata). */
export const IdeiaSectionSchema = z.object({
  title: z.string().max(500).default(''),
  direction: z.string().max(4000).default(''),
  siblings: z.array(z.string().max(500)).max(20).default([]),
  logline: z.string().max(1000).default(''),
  angles: z.string().max(200).default(''),
  framework: z.string().max(200).default(''),
}).strict()
export type IdeiaSection = z.infer<typeof IdeiaSectionSchema>

// --- Pós lightweight brief (§5.3) ---
/**
 * Per-beat Pós override: shadows the values DERIVED from the roteiro (Momentos-chave line,
 * visual cue, B-roll items) for the Pós brief + printed handoff only. The roteiro stays the
 * source of truth — clearing an override (empty after trim) deletes the key and the row
 * falls back to the derived value.
 */
export const PosBeatOverrideSchema = z.object({
  line: z.string().max(280).optional(),
  cue: z.string().max(200).optional(),
  broll: z.array(z.string().max(200)).max(8).optional(),
}).strict()
export type PosBeatOverride = z.infer<typeof PosBeatOverrideSchema>
/** Override map keyed by `posOverrideKey(beat, index)` (beat.id when present, else `i<index>`). */
export type PosOverrides = Record<string, PosBeatOverride>

/**
 * Stable key for a beat's Pós override entry: the beat's durable `id` (stamped by the
 * recording-status flow) when present, else a positional `i<index>` fallback for legacy
 * v3 content that was never stamped.
 */
export function posOverrideKey(beat: RoteiroBeatV3, index: number): string {
  return beat.id ?? `i${index}`
}

export const PosBriefSchema = z.object({
  kind: z.literal('brief'),
  deliverables: z.object({
    editor: z.string(), deadline: z.string(), turnaround: z.string(),
    drive: z.string(), energy: z.string(),
    // Free-form delivery scope ("corte principal 8–12min, 3 Shorts, overlays a inserir").
    // The fixed fields above are logistics; this carries what to actually cut/deliver.
    notes: z.string().max(2000),
    references: z.array(z.string()).default([]),
  }).partial().optional(),
  style: z.array(z.object({ k: z.string(), v: z.string() })).default([]),
  ctas: z.object({
    note: z.string().default(''),
    rows: z.array(z.object({ k: z.string(), pt: z.string(), en: z.string() })).default([]),
    display: z.string().default(''),
  }).default({ note: '', rows: [], display: '' }),
  // Per-beat overrides for the derived Momentos-chave / B-roll (see PosBeatOverrideSchema).
  overrides: z.record(z.string(), PosBeatOverrideSchema).optional(),
}).strict()
export type PosBrief = z.infer<typeof PosBriefSchema>

// --- Publicação A/B draft (§3.8) — from-scratch 4-way contest ---
// There is NO incumbent: at debut all four variants are fresh challengers. The only
// start-time distinction is `firstOnAir` — which thumbnail goes live FIRST on YouTube.
// A `winner` exists only AFTER the test resolves (at most one). The Lab's internal
// `is_original` seed row is chosen by `firstOnAir`, an implementation detail.
export const ABDraftSchema = z.object({
  firstOnAir: z.enum(['A', 'B', 'C', 'D']),
  variants: z.array(z.object({
    id: z.enum(['A', 'B', 'C', 'D']),
    role: z.enum(['challenger', 'winner']).default('challenger'),
    title: z.string().max(500).default(''),
    brief: z.string().max(1000).default(''),
  })).length(4),
}).strict().refine(
  (d) => d.variants.filter(v => v.role === 'winner').length <= 1,
  { message: 'At most one variant may be the winner' },
)
export type ABDraft = z.infer<typeof ABDraftSchema>
