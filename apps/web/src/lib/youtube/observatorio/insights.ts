// Port of dados.js:137-171, 937-991, 1131-1219 — formulas, heatmap, niche stats, themes, patterns, attribution.
import type { Fmt as VideoFmt, ObsChannel, ObsVideo } from './types'
import { inNiche, type NicheScope } from './niche'
import { RULES } from './rules'
import { median } from './stats'
import { cadence, channelStats, syncText, type ChannelStats } from './channels'
import { outliers } from './outliers'
import { multiplierAt, type MultiplierResult } from './multiplier'
import { viewsAtIdx, type EngineCtx, type Derived } from './series'
import { DAY } from './time'
import { THEMES, THEME } from './catalog'
export { FORMULAS, FORMULA, formulasOf, THEMES, THEME, type Formula, type Theme } from './catalog'
import { FORMULAS, formulasOf } from './catalog'

type V = ObsVideo & Derived
type Ch = ObsChannel & { videos: ObsVideo[] }
const p2 = (n: number) => (n < 10 ? '0' : '') + n
const vids = (ctx: EngineCtx) => ctx.ds.videos as V[]
const chOf = (ctx: EngineCtx, id: string): Ch | undefined => ctx.CH.get(id)
const chName = (ctx: EngineCtx, id: string) => chOf(ctx, id)?.name ?? id
const lastIdxOf = (ctx: EngineCtx) => {
  let maxT = -Infinity
  for (const v of ctx.ds.videos) for (const p of v.series) if (p.t > maxT) maxT = p.t
  return ctx.clock.snapIdxAtOrBefore(maxT === -Infinity ? ctx.ds.now : maxT) // no series: now, never -Infinity
}

/* ------------------------------------------------------------------ atribuição */
export interface Attribution { kind: string; text: string; textMid: string; textStart: string; tie?: boolean; channel?: string; channels?: string[]; n?: number; n1?: number; n2?: number; total?: number }
type Noun = { one: string; many: string }
type Attr0 = Omit<Attribution, 'textMid' | 'textStart'>

function attribution0(ctx: EngineCtx, list: ReadonlyArray<string | { ch: string }>, noun?: Noun): Attr0 {
  const nn = noun || { one: 'outlier', many: 'outliers' }
  const by: Record<string, number> = {}
  list.forEach(x => { const c = typeof x === 'string' ? x : x.ch; by[c] = (by[c] || 0) + 1 })
  const e = Object.entries(by).sort((a, b) => b[1] - a[1]), tot = list.length
  if (!tot) return { kind: 'vazio', text: 'nenhum vídeo' }
  const [c1, n1] = e[0]!, second = e[1], third = e[2]
  if (tot === 1) return { kind: 'unico', channel: c1, n: 1, n1: 1, total: 1, text: '1 ' + nn.one + ': ' + chName(ctx, c1) }
  const tail = ' dos ' + tot + ' ' + nn.many, name = chName(ctx, c1), g = chOf(ctx, c1)?.gender
  if (n1 / tot > RULES.attribution.solo) return { kind: 'solo', channel: c1, n: n1, n1, total: tot, text: (g === 'f' ? name + ' sozinha assina ' : g === 'm' ? name + ' sozinho assina ' : 'só ' + name + ' assina ') + n1 + tail }
  if (second && third && second[1] === third[1]) return { kind: 'varios', tie: true, n: e.length, n1, n2: second[1], total: tot, text: 'espalhado por ' + e.length + ' canais' }
  if (second && second[1] / tot >= RULES.attribution.second) return { kind: 'dois', channels: [c1, second[0]], n: n1 + second[1], n1, n2: second[1], total: tot, text: name + ' e ' + chName(ctx, second[0]) + ' assinam ' + (n1 + second[1]) + tail }
  return { kind: 'varios', n: e.length, n1, n2: second ? second[1] : 0, total: tot, text: 'espalhado por ' + e.length + ' canais' }
}
/** `list` is channel ids or anything carrying `ch` (the mockup passes video objects). */
export function attribution(ctx: EngineCtx, list: ReadonlyArray<string | { ch: string }>, noun?: Noun): Attribution | null {
  const a = attribution0(ctx, list, noun)
  return { ...a, textMid: a.text, textStart: a.text.charAt(0).toUpperCase() + a.text.slice(1) }
}

