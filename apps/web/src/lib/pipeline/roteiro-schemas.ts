import { z } from 'zod'

// ── Script line discriminated union ──────────────────
export const ScriptLineLineSchema = z.object({
  type: z.literal('line'),
  text: z.string().min(1),
  accent: z.string().optional(),
})

export const ScriptLinePauseSchema = z.object({
  type: z.literal('pause'),
  duration: z.number().min(0).max(30),
})

export const ScriptLineNoteSchema = z.object({
  type: z.literal('note'),
  tag: z.enum(['VISUAL', 'DIRECTION', 'NARRACAO']),
  text: z.string().min(1),
})

export const ScriptLineRefSchema = z.object({
  type: z.literal('ref'),
  text: z.string().min(1),
})

export const ScriptLineSchema = z.discriminatedUnion('type', [
  ScriptLineLineSchema,
  ScriptLinePauseSchema,
  ScriptLineNoteSchema,
  ScriptLineRefSchema,
])

export type ScriptLine = z.infer<typeof ScriptLineSchema>

// ── Beat ─────────────────────────────────────────────
export const RoteiroBeatSchema = z.object({
  idx: z.number().int().min(0),
  name: z.string().min(1),
  status: z.enum(['PENDING', 'DONE']).default('PENDING'),
  duration: z.number().int().min(0).optional(),
  script: z.array(ScriptLineSchema).default([]),
})

export type RoteiroBeat = z.infer<typeof RoteiroBeatSchema>

// ── Meta ─────────────────────────────────────────────
export const RoteiroMetaSchema = z.object({
  canal: z.string().optional(),
  formato: z.string().optional(),
  angulos: z.string().optional(),
  duracao: z.string().optional(),
  framework: z.string().optional(),
  fonte_vvs: z.string().optional(),
})

export type RoteiroMeta = z.infer<typeof RoteiroMetaSchema>

// ── Root content (v2) ────────────────────────────────
export const RoteiroContentSchema = z.object({
  version: z.literal(2),
  meta: RoteiroMetaSchema.default({}),
  beats: z.array(RoteiroBeatSchema).default([]),
})

export type RoteiroContent = z.infer<typeof RoteiroContentSchema>

// ── Legacy v1 types (from current script-renderer) ───
interface LegacyBeat {
  number: number
  label: string
  text: string
  status?: string
  divergence_note?: string
}

interface LegacyScriptContent {
  meta?: Record<string, string | undefined>
  beats?: LegacyBeat[]
}

/**
 * Parses a v1 beat's text field into ScriptLine[].
 * Uses regex patterns matching the tag syntax from parse-script-tags.ts.
 */
function parseLegacyBeatText(text: string): ScriptLine[] {
  const lines: ScriptLine[] = []
  const TAG_RE = /\[(VISUAL|DIRECTION|DIREÇÃO|TOM|B-ROLL|CORTE|OVERLAY|TRANS|SFX):\s*(.+?)\]/g
  const PAUSE_RE = /\[PAUS[EA]\s+([\d.]+)s?\]/g
  const QUOTE_RE = /"([^"]+)"/g
  const REF_RE = /^Reference\s*[-—–]\s*/i

  // Extract tags
  let m: RegExpExecArray | null
  const consumed = new Set<string>()

  TAG_RE.lastIndex = 0
  while ((m = TAG_RE.exec(text)) !== null) {
    consumed.add(m[0])
    let tag = m[1]!
    if (tag === 'DIREÇÃO') tag = 'DIRECTION'
    // Map non-standard tags to closest match
    if (['TOM', 'B-ROLL', 'CORTE', 'OVERLAY', 'TRANS', 'SFX'].includes(tag)) {
      tag = 'VISUAL' // bucket under VISUAL for v2
    }
    const noteTag = tag as 'VISUAL' | 'DIRECTION' | 'NARRACAO'
    lines.push({ type: 'note', tag: noteTag, text: m[2]! })
  }

  PAUSE_RE.lastIndex = 0
  while ((m = PAUSE_RE.exec(text)) !== null) {
    consumed.add(m[0])
    lines.push({ type: 'pause', duration: parseFloat(m[1]!) })
  }

  // Strip consumed tokens, then extract quotes as lines
  let remaining = text
  for (const token of consumed) {
    remaining = remaining.replace(token, '')
  }

  QUOTE_RE.lastIndex = 0
  while ((m = QUOTE_RE.exec(remaining)) !== null) {
    lines.push({ type: 'line', text: m[1]! })
  }

  // Check for reference text
  const stripped = remaining.replace(/"[^"]+"/g, '').trim()
  if (stripped && REF_RE.test(stripped)) {
    lines.push({ type: 'ref', text: stripped.replace(REF_RE, '').trim() })
  } else if (stripped && !consumed.size && !lines.some(l => l.type === 'line')) {
    // Entire text is a single spoken line (no tags, no quotes)
    lines.push({ type: 'line', text: text.trim() })
  }

  return lines
}

