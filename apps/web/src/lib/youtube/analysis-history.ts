import { PatternItemSchema, isPadraoDetectado } from './intelligence-schemas'
import type { Axis } from './scoring-types'

/**
 * The channel-level analysis history as the Health Coach shows it. Since migration
 * 20260922000001 every analysis is a new row instead of overwriting the last, so this is a
 * straight newest-first read; this module only turns jsonb into something the screen can
 * print without guessing.
 *
 * Rows are jsonb written by two producers over time (Cowork since May, the forja since
 * 22/09), so every field is checked, never cast: a malformed pattern is dropped, not
 * rendered as zeros.
 */

export const HISTORY_SOURCES = ['cowork', 'forja'] as const
export type HistorySource = (typeof HISTORY_SOURCES)[number]

/**
 * The forja's analyses before this instant ran without the series map and counted hidden
 * videos (35 vs 31 public). Their numbers do not compare with later ones, and the site has no
 * other way to know: the rows look like any analysis that simply found no series. Written
 * once, by hand — the map landed on the forja at 07:24 BRT on 23/09/2026.
 */
export const FORJA_SERIES_SINCE = '2026-09-23T10:00:00Z'

const AXES: readonly Axis[] = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']

export type SeriesReading = 'abaixo' | 'acima' | 'neutra' | 'sem_coorte'

export interface HistorySeries {
  serie: string
  nome: string
  anos: { de: number; ate: number } | null
  /** The median episode's year — the year the cohort is taken from. */
  ano: number | null
  n: number | null
  mediana: number | null
  medianaCoorte: number | null
  nCoorte: number | null
  razao: number | null
  leitura: SeriesReading | null
  /** True for a series the forja turned into a pattern (it moved away from its cohort). */
  comVeredito: boolean
  motivo: string | null
}

export interface HistoryEntry {
  id: string
  source: HistorySource
  generatedAt: string
  summary: string
  summarySource: 'model' | 'template' | null
  priorities: Array<{ axis: Axis; action: string }>
  /** Old-shape findings (Cowork): counted, not rendered — the cards above already show them. */
  findingCount: number
  series: HistorySeries[]
  /** A forja analysis from before the series map: its counts do not compare with later ones. */
  legacyForja: boolean
}

export interface HistoryRow {
  id: unknown
  source: unknown
  generated_at: unknown
  coaching: unknown
  patterns_detected: unknown
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function toHistoryEntry(row: HistoryRow): HistoryEntry | null {
  if (typeof row.id !== 'string' || typeof row.generated_at !== 'string') return null
  if (!(HISTORY_SOURCES as readonly unknown[]).includes(row.source)) return null
  if (Number.isNaN(Date.parse(row.generated_at))) return null
  const source = row.source as HistorySource
  const coaching = isObj(row.coaching) ? row.coaching : {}
  const summary = typeof coaching.summary === 'string' ? coaching.summary : ''

  const priorities: HistoryEntry['priorities'] = []
  if (Array.isArray(coaching.priorities)) {
    for (const p of coaching.priorities) {
      if (!isObj(p) || typeof p.action !== 'string') continue
      if (!(AXES as readonly unknown[]).includes(p.axis)) continue
      priorities.push({ axis: p.axis as Axis, action: p.action })
    }
  }

  let findingCount = 0
  const series: HistorySeries[] = []
  if (Array.isArray(row.patterns_detected)) {
    for (const raw of row.patterns_detected) {
      const parsed = PatternItemSchema.safeParse(raw)
      if (!parsed.success) {
        // Cowork wrote these before the schema grew required fields; a finding is a finding.
        if (isObj(raw) && typeof raw.finding === 'string') findingCount++
        continue
      }
      const item = parsed.data
      // A pattern with a series slug is the forja's; anything else is an old-shape finding.
      if (isPadraoDetectado(item) && !item.serie) {
        findingCount++
        continue
      }
      const serie = item.serie!
      series.push({
        serie,
        nome: item.nome ?? serie,
        anos: item.anos ?? (item.ano !== undefined ? { de: item.ano, ate: item.ano } : null),
        ano: num(item.ano),
        n: num(item.n),
        mediana: num(item.mediana),
        medianaCoorte: num(item.mediana_coorte),
        nCoorte: num(item.n_coorte),
        razao: num(item.razao),
        leitura: item.leitura ?? null,
        comVeredito: isPadraoDetectado(item),
        motivo: isPadraoDetectado(item) ? null : item.motivo,
      })
    }
  }

  return {
    id: row.id,
    source,
    generatedAt: row.generated_at,
    summary,
    summarySource: coaching.summary_source === 'model' || coaching.summary_source === 'template'
      ? coaching.summary_source
      : null,
    priorities,
    findingCount,
    series,
    legacyForja: source === 'forja' && Date.parse(row.generated_at) < Date.parse(FORJA_SERIES_SINCE),
  }
}

export interface SeriesTimeline {
  serie: string
  nome: string
  points: Array<{ generatedAt: string; razao: number; leitura: SeriesReading | null }>
}

/**
 * Each series' ratio across analyses, oldest first — "what changed after I did X". Only
 * series with two or more measured points: one point is not a timeline, and a point with no
 * ratio (no cohort) is left out rather than drawn as zero.
 */
export function seriesTimelines(entries: HistoryEntry[]): SeriesTimeline[] {
  const bySerie = new Map<string, SeriesTimeline>()
  for (const e of [...entries].reverse()) {
    for (const s of e.series) {
      if (s.razao === null) continue
      const t = bySerie.get(s.serie) ?? { serie: s.serie, nome: s.nome, points: [] }
      t.points.push({ generatedAt: e.generatedAt, razao: s.razao, leitura: s.leitura })
      t.nome = s.nome
      bySerie.set(s.serie, t)
    }
  }
  return [...bySerie.values()].filter(t => t.points.length >= 2)
}