/* ------------------------------------------------------------------ mapa de calor dia × bloco de 2 h (SP), 90 d */
const DOW_MON = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
export interface DominantChannel { id: string; name: string; share: number; n: number; of: number }
export interface HeatCell { n: number; ids: string[]; medMult: number | null; nMult: number; dominantChannel: DominantChannel | null }
export interface HeatmapResult {
  excluded: Array<{ id: string; partial: boolean; fetchedSince: number | null; reason: string }>; niche: string; fmt: VideoFmt; window: string
  days: string[]; blocks: string[]; cells: HeatCell[][]; n: number
  peak: { dow: number; block: number; n: number; dominantChannel: { id: string; n: number } | null } | null
  bestMult: { dow: number; block: number; med: number; n: number; dominantChannel: { id: string; n: number } | null } | null
  thin: Array<{ dow: number; block: number }>
}
export function heatmap(ctx: EngineCtx, niche: NicheScope | undefined, fmtId: VideoFmt = 'long'): HeatmapResult {
  const chs = [...ctx.CH.values()]
  const excluded = chs.filter(c => !c.own && inNiche(niche, c) && c.sync.state === 'backfill').map(c => ({ id: c.id, partial: true, fetchedSince: c.videos.length ? c.videos[c.videos.length - 1]!.pub : null,
    reason: c.name + ': ainda buscando vídeos (' + c.sync.backfill!.done + ' de ' + c.sync.backfill!.total + ')' }))
  const exIds = excluded.map(x => x.id)
  const vs = vids(ctx).filter(v => v.tracked && !chOf(ctx, v.ch)!.own && !exIds.includes(v.ch) && v.fmt === fmtId && v.ageDays <= 90 && inNiche(niche, v))
  const cells: HeatCell[][] = Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => ({ n: 0, ids: [], medMult: null, nMult: 0, dominantChannel: null })))
  vs.forEach(v => { const p = ctx.clock.parts(v.pub); const c = cells[(p.dow + 6) % 7]![Math.floor(p.h / 2)]!; c.n++; c.ids.push(v.id) })
  const dom = (ids: string[]) => { const by: Record<string, number> = {}; ids.forEach(id => { const c = ctx.V.get(id)!.ch; by[c] = (by[c] || 0) + 1 }); const e = Object.entries(by).sort((a, b) => b[1] - a[1])[0]; return e ? { id: e[0], n: e[1] } : null }
  let peak: HeatmapResult['peak'] = null, best: HeatmapResult['bestMult'] = null; const thin: Array<{ dow: number; block: number }> = []
  cells.forEach((row, d) => row.forEach((c, b) => {
    const m = c.ids.map(id => ctx.V.get(id)!.mult!).filter(x => x.value != null && !x.weak).map(x => x.value as number)
    c.nMult = m.length; c.medMult = m.length ? median(m) : null
    if (c.n) { const dd = dom(c.ids); if (dd && dd.n / c.n >= 0.8) c.dominantChannel = { id: dd.id, name: chName(ctx, dd.id), share: dd.n / c.n, n: dd.n, of: c.n } }
    if (c.nMult < RULES.weakBase) thin.push({ dow: d, block: b })
    if (c.n && (!peak || c.n > peak.n)) peak = { dow: d, block: b, n: c.n, dominantChannel: null }
    if (c.nMult >= RULES.weakBase && (!best || c.medMult! > best.med)) best = { dow: d, block: b, med: c.medMult!, n: c.nMult, dominantChannel: null }
  }))
  const pk = peak as HeatmapResult['peak'], bs = best as HeatmapResult['bestMult']
  if (pk) pk.dominantChannel = dom(cells[pk.dow]![pk.block]!.ids)
  if (bs) bs.dominantChannel = dom(cells[bs.dow]![bs.block]!.ids)
  return { excluded, niche: niche || 'todos', fmt: fmtId, window: '90 dias', days: DOW_MON, blocks: Array.from({ length: 12 }, (_, b) => p2(2 * b) + 'h–' + p2(2 * b + 2) + 'h'), cells, n: vs.length, peak: pk, bestMult: bs, thin }
}

