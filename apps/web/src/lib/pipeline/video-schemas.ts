import { z } from 'zod'
import type { RoteiroBeatV3, ScriptLineV3 } from './roteiro-schemas'

/** Video reading cadence — 2.6 wps, matching the hifi reference exactly (distinct from blog's 2.5). */
export const VIDEO_READ_WPS = 2.6

const MAX_WORD_COUNT_LENGTH = 100_000

function countWords(text: string): number {
  const stripped = text.replace(/\*\*/g, '')
  const safe = stripped.length > MAX_WORD_COUNT_LENGTH ? stripped.slice(0, MAX_WORD_COUNT_LENGTH) : stripped
  return safe.split(/\s+/).filter(Boolean).length
}

/** Per-line reading seconds = max(1, round(words / 2.6)). */
export function videoLineSecs(text: string): number {
  return Math.max(1, Math.round(countWords(text) / VIDEO_READ_WPS))
}

function beatWordCountV3(beat: RoteiroBeatV3): number {
  return beat.script
    .filter((l): l is ScriptLineV3 & { type: 'line' } => l.type === 'line')
    .reduce((n, l) => n + countWords(l.text), 0)
}

/** Beat read estimate = ceil(beatWordCount / 2.6 + sum(pause.duration)). */
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