/**
 * Migrates a legacy v1 beat to v2 RoteiroBeat.
 */
export function legacyBeatToNew(beat: LegacyBeat): RoteiroBeat {
  return {
    idx: beat.number,
    name: beat.label,
    status: beat.status?.toUpperCase() === 'DONE' || beat.status?.toUpperCase() === 'GRAVADO' ? 'DONE' : 'PENDING',
    script: parseLegacyBeatText(beat.text),
  }
}

/**
 * Migrates v1 ScriptContent to v2 RoteiroContent.
 * Returns a valid v2 object. Idempotent — if already v2, returns as-is.
 */
export function migrateV1toV2(content: unknown): RoteiroContent {
  // Already v2
  if (
    typeof content === 'object' && content !== null &&
    !Array.isArray(content) &&
    (content as Record<string, unknown>).version as number >= 2
  ) {
    return RoteiroContentSchema.parse(content)
  }

  if (typeof content === 'string') {
    return {
      version: 2,
      meta: {},
      beats: [{ idx: 0, name: 'Beat 1', status: 'PENDING', script: [{ type: 'line', text: content }] }],
    }
  }

  const legacy = (content ?? {}) as LegacyScriptContent
  const meta: RoteiroMeta = {
    canal: legacy.meta?.canal,
    formato: legacy.meta?.formato,
    angulos: legacy.meta?.angulos,
    duracao: legacy.meta?.duracao,
    framework: legacy.meta?.framework,
    fonte_vvs: legacy.meta?.fonte_vvs,
  }

  const beats = (legacy.beats ?? []).map(legacyBeatToNew)

  return { version: 2, meta, beats }
}

export function createEmptyBeat(idx: number): RoteiroBeat {
  return { idx, name: `Beat ${idx + 1}`, status: 'PENDING', script: [] }
}