/* ------------------------------------------------------------------ referência do nicho + "você" */
type Agg = NicheAgg
const agg = (arr: Array<number | null | undefined>): Agg => { const a = arr.filter((x): x is number => x != null && isFinite(x)); return { median: median(a), min: a.length ? Math.min(...a) : null, max: a.length ? Math.max(...a) : null, n: a.length } }
type ChStats = ChannelStats
const NICHE_VERDICT_THRESHOLD = 0.15, OWN_FEW_N = 10
type Ref = Record<'pw' | 'perMilSubs' | 'typicalMult' | 'engagement' | 'pctOutliers', Agg>

export type NicheMetricKey = keyof Ref
export interface NicheAgg { median: number | null; min: number | null; max: number | null; n: number }
export interface OwnMetric {
  value: number | null; median: number | null; ratio: number | null; bothZero: boolean; verdict: '▲' | '▼' | '≈' | null
  verdictText: string; label: string; n: number; few: boolean
}
export type OwnVsNiche = { channel: string; threshold: number; fewN: number } & Record<NicheMetricKey, OwnMetric>
export type NicheStats = { niche: string; fmt: VideoFmt; channels: string[] } & Record<NicheMetricKey, NicheAgg> & { own: OwnVsNiche | null }

function ownVsNiche(ctx: EngineCtx, ownId: string, fmtId: VideoFmt, ref: Record<NicheMetricKey, NicheAgg>): OwnVsNiche | null {
  if (!chOf(ctx, ownId)) return null
  const st = channelStats(ctx, ownId, fmtId), cad = cadence(ctx, ownId, fmtId)
  const vals: Record<keyof Ref, [number | null, number]> = { pw: [cad.pw, cad.n], perMilSubs: [st.perMilSubs, st.vpdN], typicalMult: [st.typicalMult, st.typicalMultN], engagement: [st.engagement.median, st.engagement.n], pctOutliers: [st.pctOutliers, st.pctOutliersN] }
  const metric = (k: keyof Ref): OwnMetric => {
    const [value, n] = vals[k], med = ref[k].median, ratio = value != null && med ? value / med : null
    const bothZero = value === 0 && med === 0, aboveZero = value != null && value > 0 && med === 0
    const verdict = bothZero ? '≈' : aboveZero ? '▲' : ratio == null ? null : ratio >= 1 + NICHE_VERDICT_THRESHOLD ? '▲' : ratio <= 1 - NICHE_VERDICT_THRESHOLD ? '▼' : '≈'
    return { value, median: med, ratio, bothZero, verdict,
      verdictText: bothZero ? 'igual à mediana do nicho (as duas em 0%)' : aboveZero ? 'acima da mediana do nicho (a mediana está em 0)' : verdict === '▲' ? 'acima da mediana do nicho' : verdict === '▼' ? 'abaixo da mediana do nicho' : verdict === '≈' ? 'na mediana do nicho (±15%)' : 'sem dado',
      label: bothZero ? 'igual à mediana (as duas em 0%)' : aboveZero ? 'acima (mediana em 0)' : ratio == null ? 'sem dado' : ctx.fmt.mult(ratio) + ' a mediana do nicho', n, few: n < OWN_FEW_N }
  }
  // key order = the mockup's (parity tests compare the JSON)
  return { channel: ownId, threshold: NICHE_VERDICT_THRESHOLD, fewN: OWN_FEW_N, pw: metric('pw'), perMilSubs: metric('perMilSubs'), typicalMult: metric('typicalMult'), engagement: metric('engagement'), pctOutliers: metric('pctOutliers') }
}
/**
 * The own channel to compare against the niche, derived from the dataset (`own: true`), never a literal id (real ids are
 * uuids and a site can have two: PT and EN). `explicit` wins when given. With several own channels: the one whose `lang` is
 * the niche's dominant competitor language (when that is determinable and picks exactly one); otherwise the one with the
 * most tracked videos (ties: first by id, so the pick is stable).
 * @internal paridade com o oráculo; telas usam ownChannels()
 */
