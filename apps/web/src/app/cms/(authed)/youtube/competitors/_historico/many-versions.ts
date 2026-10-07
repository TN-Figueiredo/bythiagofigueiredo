/**
 * Histórico com muitas versões (plan 2026-10-07-observatorio-historico-muitas-versoes): the pure pieces the view model
 * composes. No pixel here and no React: period filter, image summary, the situation of a change and its short line.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import type { EffectResult } from '@/lib/youtube/observatorio/effect'

const DAY = 864e5

export type RangeId = '7' | '30' | '90' | 'tudo'
export const RANGE_IDS: readonly RangeId[] = ['7', '30', '90', 'tudo']
export const RANGE_LABEL: Record<RangeId, string> = { '7': '7 d', '30': '30 d', '90': '90 d', tudo: 'tudo' }
export const RANGE_LONG: Record<RangeId, string> = { '7': 'últimos 7 dias', '30': 'últimos 30 dias', '90': 'últimos 90 dias', tudo: 'desde a publicação' }

/** Anything that is not one of the three windows (absent, garbage, or a video the filter is not offered for) is the whole video. */
export function parseRange(raw: string | undefined, offered: boolean): RangeId {
  return offered && (raw === '7' || raw === '30' || raw === '90') ? raw : 'tudo'
}
/** Start (ms) of the shown period: never before the publication. */
export function rangeStart(range: RangeId, pub: number, now: number): number {
  return range === 'tudo' ? pub : Math.max(pub, now - Number(range) * DAY)
}

/** "Veredito" is only ganhou / perdeu; everything else is a situation with its own name (mockup decision C11). */
export type Situation = 'ganhou' | 'perdeu' | 'neutro' | 'inconclusivo' | 'aguardando' | 'sem-base'
export const SITUATIONS: ReadonlyArray<[Situation, string]> = [['ganhou', 'ganhou'], ['perdeu', 'perdeu'], ['neutro', 'neutro'], ['inconclusivo', 'inconclusivo'], ['aguardando', 'aguardando'], ['sem-base', 'sem base']]
export const situationOf = (e: Pick<EffectResult, 'status'>): Situation => (e.status === 'sem-antes' || e.status === 'sem-serie' ? 'sem-base' : e.status)

type IncKind = NonNullable<EffectResult['inconclusiveKind']>
/** The short reason of an inconclusive change. A Record over the engine's union: a new kind does not compile until it has a text. */
export function kindShort(obs: Observatory): Record<IncKind, string> {
  const E = obs.RULES.effect
  return {
    'troca-seguinte': 'outra troca nos ' + E.afterDays + ' dias depois',
    'janela-dupla': 'dois campos em menos de ' + E.simultHours + ' h',
    'versao-curta': 'versão com menos de 1 dia no ar',
    'antes-curto': 'antes curto demais',
    outro: 'outro motivo',
  }
}
const STATUS_WORD: Record<EffectResult['status'], string> = { ganhou: 'ganhou', perdeu: 'perdeu', neutro: 'neutro', inconclusivo: 'inconclusivo', aguardando: 'aguardando', 'sem-antes': 'sem base', 'sem-serie': 'sem série' }
/** One line per change in the lists: "inconclusivo: outra troca nos 7 dias depois", "aguardando (3 de 7 dias)", "ganhou". */
export function statusLine(obs: Observatory, e: EffectResult): string {
  if (e.status === 'inconclusivo') return 'inconclusivo: ' + kindShort(obs)[e.inconclusiveKind ?? 'outro']
  if (e.status === 'aguardando') return 'aguardando (' + (e.collected ?? 0) + ' de ' + obs.RULES.effect.afterDays + ' dias)'
  return STATUS_WORD[e.status]
}

/** One period of a thumbnail image on air (ms). `full` = the card of this period has an average. */
export interface Pass { label: string; startMs: number; endMs: number; cur: boolean }
export interface ImageSumRow { label: string; passes: number; ms: number; tenths: number; durText: string; rateText: string; cur: boolean; segs: Array<[number, number]> }
export interface ImageSum { rows: ImageSumRow[]; total: { images: number; passes: number; ms: number; durText: string; rateText: string }; returned: number }

const tenthsText = (t: number) => (t === 0 ? 'menos de 0,1 d' : '≈ ' + Math.floor(t / 10) + ',' + (t % 10) + ' d')

/**
 * One row per distinct image, inside [fromMs, toMs]. Time on air is in tenths of a day; the tenths are handed out by
 * largest remainder so the column adds up to the total shown. The average only takes the periods that have an average
 * on their own card (1 day or more on air with a day of records inside): an image with none has no average.
 * `returned` counts the images with 2 or more periods in the WHOLE list (not only inside the interval).
 */
export function imageSummary(obs: Observatory, videoId: string, passes: readonly Pass[], fromMs: number, toMs: number): ImageSum {
  interface Acc { label: string; passes: number; ms: number; s: number; w: number; cur: boolean; segs: Array<[number, number]>; longest: number; order: number }
  const acc = new Map<string, Acc>(), all = new Map<string, number>(), first = new Map<string, number>()
  passes.forEach((p, i) => {
    all.set(p.label, (all.get(p.label) ?? 0) + 1)
    if (!first.has(p.label)) first.set(p.label, i)
    const order = first.get(p.label)!
    const a = Math.max(p.startMs, fromMs), b = Math.min(p.endMs, toMs)
    if (b <= a) return
    let r = acc.get(p.label)
    if (!r) { r = { label: p.label, passes: 0, ms: 0, s: 0, w: 0, cur: false, segs: [], longest: 0, order }; acc.set(p.label, r) }
    r.passes++; r.ms += b - a; r.cur = r.cur || p.cur; r.segs.push([a, b]); r.longest = Math.max(r.longest, p.endMs - p.startMs)
    if (obs.periodRate(videoId, p.startMs, p.endMs).vpd == null) return
    const part = obs.periodRate(videoId, a, b)
    if (part.vpd != null) { r.s += part.vpd * part.coveredHours; r.w += part.coveredHours }
  })
  const list = [...acc.values()].sort((x, y) => x.order - y.order)
  const totalMs = list.reduce((s, r) => s + r.ms, 0), totalT = Math.round((totalMs / DAY) * 10)
  const parts = list.map(r => { const exact = (r.ms / DAY) * 10, tenths = Math.floor(exact); return { r, tenths, rem: exact - tenths } })
  let left = totalT - parts.reduce((s, x) => s + x.tenths, 0)
  for (const x of [...parts].sort((a, b) => b.rem - a.rem)) { if (left <= 0) break; x.tenths++; left-- }
  const F = obs.fmt
  const rows: ImageSumRow[] = parts.map(({ r, tenths }) => ({
    label: r.label, passes: r.passes, ms: r.ms, tenths, durText: tenthsText(tenths), cur: r.cur, segs: r.segs,
    rateText: r.longest < DAY ? (r.passes === 1 ? 'menos de 1 dia no ar, sem média' : 'menos de 1 dia em cada passagem, sem média')
      : r.w < 24 ? 'sem registro diário no período' : '≈ ' + F.num(r.s / r.w),
  }))
  const tot = toMs - fromMs >= DAY ? obs.periodRate(videoId, fromMs, toMs) : null
  return {
    rows,
    total: { images: rows.length, passes: rows.reduce((s, r) => s + r.passes, 0), ms: totalMs, durText: tenthsText(totalT), rateText: tot && tot.vpd != null ? '≈ ' + F.num(tot.vpd) : 'sem registro diário no período' },
    returned: [...all.values()].filter(n => n >= 2).length,
  }
}
