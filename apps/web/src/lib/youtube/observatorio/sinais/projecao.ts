// Projeção dos outliers a partir do motor (F2 T6). Régua única D6: `obs.outliers({ maxAge: 30, fmt })` com
// `!weak && phase.id === 'estourando'`, para long e short. Nenhuma régua paralela; não usa EngineCtx.
import type { Observatory } from '../index'
import type { Fmt } from '../types'
import { tokensDe } from './tokens'
import type { OutlierProjetado } from './oportunidades'

const FORMATOS: readonly Fmt[] = ['long', 'short']

export interface ProjecaoDoMotor {
  outliers: OutlierProjetado[]
  canaisSemRitmo: number
  canaisTotal: number
  /** Coerente com a lista: quantos de `outliers` têm `chaves` vazias. */
  outliersSemLugar: number
}

/**
 * `nBase`: por 'canal|formato', o conjunto que `median7` usa (tracked, mesmo formato, `vpd7` medido) e a mediana dele.
 * Uma passada em O(V) sobre `obs.videos`.
 */
function montarNBase(obs: Observatory): Map<string, { n: number; m7: number }> {
  const grupos = new Map<string, number[]>()
  for (const v of obs.videos) {
    if (!v.tracked || v.vpd7 == null) continue
    const k = `${v.ch}|${v.fmt}`
    const g = grupos.get(k)
    if (g) g.push(v.vpd7)
    else grupos.set(k, [v.vpd7])
  }
  const out = new Map<string, { n: number; m7: number }>()
  for (const [k, vs] of grupos) {
    const m7 = obs.median(vs)
    if (m7 != null) out.set(k, { n: vs.length, m7 })
  }
  return out
}

/** Canal em `sem-ritmo`: a fase de qualquer vídeo dele; canal sem vídeo cai no mesmo teste de sincronização do motor. */
function canaisSemRitmoDe(obs: Observatory): { semRitmo: number; total: number } {
  const umVideoPorCanal = new Map<string, string>()
  for (const v of obs.videos) if (!umVideoPorCanal.has(v.ch)) umVideoPorCanal.set(v.ch, v.id)
  let semRitmo = 0
  let total = 0
  for (const c of obs.channels) {
    if (c.own) continue
    total++
    const vid = umVideoPorCanal.get(c.id)
    const sem = vid !== undefined
      ? obs.phaseOf(vid).id === 'sem-ritmo'
      : c.sync.state === 'atrasado' || c.sync.state === 'erro' || c.sync.state === 'backfill'
    if (sem) semRitmo++
  }
  return { semRitmo, total }
}

export function projetarOutliers(
  obs: Observatory,
  lugarDe: (videoId: string) => string[],
  textoDe: (videoId: string) => string,
): ProjecaoDoMotor {
  const nBase = montarNBase(obs)
  const outliers: OutlierProjetado[] = []
  const vistos = new Set<string>()
  for (const fmt of FORMATOS) {
    for (const item of obs.outliers({ maxAge: 30, fmt }).items) {
      if (item.weak || item.phase.id !== 'estourando') continue
      const v = item.video
      const base = nBase.get(`${v.ch}|${v.fmt}`)
      if (!base || v.vpd7 == null || base.m7 <= 0 || item.mult.value == null) continue
      // uuid de competitor_videos.id (nunca o video_id do YouTube); um vídeo só entra uma vez
      if (vistos.has(item.id)) continue
      vistos.add(item.id)
      outliers.push({
        videoId: item.id,
        canalId: v.ch,
        formato: v.fmt,
        publishedAt: new Date(v.pub).toISOString(),
        mult: v.vpd7 / base.m7,
        multTela: item.mult.value,
        vpd7: v.vpd7,
        nCanal: base.n,
        chaves: lugarDe(item.id),
        tokens: tokensDe(textoDe(item.id)),
        deHoje: true,
      })
    }
  }
  const { semRitmo, total } = canaisSemRitmoDe(obs)
  return {
    outliers,
    canaisSemRitmo: semRitmo,
    canaisTotal: total,
    outliersSemLugar: outliers.filter((o) => o.chaves.length === 0).length,
  }
}

/** Linha de `niche_outliers_vistos` (colunas lidas). */
export interface VistoRow {
  video_id: string
  canal_id: string
  formato: string
  published_at: string
  n_canal: number
  ultimo_visto_em: string
  mult_max: number | string
  vpd7_max: number | string
  chaves: string[]
}
/** Linha de `niche_signals_ancoras(p_site)`. */
export interface AncoraRow { subject_key: string; video_id: string }

const DIA_MS = 86_400_000

/**
 * M2: as chaves dos vistos e das âncoras são recompostas por `video_lugares` (a semente nova vale para o que já foi visto).
 * `conhecido(id)` diz se o vídeo tem linha em `video_lugares`; sem linha (vídeo podado) ficam as chaves gravadas.
 * Os vistos recompostos têm `deHoje: false`, `tokens` vazios (só os de hoje geram `parecido`) e nunca repetem um `videoId` de hoje.
 * Âncora recomposta: por chave de evento (as chaves que aparecem nas âncoras), o vídeo visto cuja chave nova a contém.
 */
export function recomporVistos(args: {
  vistos: readonly VistoRow[]
  ancoras: readonly AncoraRow[]
  lugarDe: (videoId: string) => string[]
  conhecido?: (videoId: string) => boolean
  idsDeHoje: ReadonlySet<string>
  agora: Date
  janelaDias: number
}): { outliers: OutlierProjetado[]; ancorasPorChave: Map<string, Set<string>> } {
  const { vistos, ancoras, lugarDe, idsDeHoje, agora, janelaDias } = args
  const conhecido = args.conhecido ?? ((): boolean => true)
  const corte = agora.getTime() - janelaDias * DIA_MS
  const chavesDe = (id: string, gravadas: readonly string[]): string[] => (conhecido(id) ? lugarDe(id) : [...gravadas])

  const chavesDosVistos = new Map<string, string[]>()
  const outliers: OutlierProjetado[] = []
  for (const v of vistos) {
    const chaves = chavesDe(v.video_id, v.chaves)
    chavesDosVistos.set(v.video_id, chaves)
    if (idsDeHoje.has(v.video_id)) continue
    if (Date.parse(v.ultimo_visto_em) < corte) continue
    if (v.formato !== 'long' && v.formato !== 'short') continue
    const mult = Number(v.mult_max)
    outliers.push({
      videoId: v.video_id,
      canalId: v.canal_id,
      formato: v.formato,
      publishedAt: new Date(v.published_at).toISOString(),
      mult,
      multTela: mult,
      vpd7: Number(v.vpd7_max),
      nCanal: v.n_canal,
      chaves,
      tokens: [],
      deHoje: false,
    })
  }

  // chaves de evento = as que aparecem nas âncoras; vídeo âncora = o que a função devolveu para alguma delas
  const chavesDeEvento = new Set(ancoras.map((a) => a.subject_key))
  const antigas = new Map<string, string[]>()
  for (const a of ancoras) {
    const l = antigas.get(a.video_id)
    if (l) l.push(a.subject_key)
    else antigas.set(a.video_id, [a.subject_key])
  }
  const ancorasPorChave = new Map<string, Set<string>>()
  for (const [id, gravadas] of antigas) {
    const chaves = chavesDosVistos.get(id) ?? chavesDe(id, gravadas)
    for (const c of chaves) {
      if (!chavesDeEvento.has(c)) continue
      const s = ancorasPorChave.get(c)
      if (s) s.add(id)
      else ancorasPorChave.set(c, new Set([id]))
    }
  }
  return { outliers, ancorasPorChave }
}