export function ownChannelOf(ctx: EngineCtx, niche?: NicheScope, explicit?: string): Ch | undefined {
  if (explicit) return chOf(ctx, explicit)
  const owns = [...ctx.CH.values()].filter(c => c.own).sort((a, b) => a.id.localeCompare(b.id))
  if (owns.length <= 1) return owns[0]
  const langs = new Map<string, number>()
  for (const c of ctx.CH.values()) if (!c.own && c.lang && inNiche(niche, c)) langs.set(c.lang, (langs.get(c.lang) ?? 0) + 1)
  const ranked = [...langs.entries()].sort((a, b) => b[1] - a[1])
  const dominant = ranked.length && (ranked.length === 1 || ranked[0]![1] > ranked[1]![1]) ? ranked[0]![0] : null
  const byLang = dominant ? owns.filter(c => c.lang === dominant) : []
  if (byLang.length === 1) return byLang[0]
  const tracked = (c: Ch) => c.videos.filter(v => v.tracked).length
  return [...owns].sort((a, b) => tracked(b) - tracked(a))[0]
}
/** Canais próprios na ordem R73: inscritos, maior primeiro; depois nome (pt-BR); depois id. niche: undefined | 'todos' → todos; 'viagem' | 'ia' → os daquele nicho; null → os sem nicho. */
export function ownChannels(ctx: EngineCtx, niche?: NicheScope | null): Ch[] {
  const all = [...ctx.CH.values()].filter(c => c.own)
  const list = niche === undefined || niche === 'todos' ? all : all.filter(c => c.niche === niche)
  return list.sort((a, b) => b.subs - a.subs || a.name.localeCompare(b.name, 'pt-BR') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
/** A referência do nicho (mediana e faixa dos concorrentes), calculada uma vez; não depende de canal próprio. */
export type NicheRef = { niche: string; fmt: VideoFmt; channels: string[]; threshold: number; fewN: number } & Record<NicheMetricKey, NicheAgg>
export function nicheRef(ctx: EngineCtx, niche: NicheScope | undefined, fmtId: VideoFmt = 'long'): NicheRef {
  const chs = [...ctx.CH.values()].filter(c => !c.own && inNiche(niche, c))
  const st = chs.map(c => channelStats(ctx, c.id, fmtId))
  return { niche: niche || 'todos', fmt: fmtId, channels: chs.map(c => c.id), threshold: NICHE_VERDICT_THRESHOLD, fewN: OWN_FEW_N,
    pw: agg(chs.map(c => cadence(ctx, c.id, fmtId).pw)), perMilSubs: agg(st.map(x => x.perMilSubs)), typicalMult: agg(st.map(x => x.typicalMult)),
    engagement: agg(st.map(x => x.engagement.median)), pctOutliers: agg(st.map(x => x.pctOutliers)) }
}
/** Legacy single-own shape; the key order is the mockup's (parity tests compare the JSON), without threshold/fewN at the top. */
export function nicheStats(ctx: EngineCtx, niche: NicheScope | undefined, fmtId: VideoFmt = 'long', ownId?: string): NicheStats {
  const own = ownChannelOf(ctx, niche, ownId)
  const ref = nicheRef(ctx, niche, fmtId)
  return { niche: ref.niche, fmt: ref.fmt, channels: ref.channels, pw: ref.pw, perMilSubs: ref.perMilSubs, typicalMult: ref.typicalMult, engagement: ref.engagement, pctOutliers: ref.pctOutliers,
    own: own ? ownVsNiche(ctx, own.id, fmtId, ref) : null }
}
/** Texto curto do veredito: a linha "Nicho" já nomeia a referência, então sai sem " do nicho". */
export function shortVerdict(key: NicheMetricKey, m: OwnMetric): string {
  const t = key === 'pctOutliers' && !m.bothZero ? m.verdictText : (m.label || m.verdictText)
  return t.replace(' do nicho', '')
}
/** weak = base fraca (sem valor, ou n < fewN): a tela pinta o veredito em cor neutra (R74). */
export interface OwnCell extends OwnMetric { short: string; weak: boolean }
export type OwnRow = { channel: string; videos: number; empty: boolean; syncText: string } & Record<NicheMetricKey, OwnCell>
export interface OwnNicheStats { ref: NicheRef; owns: OwnRow[] }
const NICHE_KEYS: readonly NicheMetricKey[] = ['pw', 'perMilSubs', 'typicalMult', 'engagement', 'pctOutliers']
/** Um bloco por canal próprio, na ordem de `ownIds`; id desconhecido ou de concorrente é ignorado. */
export function ownNicheStats(ctx: EngineCtx, niche: NicheScope | undefined, fmtId: VideoFmt = 'long', ownIds: readonly string[]): OwnNicheStats {
  const ref = nicheRef(ctx, niche, fmtId), owns: OwnRow[] = []
  for (const id of ownIds) {
    const ch = chOf(ctx, id); if (!ch || !ch.own) continue
    const o = ownVsNiche(ctx, id, fmtId, ref); if (!o) continue
    const n = cadence(ctx, id, fmtId).n
    const cells = Object.fromEntries(NICHE_KEYS.map(k => [k, { ...o[k], short: shortVerdict(k, o[k]), weak: o[k].value == null || o[k].few }])) as Record<NicheMetricKey, OwnCell>
    owns.push({ channel: id, videos: n, empty: n === 0, syncText: syncText(ctx, ch), ...cells })
  }
  return { ref, owns }
}

/* ------------------------------------------------------------------ temas */
export interface ThemeTrendRow { trend: '▲' | '▼' | '≈'; trendText: string; delta: number; deltaPct: number | null; theme: string; label: string; now: number; prev: number; channels: string[]; medMult: number | null; nMult: number; outliers: number; ids: string[] }
/** How many of the compared videos carry a theme, per window (ruling R49: production themes come from a forja reading). */
export interface ThemeWindowCoverage { themed: number; total: number }
export interface ThemeCoverage { now: ThemeWindowCoverage; prev: ThemeWindowCoverage; minShare: number; trendable: boolean }
export type ThemeTrend = ThemeTrendRow[] & { excluded: Array<{ id: string; reason: string }>; channelsCompared: string[]; coverage: ThemeCoverage }
const winCov = (list: ObsVideo[]): ThemeWindowCoverage => ({ themed: list.filter(v => v.theme != null).length, total: list.length })
export function themeTrend(ctx: EngineCtx, niche: NicheScope | undefined, fmtId: VideoFmt = 'long'): ThemeTrend {
  // só compara canais com série nas DUAS janelas (≤ 90 d e 91–180 d)
  const excluded: Array<{ id: string; reason: string }> = [], okCh = new Set<string>()
  ;[...ctx.CH.values()].filter(c => !c.own && inNiche(niche, c)).forEach(c => {
    const tr = c.videos.filter(v => v.tracked && v.fmt === fmtId)
    if (c.sync.state === 'backfill') excluded.push({ id: c.id, reason: c.name + ': ainda buscando vídeos (' + c.sync.backfill!.done + ' de ' + c.sync.backfill!.total + '), sem série' })
    else if (!tr.length) excluded.push({ id: c.id, reason: c.name + ': sem ' + (fmtId === 'short' ? 'Shorts' : 'vídeos longos') + ' acompanhados' })
    else if (Math.max(...tr.map(v => v.ageDays)) < 180 && c.videos.some(v => !v.tracked && v.fmt === fmtId && v.ageDays <= 180)) excluded.push({ id: c.id, reason: c.name + ': os ' + c.video_limit + ' vídeos acompanhados só alcançam ' + Math.max(...tr.map(v => v.ageDays)) + ' dias — a janela de 91–180 dias ficaria incompleta' })
    else okCh.add(c.id)
  })
  const vs = vids(ctx).filter(v => v.tracked && okCh.has(v.ch) && v.fmt === fmtId && inNiche(niche, v))
  // Without any theme label (no `temas` reading yet) there is nothing to trend: empty list, never zero rows.
  const res: ThemeTrendRow[] = vs.some(v => v.theme != null) ? THEMES.filter(t => !niche || niche === 'todos' || t.niche === niche).map(t => {
    const now = vs.filter(v => v.theme === t.id && v.ageDays <= 90), prev = vs.filter(v => v.theme === t.id && v.ageDays > 90 && v.ageDays <= 180)
    const m = now.map(v => v.mult!).filter(x => x.value != null && !x.weak).map(x => x.value as number)
    const d = now.length - prev.length, pct = d / Math.max(prev.length, 1), tr = RULES.theme.trend
    const trend = d >= tr.minDelta && pct >= tr.minPct ? '▲' : -d >= tr.minDelta && -pct >= tr.minPct ? '▼' : '≈'
    return { trend, trendText: trend === '▲' ? 'subindo' : trend === '▼' ? 'caindo' : 'estável', delta: d, deltaPct: prev.length ? d / prev.length : null, theme: t.id, label: t.label, now: now.length, prev: prev.length, channels: [...new Set(now.map(v => v.ch))], medMult: median(m), nMult: m.length,
      outliers: outliers(ctx, { niche: niche || 'todos', fmt: fmtId, theme: t.id }).count, ids: now.map(v => v.id) } as ThemeTrendRow
  }).sort((a, b) => b.now - a.now) : []
  const cNow = winCov(vs.filter(v => v.ageDays <= 90)), cPrev = winCov(vs.filter(v => v.ageDays > 90 && v.ageDays <= 180))
  const min = RULES.theme.coverage.minShare
  const trendable = cNow.total > 0 && cPrev.themed > 0 && cNow.themed / cNow.total >= min && cPrev.themed / cPrev.total >= min
  return Object.assign(res, { excluded, channelsCompared: [...okCh], coverage: { now: cNow, prev: cPrev, minShare: min, trendable } })
}
/** `themed` = own videos in the window that carry a theme (ruling R49: 0 means gaps cannot be computed). */
export function ownCoverage(ctx: EngineCtx, fmtId: VideoFmt = 'long', ownId?: string): { channel: string | null; fmt: VideoFmt; window: string; n: number; themed: number; byTheme: Record<string, number>; ids: string[] } {
  const own = ownChannelOf(ctx, undefined, ownId)
  const vs = own ? own.videos.filter(v => v.fmt === fmtId && v.ageDays <= 90) : []
  const byTheme: Record<string, number> = {}; vs.forEach(v => { if (v.theme != null) byTheme[v.theme] = (byTheme[v.theme] || 0) + 1 })
  return { channel: own?.id ?? null, fmt: fmtId, window: '90 dias', n: vs.length, themed: vs.filter(v => v.theme != null).length, byTheme, ids: vs.map(v => v.id) }
}

/* ------------------------------------------------------------------ padrões (mesmo cálculo das leituras) */
export interface BaseVideo { id: string; ch: string; title: string; theme: string | null; formulas: string[]; mult: number; weak: boolean; method: MultiplierResult['method']; n: number }
export interface Base { fmt: VideoFmt; t: number; asOf: number; niche: NicheScope | undefined; windowDays: number; channels: string[]; excluded: string[]; videos: BaseVideo[] }
export function baseAt(ctx: EngineCtx, niche: NicheScope | undefined, t: number, windowDays: number, forceChannels?: string[] | null, fmtId: VideoFmt = 'long'): Base {
  const { clock } = ctx, LAST = lastIdxOf(ctx), tTime = clock.snapTime(t)
  const ageAt = (v: V) => t >= LAST ? v.ageDays : Math.floor((tTime - v.pub) / DAY)
  const all = [...ctx.CH.values()]
  const excluded = all.filter(ch => !ch.own && inNiche(niche, ch) && (ch.sync.state === 'backfill' && ch.sync.added != null && ch.sync.added > tTime ? false : ch.lastIdx != null && ch.lastIdx < t - 1))
  const chs = forceChannels ? forceChannels.map(id => chOf(ctx, id)!) : all.filter(ch => !ch.own && inNiche(niche, ch) && ch.lastIdx != null && ch.lastIdx >= t - 1)
  const out: BaseVideo[] = []
  chs.forEach(ch => ch.videos.forEach(vv => {
    const v = ctx.V.get(vv.id)!
    if (!v.tracked || v.fmt !== fmtId || v.pub >= tTime || ageAt(v) > windowDays || !v.series.length || viewsAtIdx(v, Math.min(t, ch.lastIdx!)) == null) return
    const m = multiplierAt(ctx, v, Math.min(t, ch.lastIdx!))
    if (m.value == null) return
    const titleThen = [...v.titles].reverse().find(x => x.first_seen <= tTime) || v.titles[0]!
    out.push({ id: v.id, ch: v.ch, title: titleThen.text, theme: v.theme, formulas: formulasOf(titleThen.text), mult: m.value, weak: m.weak, method: m.method, n: m.n })
  }))
  return { fmt: fmtId, t, asOf: tTime, niche, windowDays, channels: chs.map(c => c.id), excluded: excluded.map(c => c.id), videos: out }
}
function dominantTheme(list: BaseVideo[]): { theme: string | null; n?: number; total?: number; text: string } {
  const by: Record<string, number> = {}; list.forEach(v => { if (v.theme != null) by[v.theme] = (by[v.theme] || 0) + 1 })
  const e = Object.entries(by).sort((a, b) => b[1] - a[1])
  if (!e.length) return list.length ? { theme: null, n: 0, total: list.length, text: 'sem tema dominante (nenhum vídeo com tema classificado)' } : { theme: null, text: 'sem outliers' }
  const [t, n] = e[0]!
  if (n >= RULES.theme.minCount && n / list.length >= RULES.theme.minShare) return { theme: t, n, total: list.length, text: (THEME[t]?.label ?? t) + ' em ' + n + ' dos ' + list.length + ' outliers' }
  return { theme: null, n, total: list.length, text: 'sem tema dominante (o mais comum aparece em ' + n + ' dos ' + list.length + ')' }
}
export function analyzePatterns(ctx: EngineCtx, base: { niche: NicheScope | undefined; videos: BaseVideo[] }) {
  const { fmt } = ctx
  const ok = base.videos.filter(v => !v.weak), outs = ok.filter(v => v.mult >= RULES.outlierMin)
  const pats = FORMULAS.filter(f => f.niches.includes(base.niche as never)).map(f => {
    const use = ok.filter(v => v.formulas.includes(f.id)), not = ok.filter(v => !v.formulas.includes(f.id))
    const medUse = median(use.map(v => v.mult)), medNot = median(not.map(v => v.mult))
    const diff = medUse != null && medNot != null ? medUse - medNot : null
    const ev = outs.filter(v => v.formulas.includes(f.id)).sort((a, b) => b.mult - a.mult)
    let verdict: { id: string; text: string }
    if (use.length < RULES.pattern.minN) verdict = { id: 'recorrencia', text: f.label + ': ' + (use.length === 0 ? 'nenhum título com essa fórmula (n = 0)' : use.length === 1 ? 'caso isolado (n = 1) — pouco para concluir' : 'recorrência observada (n = ' + use.length + ') — pouco para concluir') }
    else if (diff! >= RULES.pattern.minDiff) verdict = { id: 'padrao', text: f.label + ': mediana ' + fmt.mult(medUse) + ' com vs ' + fmt.mult(medNot) + ' sem (n = ' + use.length + ' vs ' + not.length + ')' }
    else verdict = { id: 'sem-diferenca', text: f.label + ': sem diferença que passe a regra (' + fmt.mult(medUse) + ' com vs ' + fmt.mult(medNot) + ' sem, n = ' + use.length + ')' }
    return { formula: f.id, label: f.label, nUse: use.length, nNot: not.length, medUse, medNot, diff, verdict, evidence: ev.map(v => v.id),
      attribution: ev.length ? attribution(ctx, ev, { one: 'outlier com essa fórmula', many: 'outliers com essa fórmula' }) : attribution(ctx, use, { one: 'vídeo com essa fórmula', many: 'vídeos com essa fórmula' }) }
  })
  return { patterns: pats, outliers: outs.map(v => v.id), nOutliers: outs.length, dominantTheme: dominantTheme(outs) }
}
export function patternsNow(ctx: EngineCtx, niche: NicheScope | undefined, fmtId: VideoFmt = 'long') {
  const base = baseAt(ctx, niche, lastIdxOf(ctx), 182, null, fmtId)
  return Object.assign({ niche, fmt: fmtId, asOf: base.asOf, nVideos: base.videos.length, channels: base.channels, excluded: base.excluded, base }, analyzePatterns(ctx, base))
}