export function fmtDur(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${m}m`
}

const MAX_WORD_COUNT_LENGTH = 100_000

export function beatWordCount(beat: RoteiroBeat): number {
  return beat.script
    .filter((l): l is ScriptLine & { type: 'line' } => l.type === 'line')
    .reduce((n, l) => {
      const safe = l.text.length > MAX_WORD_COUNT_LENGTH ? l.text.slice(0, MAX_WORD_COUNT_LENGTH) : l.text
      const trimmed = safe.trim()
      return n + (trimmed ? trimmed.split(/\s+/).length : 0)
    }, 0)
}

export function beatReadTime(beat: RoteiroBeat): number {
  const words = beatWordCount(beat)
  const pauses = beat.script
    .filter((l): l is ScriptLine & { type: 'pause' } => l.type === 'pause')
    .reduce((n, l) => n + l.duration, 0)
  return Math.ceil(words / 2.5 + pauses)
}

// ── v3 script lines ──────────────────────────────────
export const ScriptLineLineSchemaV3 = z.object({
  type: z.literal('line'),
  text: z.string().min(1),
  key: z.boolean().optional(),     // anchor line (Pós "Momentos-chave", orange accent)
  accent: z.string().optional(),    // kept for back-compat; deprecated
})
// On-camera ACTION (talent does it, not reads it): interview prompt, "approach the
// finisher", "capture the price board". Performer-flow, but rendered as a checklist
// item rather than a teleprompter line. `key` marks an anchor action.
export const ScriptLineActionSchema = z.object({
  type: z.literal('action'),
  text: z.string().min(1),
  key: z.boolean().optional(),
})
export const ScriptLineDirSchema = z.object({ type: z.literal('dir'), text: z.string().min(1) }) // talent tone note
export const ScriptLineVisSchema = z.object({ type: z.literal('vis'), text: z.string().min(1) }) // editor → b-roll
export const ScriptLineEdSchema = z.object({ type: z.literal('ed'), text: z.string().min(1) })   // editor-only

export const ScriptLineSchemaV3 = z.discriminatedUnion('type', [
  ScriptLineLineSchemaV3,
  ScriptLineActionSchema,
  ScriptLinePauseSchema,
  ScriptLineDirSchema,
  ScriptLineVisSchema,
  ScriptLineEdSchema,
])
export type ScriptLineV3 = z.infer<typeof ScriptLineSchemaV3>

// Beat KIND — what the talent does with this beat when the camera rolls.
//   fala   → spoken lines (teleprompter reading flow). DEFAULT when absent.
//   acao   → on-camera actions/prompts (checklist; e.g. interviews, captures).
//   prep   → pre-shoot logistics (kit, capture timeline, must-gets). Out of the
//            reading flow → collapsed "Antes de gravar" strip.
//   editor → editor-directed (b-roll shot lists, visual coverage). Routed to Pós;
//            never shown in the performer flow (only behind "Notas do editor").
// Optional + back-compat: legacy beats carry no kind and are classified at read
// time by `beatKind()` (video-perform.ts), so existing roteiros render correctly
// without a rewrite.
export const BeatKindSchema = z.enum(['fala', 'acao', 'prep', 'editor'])
export type BeatKind = z.infer<typeof BeatKindSchema>

export const RoteiroBeatSchemaV3 = z.object({
  idx: z.number().int().min(0),
  // Stable durable identity for recording status (keyed on (pipeline_id, lang, beat_id)).
  // Optional + back-compat: legacy v3 content carries no id; lazily stamped via
  // ensureBeatIds() on save. Does NOT bump the content version.
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  status: z.enum(['PENDING', 'DONE']).default('PENDING'),
  kind: BeatKindSchema.optional(),
  duration: z.number().int().min(0).optional(),
  tone: z.string().optional(),
  script: z.array(ScriptLineSchemaV3).default([]),
})
export type RoteiroBeatV3 = z.infer<typeof RoteiroBeatSchemaV3>

export const RoteiroContentSchemaV3 = z.object({
  version: z.literal(3),
  meta: RoteiroMetaSchema.default({}),
  beats: z.array(RoteiroBeatSchemaV3).default([]),
})
export type RoteiroContentV3 = z.infer<typeof RoteiroContentSchemaV3>

/**
 * Migrates a v2 RoteiroContent to v3. Idempotent; only meant to run for version < 3
 * (via readRoteiro). note(VISUAL)→vis, note(NARRACAO)→ed, note(DIRECTION)+ref → beat.tone,
 * line{accent:'key'|truthy}→line{key:true}, pause unchanged.
 */
export function migrateV2toV3(content: unknown): RoteiroContentV3 {
  if (
    typeof content === 'object' && content !== null &&
    !Array.isArray(content) &&
    (content as Record<string, unknown>).version === 3
  ) {
    return RoteiroContentSchemaV3.parse(content)
  }

  // Capture raw beats before Zod parse strips unknown fields (e.g. tone on v2 beats)
  const rawBeats: Array<{ tone?: string }> =
    typeof content === 'object' && content !== null && !Array.isArray(content) &&
    Array.isArray((content as Record<string, unknown>).beats)
      ? ((content as Record<string, unknown>).beats as Array<{ tone?: string }>)
      : []

  const v2 = RoteiroContentSchema.parse(content)

  const beats: RoteiroBeatV3[] = v2.beats.map((beat, i) => {
    const rawTone = rawBeats[i]?.tone
    const script: ScriptLineV3[] = []
    const toneParts: string[] = []
    if (beat.duration === undefined) { /* duration stays optional */ }

    for (const line of beat.script) {
      switch (line.type) {
        case 'line': {
          const isKey = line.accent === 'key'
          script.push(isKey ? { type: 'line', text: line.text, key: true } : { type: 'line', text: line.text })
          break
        }
        case 'pause':
          script.push({ type: 'pause', duration: line.duration })
          break
        case 'note':
          if (line.tag === 'VISUAL') script.push({ type: 'vis', text: line.text })
          else if (line.tag === 'NARRACAO') script.push({ type: 'ed', text: line.text })
          else toneParts.push(line.text) // DIRECTION → tone
          break
        case 'ref':
          toneParts.push(line.text) // ref → tone
          break
      }
    }

    const migratedTone = toneParts.join(' · ').trim()
    const tone = [/* preserve existing v2 tone if any */ rawTone, migratedTone || undefined]
      .filter((t): t is string => !!t && t.trim().length > 0)
      .join(' · ') || undefined
    return {
      idx: beat.idx,
      name: beat.name,
      status: beat.status,
      ...(beat.duration !== undefined ? { duration: beat.duration } : {}),
      ...(tone ? { tone } : {}),
      script,
    }
  })

  return { version: 3, meta: v2.meta, beats }
}

/**
 * Canonical read adapter: dispatch on version FIRST. v3 passes through untouched;
 * v1/v2/legacy/string run the full chain. No caller may invoke migrateV1toV2 directly
 * on a possibly-v3 row.
 */
export function readRoteiro(raw: unknown): RoteiroContentV3 {
  const v = (raw as { version?: number })?.version
  if (v === 3) return RoteiroContentSchemaV3.parse(raw)
  const v2 = migrateV1toV2(raw)
  return migrateV2toV3(v2)
}
