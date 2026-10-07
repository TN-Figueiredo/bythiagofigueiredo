/**
 * Mudanças view model (port of mudancas.html renderSummary/renderLedger/renderFeed/renderEmpty). Pure: every number and
 * text comes from the engine (changesIn, change, effect, caveats, titleDiff, diff, fmt, date, link). The screen only
 * draws what this returns; nothing is computed in the components.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import { buildForjaView, forjaReadingView, groupsOf, type ForjaView } from '../_chrome/forja-view-model'
import type { ObsChange } from '@/lib/youtube/observatorio/changes'
import type { EffectResult, EffectStatus } from '@/lib/youtube/observatorio/effect'
import type { TitleDiff, TitleSpan } from '@/lib/youtube/observatorio/text-diff'
import { forjaOrder, parseNiche, type NicheScope } from '@/lib/youtube/observatorio/niche'
import type { Fmt, Niche, ObsVideo, ThumbVersion } from '@/lib/youtube/observatorio/types'
import { isObserved } from '@/lib/youtube/observatorio/observed'
import { pinViewOf, type PinView } from '../_chrome/pin-view'

/* ------------------------------------------------------------------ public types */
export type ChangeType = 'title' | 'thumb' | 'desc'
export type Win = 7 | 30 | 90
export type SortKey = 'recent' | 'gain' | 'loss'
/** Inline rich text: plain strings and bold numbers. */
export type Rich = Array<string | { num: string } | { b: string }>
/** A URL patch: a key set to null leaves the query. */
export type Patch = Record<string, string | null>

export interface MudancasFilters {
  win: Win; type: 'all' | ChangeType; fmt: 'all' | Fmt; q: string; channel: string; changes: string[] | null; reading: string | null
  video: string | null; niche: NicheScope; sort: SortKey; measured: boolean; saved: boolean
}
export interface TitleView extends TitleDiff {
  beforeText: string; afterText: string
  /** Legend of the marks actually used (dotted = moved, dashed = case only). */
  legend: Array<{ cls: 'tmv' | 'tcase'; mark: string; label: string }>
  stats: string[]
  /** How the latest resumo-trocas reading that cites this change classified the rewrite (mudancas.html titleHTML). */
  rewrite: { text: string; title: string } | null
}
export interface ThumbView {
  key: string; label: string; role: 'Antes' | 'Depois'; src: string | null; period: string; archived: boolean
  preSeries: boolean; missing: string | null; back: boolean
}
export interface DescView {
  label: string; add: number; rem: number; lines: Array<{ op: string; text: string }>; noiseHidden: number; noText: string | null
  peek: Array<{ op: 'add' | 'rem'; text: string }>; peekMore: string | null; open: boolean
}
export interface SparkView {
  before: Array<number | null>; after: Array<number | null>
  expected: { base: number; exp: number; lo: number; hi: number } | null
  min: number; max: number; maxLabel: string; minLabel: string; aria: string; head: string
}
export interface EffectView {
  status: EffectStatus; icon: 'up' | 'down' | 'flat' | 'help' | 'clock' | 'none'; label: string; demoted: boolean
  numbers: string | null; pp: string | null; detail: string; wait: string | null; noBase: string | null; method: string | null
  caveats: string[]; notCause: 'Não prova causa'
  fallback: string | null; collected: number; afterNeeded: number; spark: SparkView | null
  rows: null | { observed: string; observedFrom: string; observedTo: string; expected: string; iqr: [string, string] | null; n: number; band: string; methodShort: string }
  footTitle: string | null
}
export interface Hero {
  id: string; type: ChangeType; typeLabel: string
  video: {
    id: string; title: string; channel: string; ago: string; historyHref: string; url: string
    color: string; ini: string; avatar: string | null; ink: string; niche: string | null; nicheLabel: string | null; meta: string[]; syncNote: string | null
    /** The pin control and the state chips (null: own channel's video). */
    pin: PinView | null
    /** tracked ∪ pinned. Outside them the effect is not measured: the card says why once (`outNote`) and has no effect column. */
    observed: boolean; outNote: string | null
  }
  when: { text: string; rel: string; prec: string; seq: string | null }
  badges: Array<{ kind: 'note' | 'rev'; text: string }>
  revTag: boolean
  title?: TitleView; thumbs?: ThumbView[]; desc?: DescView
  effect: EffectView
  /** key = the competitor_changes version key; null when this (legacy) change cannot be resolved to a row (R41). */
  swipe: { saved: boolean; label: string; key: string | null }
}
export interface LedgerRow { type: ChangeType; typeLabel: string; median: string | null; n: number; range: string | null; few: boolean; text: string }
export interface MudancasView {
  filters: MudancasFilters
  heroes: Hero[]
  groupByVideo: boolean
  ledger: {
    medians: LedgerRow[]
    groups: { reverts: number; withCaveat: number; inconclusiveByType: Record<string, number>; noVerdict: number }
    total: number; totalCheck: boolean; minN: number; winLabel: string; out: Rich; totalLine: Rich; note: string | null; emptyText: string | null
  }
  summary: { weekWin: string; weekLead: Rich; digest: Rich; method: string }
  controls: {
    typeCounts: Record<'all' | ChangeType, number>
    channels: Array<{ label: string; options: Array<{ id: string; name: string; count: number }> }>
    moreCount: number; windowLocked: boolean
    chips: Array<{ key: string; text: string; patch: Patch; label: string }>
  }
  paging: { cuts: number[]; countLines: Rich[]; restTexts: string[] }
  empty: null | { title: string; text: string; hiddenBy: string | null; actions: Array<{ label: string; patch: Patch }> }
  /** Display-only niche change (an object of another niche was asked for): toast text, never persisted. */
  nicheNote: string | null
  /** The forja ("Resumo das trocas (30 dias)"): header button/status and the card of the summary box (Task 35). */
  forja: ForjaView
  forjaCard: {
    /** ?reading=<id> opens that reading's niche (the list never changes). */
    openNiche: Niche | null
    outSummary: string; outText: string
    shorts: { text: string; href: string } | null
    /** mudancas.html I5: the header click opens this preview of what the request reads, per niche, before sending. */
    confirm: { title: string; lines: Array<{ niche: string; text: string }>; note: string | null; scope: NicheScope } | null
  }
}

/* ------------------------------------------------------------------ constants */
const TYPES: Array<[ChangeType, string]> = [['title', 'Título'], ['thumb', 'Thumbnail'], ['desc', 'Descrição']]
const DECIDED: readonly EffectStatus[] = ['ganhou', 'perdeu', 'neutro']
const MEASURED: readonly EffectStatus[] = ['ganhou', 'perdeu', 'neutro', 'inconclusivo']
/** 'Todos' or the niche's label (the engine's: youtube_niches). */
const nicheLabelOf = (obs: Observatory, n: NicheScope) => (n === 'todos' ? 'Todos' : obs.nicheLabel(n))
const FMT_LABEL: Record<'all' | Fmt, string> = { all: 'longos e Shorts', long: 'longos', short: 'Shorts' }
const TYPE_NAME: Record<ChangeType, string> = { title: 'título', thumb: 'thumbnail', desc: 'descrição' }
type IncKind = NonNullable<EffectResult['inconclusiveKind']>
/** One line of the ledger per inconclusive kind, in display order. A Record on the engine's union: a new kind without a line here does not compile. */
const INC_TEXT: Record<IncKind, (n: number, h: number) => string> = {
  'janela-dupla': (n, h) => (n === 1 ? 'inconclusiva' : 'inconclusivas') + ' por 2 campos em < ' + h + '\u00a0h',
  'troca-seguinte': n => (n === 1 ? 'inconclusiva' : 'inconclusivas') + ' por outra troca no mesmo vídeo nos 7 dias depois',
  'versao-curta': () => 'com uma das versões menos de 1 dia no ar',
  'antes-curto': () => 'com o antes curto demais (≤ 2 dias)',
  outro: n => (n === 1 ? 'inconclusiva' : 'inconclusivas') + ' por outro motivo',
}
const INC_KINDS = (Object.keys(INC_TEXT) as IncKind[]).map(k => [k, INC_TEXT[k]] as [IncKind, (n: number, h: number) => string])
export const PAGE_STEP = 8
export const SWIPE_LABEL = { on: 'Salvo no swipe file', off: 'Salvar no swipe file' } as const
/** Stable accessible name of the swipe button; the state is conveyed by aria-pressed only. */
export const SWIPE_ARIA = 'Salvar no swipe file'
export const SWIPE_UNAVAILABLE = 'Esta troca antiga não pode ir para o swipe file por aqui'

const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)
const pl = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many)
const joinE = (a: string[]) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1] : a[0] ?? '')
const first = (v: string | undefined) => (v == null ? undefined : v)

/**
 * What a request with more than one niche says about the queue. With exactly IA and Viagem (the built-in pair) the sentence
 * is the one the screen has always had; with any other set, the others wait behind the first of the forja's order.
 */
function queueNote(obs: Observatory, asked: readonly Niche[]): string {
  const two = asked.length === 2 && asked.every(n => obs.NICHES[n]?.builtin)
  return two ? 'A máquina pega um pedido por consulta: o de ' + obs.nicheLabel(asked[1]!) + ' fica na fila atrás do de ' + obs.nicheLabel(asked[0]!) + '.'
    : 'A máquina pega um pedido por consulta: os demais ficam na fila atrás do de ' + obs.nicheLabel(asked[0]!) + '.'
}

/* ------------------------------------------------------------------ filters */
export function parseFilters(obs: Observatory, p: Record<string, string | undefined>): MudancasFilters {
  const f: MudancasFilters = { win: 30, type: 'all', fmt: 'all', q: '', channel: 'all', changes: null, reading: null, video: null, niche: 'todos', sort: 'recent', measured: false, saved: false }
  const win = first(p.win), type = first(p.type), fmt = first(p.fmt), sort = first(p.sort)
  if (win === '7' || win === '30' || win === '90') f.win = Number(win) as Win
  if (fmt === 'all' || fmt === 'long' || fmt === 'short') f.fmt = fmt
  if (type === 'title' || type === 'thumb' || type === 'desc') f.type = type
  if (sort === 'recent' || sort === 'gain' || sort === 'loss') f.sort = sort
  f.q = (p.q ?? '').trim()
  f.measured = p.measured === '1'; f.saved = p.saved === '1'
  // only an existing niche filters; an unknown one (stale URL, niche that no longer exists) opens in Todos
  f.niche = obs.scopeOf(parseNiche(p.niche))
  const ch = p.channel ? obs.channel(p.channel) : undefined
  if (ch && !ch.own) f.channel = ch.id
  const vid = p.video ? obs.video(p.video) : undefined
  if (vid) { f.video = vid.id; f.win = 90; f.fmt = vid.fmt }
  if (p.changes) {
    const ids = p.changes.split(',').map(s => s.trim()).filter(id => !!obs.change(id))
    if (ids.length) { f.changes = ids; f.win = 90 }
  }
  f.reading = p.reading ? p.reading : null
  return f
}

/** Query string of the filters (niche stays with the chrome). */
function filterQuery(f: MudancasFilters): URLSearchParams {
  const u = new URLSearchParams()
  if (f.win !== 30 && !f.changes && !f.video) u.set('win', String(f.win))
  if (f.fmt !== 'all' && !f.changes && !f.video) u.set('fmt', f.fmt)
  if (f.sort !== 'recent') u.set('sort', f.sort)
  if (f.type !== 'all') u.set('type', f.type)
  if (f.channel !== 'all') u.set('channel', f.channel)
  if (f.video) u.set('video', f.video)
  if (f.changes) u.set('changes', f.changes.join(','))
  if (f.q) u.set('q', f.q)
  if (f.measured) u.set('measured', '1')
  if (f.saved) u.set('saved', '1')
  if (f.reading) u.set('reading', f.reading)
  return u
}

/* ------------------------------------------------------------------ queries (engine only) */
function makeQuery(obs: Observatory, saved: Set<string>) {
  const fmtQ = (f: MudancasFilters) => (f.fmt === 'all' ? null : f.fmt)
  const query = (f: MudancasFilters, o: { ignoreType?: boolean; ignoreChannel?: boolean } = {}): ObsChange[] => {
    const type = o.ignoreType || f.type === 'all' ? null : f.type
    if (f.changes) { const ids = f.changes; return obs.changesIn({ days: 90, niche: 'todos', type }).filter(c => ids.includes(c.id)) }
    return obs.changesIn({ days: f.win, niche: f.niche, fmt: fmtQ(f), type, channel: o.ignoreChannel || f.channel === 'all' ? null : f.channel, video: f.video })
  }
  const extra = (f: MudancasFilters, list: ObsChange[]) => list.filter(c => {
    if (f.measured && !MEASURED.includes(eff(obs, c).status)) return false
    if (f.saved && !saved.has(c.id)) return false
    if (f.q) {
      const v = obs.video(c.video)!, hay = [v.title, obs.channel(c.ch)!.name, typeof c.before === 'string' ? c.before : '', typeof c.after === 'string' ? c.after : ''].join(' ').toLowerCase()
      if (!hay.includes(f.q.toLowerCase())) return false
    }
    return true
  })
  return { query, extra, fmtQ }
}
const eff = (obs: Observatory, c: ObsChange): EffectResult => obs.effect(c.id)!

/* ------------------------------------------------------------------ presentation helpers (text only) */
function durTxt(obs: Observatory, ms: number | null | undefined, approx?: boolean): string {
  if (ms == null) return '—'
  return obs.date.dur(ms, approx).replace(/≈ /, 'cerca de ')
    .replace(/(\d+) d\b/g, (_, n: string) => n + (n === '1' ? ' dia' : ' dias'))
    .replace(/(\d+) h\b/g, (_, n: string) => n + (n === '1' ? ' hora' : ' horas'))
    .replace(/(\d+) min\b/g, (_, n: string) => n + (n === '1' ? ' minuto' : ' minutos'))
    .replace(/(\d+ (?:dias?|horas?)) (\d+ (?:horas?|minutos?))$/, '$1 e $2').replace(/ e 0 (horas|minutos)$/, '')
}
function whenText(obs: Observatory, c: ObsChange): string {
  const D = obs.date, at = c.at
  if (c.prec === 'min') return D.weekdayShort(at) + ', ' + D.dm(at) + ', ' + D.hm(at)
  if (c.prec === '6h' && c.window) {
    const [a, b] = c.window
    if (D.dm(a) === D.dm(b - 1)) return D.weekdayShort(a) + ', ' + D.dm(a) + ', entre ' + D.hh(a) + ' e ' + (D.hm(b) === '00:00' ? '24h' : D.hh(b))
    return D.weekdayShort(a) + ', ' + c.whenText
  }
  if (c.window) { const [a, b] = c.window; return 'entre ' + D.weekdayShort(a) + ', ' + D.dm(a) + ' ' + D.hh(a) + ' e ' + D.weekdayShort(b) + ', ' + D.dm(b) + ' ' + D.hh(b) }
  return c.whenText
}
function durationText(d: unknown): string | null {
  if (typeof d === 'string') return d
  if (typeof d !== 'number' || !Number.isFinite(d)) return null
  const s = Math.round(d), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60, p2 = (n: number) => (n < 10 ? '0' : '') + n
  return h ? h + ':' + p2(m) + ':' + p2(x) : m + ':' + p2(x)
}
/** Text colour on the channel avatar (WCAG pick between white and near-black). */
function inkOn(hex: string): string {
  let h = String(hex).replace('#', '')
  if (h.length === 3) h = h.replace(/(.)/g, '$1$1')
  if (!/^[0-9a-f]{6}$/i.test(h)) return '#14100C'
  const c = [0, 2, 4].map(i => { const v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) })
  const L = 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
  return 1.05 / (L + 0.05) >= (L + 0.05) / (0.0118 + 0.05) ? '#FFFFFF' : '#14100C'
}

/* ------------------------------------------------------------------ hero pieces */
function titleView(obs: Observatory, c: ObsChange): TitleView {
  const td = c.titleDiff ?? obs.titleDiff(String(c.before), String(c.after))
  const spans = td.full ? [] : [...td.before, ...td.after]
  const lab = (op: TitleSpan['op']) => spans.find(s => s.op === op)?.label ?? null
  const legend: TitleView['legend'] = []
  const mv = lab('move'), cs = lab('case')
  if (mv) legend.push({ cls: 'tmv', mark: 'pontilhado', label: mv })
  if (cs) legend.push({ cls: 'tcase', mark: 'tracejado', label: cs })
  const before = String(c.before), after = String(c.after)
  const stats = [
    td.full ? 'Título inteiro reescrito' : pl(td.keptWords, 'palavra mantida', 'palavras mantidas'),
    before.length + ' → ' + after.length + ' caracteres',
    'A versão anterior ficou ' + durTxt(obs, c.prevLivedMs, c.prec !== 'min') + ' no ar',
  ]
  // the forja's class shows only when a reading of the change's niche actually cites it (mudancas.html readByForja)
  const read = forjaOrder(obs.niches).map(n => obs.forja.latest('resumo-trocas', n)).find(r => !!r && groupsOf(r).some(g => g.changeIds.includes(c.id)))
  const grp = c.rewriteGroup && read ? obs.rewriteGroups.find(g => g.id === c.rewriteGroup) : undefined
  const rewrite = grp && read ? { text: 'Reescrita (forja): ' + grp.label.charAt(0).toLowerCase() + grp.label.slice(1), title: 'Como a forja classificou esta troca na leitura de ' + obs.date.dm(read.generatedAt) } : null
  return { ...td, beforeText: before, afterText: after, legend, stats, rewrite }
}

function thumbViews(obs: Observatory, c: ObsChange, v: ObsVideo): ThumbView[] {
  const letters = new Map<string, string>()
  for (const t of v.thumbs) if (!letters.has(t.key)) letters.set(t.key, String.fromCharCode(65 + letters.size))
  const D = obs.date
  const one = (id: string, role: ThumbView['role']): ThumbView => {
    const t = v.thumbs.find(x => x.id === id) as ThumbVersion | undefined
    const key = t?.key ?? '', src = t?.blobUrl ?? null, pre = !!t && (t.first_seen < obs.SERIES_START || !!t.seenSinceArchive)
    const period = !t ? '' : t.seenSinceArchive ? 'vista desde ' + D.dm(obs.SERIES_START) + ', até ' + D.dm(t.last_seen)
      : t.current ? 'desde ' + D.dmhm(t.first_seen) : D.dmhm(t.first_seen) + ' a ' + D.dmhm(t.last_seen)
    return {
      key, label: letters.get(key) ?? '?', role, src, period, archived: !!src, preSeries: pre,
      missing: src ? null : pre ? 'trocas antes de ' + obs.SERIES_START_LABEL + ' não têm a imagem antiga' : 'A imagem desta versão não foi arquivada.',
      back: role === 'Depois' && !!c.revertTo,
    }
  }
  return [one(c.fromId, 'Antes'), one(c.toId, 'Depois')]
}

function descView(c: ObsChange, open: boolean): DescView {
  if (!c.hasText || !c.diff) return { label: 'A descrição mudou; o texto não foi arquivado', add: 0, rem: 0, lines: [], noiseHidden: 0, noText: c.noTextReason ?? null, peek: [], peekMore: null, open: false }
  const d = c.diff
  const lines = d.lines.filter(l => !(l.op === 'ctx' && !l.text)).map(l => ({ op: l.op, text: l.op === 'utm' ? (l.from ?? '') + ' → ' + l.text : l.text }))
  const ch = d.lines.filter((l): l is typeof l & { op: 'add' | 'rem' } => l.op === 'add' || l.op === 'rem')
  return {
    label: d.label, add: d.add, rem: d.rem, lines, noiseHidden: d.utm, noText: null,
    peek: ch.slice(0, 3).map(l => ({ op: l.op, text: l.text })), peekMore: ch.length > 3 ? 'e mais ' + pl(ch.length - 3, 'linha', 'linhas') : null, open,
  }
}

function badges(obs: Observatory, c: ObsChange): Hero['badges'] {
  const out: Hero['badges'] = []
  if (c.sameWindow.length || c.within48h.length) {
    const o = obs.change(c.sameWindow[0] ?? c.within48h[0]!)
    if (o) out.push({ kind: 'note', text: (c.sameWindow.length ? 'Mudou na mesma janela de sincronização que ' + (o.type === 'thumb' ? 'a thumbnail' : o.type === 'title' ? 'o título' : 'a descrição')
      : o.typeLabel + ' mudou menos de ' + obs.RULES.effect.simultHours + ' h ' + (o.at < c.at ? 'antes' : 'depois') + ' desta troca (' + o.whenText + ')') + ': o efeito não se separa' })
  }
  const T = obs.RULES.testCompareMaxDays
  if (c.revertTo && c.type === 'thumb' && c.revertImmediate === false) {
    // other images were on air in between: "com a alternativa" and "Testar e comparar" would not be true
    const n = c.revertBetween ?? 0
    out.push({ kind: 'rev', text: 'A versão ' + thumbLetter(obs, c) + ' voltou ao ar depois de ' + durTxt(obs, c.cycleMs) + ', com ' + (n === 1 ? '1 outra imagem' : n + ' outras imagens') + ' no intervalo.' })
  } else if (c.revertTo) {
    out.push({ kind: 'rev', text: 'Voltou à versão ' + (c.type === 'thumb' ? thumbLetter(obs, c) : 'anterior') + ' depois de ' + durTxt(obs, c.cycleMs, c.prec !== 'min') + ' com a alternativa.'
      + (c.testCompare ? ' Compatível com Testar e comparar (teste A/B do YouTube, até ' + T + ' dias).' : ' A alternativa ficou mais de ' + T + ' dias: não parece teste automático.') })
  } else if (c.testCompare && c.nextLivedMs && c.revertedImmediate === true) {
    out.push({ kind: 'rev', text: 'Esta versão foi revertida ' + durTxt(obs, c.nextLivedMs) + ' depois. Compatível com Testar e comparar (teste A/B do YouTube).' })
  }
  return out
}
function thumbLetter(obs: Observatory, c: ObsChange): string {
  const v = obs.video(c.video)!, keys: string[] = []
  for (const t of v.thumbs) if (!keys.includes(t.key)) keys.push(t.key)
  const i = keys.indexOf(String(c.revertTo))
  return i < 0 ? 'anterior' : String.fromCharCode(65 + i)
}

function sparkView(obs: Observatory, e: EffectResult): SparkView | null {
  if (!e.daily) return null
  const F = obs.fmt
  const b = e.daily.before.map(x => x.vpd), a = e.daily.after.map(x => x.vpd)
  const base = e.beforeAvg ?? null
  const expected = e.status !== 'aguardando' && e.expected != null && base != null && e.iqr && e.iqr[0] != null && e.iqr[1] != null
    ? { base, exp: base * (1 + e.expected), lo: base * (1 + e.iqr[0]), hi: base * (1 + e.iqr[1]) } : null
  const vals = [...b, ...a].filter((x): x is number => x != null).concat(expected ? [expected.lo, expected.hi] : [])
  if (!vals.length) return null
  const max = Math.max(...vals), min = Math.min(...vals)
  const known = b.filter((x): x is number => x != null)
  const avgB = base ?? (known.length ? known.reduce((s, x) => s + x, 0) / known.length : 0)
  let aria = 'Views por dia: média de ' + F.num(avgB) + ' em ' + pl(e.beforeDays ?? 0, 'dia', 'dias') + ' antes'
  if (e.status === 'aguardando') aria += '; ' + pl(a.length, 'dia', 'dias') + ' depois até agora.'
  else aria += ', ' + F.num(e.afterAvg ?? null) + ' nos ' + obs.RULES.effect.afterDays + ' dias depois'
    + (expected ? '; esperado sem a troca ' + F.num(expected.exp) + ' (faixa ' + F.num(expected.lo) + ' a ' + F.num(expected.hi) + ').' : '; ' + (e.noBaseText ?? 'sem base de comparação (n = 0)') + '.')
  return {
    before: b, after: a, expected, min, max, maxLabel: 'máx ' + F.num(max), minLabel: 'mín ' + F.num(min) + ' (eixo não começa em 0)', aria,
    head: (e.beforeDays ?? 0) + ' antes · ' + (e.afterDays ?? 0) + ' depois',
  }
}

const VERDICT: Record<string, [EffectView['icon'], string]> = { ganhou: ['up', 'Ganhou'], perdeu: ['down', 'Perdeu'], neutro: ['flat', 'Neutro'], inconclusivo: ['help', 'Inconclusivo'] }

/** The effect of one change as Mudanças shows it; Histórico reuses it (R53: one text per change across screens). */
export function effectView(obs: Observatory, c: ObsChange): EffectView {
  const e = eff(obs, c), F = obs.fmt, v = obs.video(c.video)!
  const base = {
    status: e.status, demoted: e.status === 'inconclusivo', noBase: e.noBaseText ?? null, method: e.methodLabel ?? null, fallback: e.fallbackText ?? null,
    caveats: e.inconclusiveKind === 'troca-seguinte' ? [] : obs.caveats(c.id), notCause: 'Não prova causa' as const, collected: e.collected ?? e.afterDays ?? 0, afterNeeded: obs.RULES.effect.afterDays,
  }
  if (e.status === 'sem-antes' || e.status === 'sem-serie') {
    return { ...base, icon: 'none', label: e.label, numbers: null, pp: null, detail: F.labelReason(e.label, e.reason, { sentence: true }), wait: null, spark: null, rows: null, footTitle: null }
  }
  if (e.status === 'aguardando') {
    const wait = e.waitText ?? F.labelReason(e.label, e.reason, { sentence: true })
    return { ...base, icon: 'clock', label: 'Aguardando', numbers: null, pp: null, detail: wait, wait, spark: sparkView(obs, e), rows: null, footTitle: null }
  }
  const [icon, label] = VERDICT[e.status] ?? ['help', cap(e.label)]
  const rows = e.observed != null ? {
    observed: F.pct(e.observed), observedFrom: F.num(e.beforeAvg ?? null), observedTo: F.num(e.afterAvg ?? null),
    expected: F.pct(e.expected ?? null), iqr: e.expected != null && e.iqr ? [F.pct(e.iqr[0]), F.pct(e.iqr[1])] as [string, string] : null,
    n: e.n ?? 0, band: e.band ?? '', methodShort: (e.methodLabel ?? e.method ?? '').replace(/^método: /, ''),
  } : null
  return {
    ...base, icon, label, numbers: e.numbers ?? null, pp: e.effectPp != null ? F.pp(e.effectPp) : null, wait: null,
    // V9 (R53: one text on both screens): the peers of an effect are the channel's N most recent only (R119), so a pinned
    // video outside them rarely has any in its age band. Say that, in place of the engine's "poucos vídeos (n = …)".
    detail: v.pinned === true && !v.tracked && e.inconclusiveKind === 'outro' && e.observed != null && (e.n ?? 0) < obs.RULES.effect.minN
      ? 'Faltam vídeos na mesma faixa de idade entre os ' + obs.channel(c.ch)!.video_limit + ' mais recentes do canal para comparar. É o que costuma acontecer com um vídeo fixado antigo.'
      : cap(e.reason),
    spark: rows ? sparkView(obs, e) : null, rows,
    footTitle: rows ? 'Esperado: ' + pl(e.n ?? 0, 'vídeo', 'vídeos') + ' ' + (v.fmt === 'long' ? 'longos' : 'Shorts') + ' sem troca de ' + obs.channel(c.ch)!.name + ' com ' + (e.band ?? '') : null,
  }
}

/* ------------------------------------------------------------------ the view */
/**
 * `swipeKeys` (optional): engine change id → competitor_changes key (null = cannot be resolved). Without it the key is
 * the change's `toId` (the version it opened = `to_version_id`).
 */
/**
 * The ordered list of the Mudanças screen for these params (filters, object niche, search, saved, sort): the single
 * source of the list, shared by the screen and by Histórico's pager (which rebuilds the list the user came from).
 */
export function mudancasList(obs: Observatory, p: Record<string, string | undefined>, saved: Set<string>): { f: MudancasFilters; list: ObsChange[]; ordered: ObsChange[]; visibleVideos: string[]; nicheNote: string | null } {
  const f = parseFilters(obs, p)
  const { query, extra } = makeQuery(obs, saved)

  // Objects of another niche: the display niche follows the object (never persisted), with a toast.
  let nicheNote: string | null = null
  if (f.changes) {
    const ns = [...new Set(f.changes.map(id => obs.change(id)!.niche))]
    if (f.niche !== 'todos' && ns.some(n => n !== f.niche)) {
      const want: NicheScope = ns.length === 1 && ns[0] ? ns[0] : 'todos'
      f.niche = want; nicheNote = 'Nicho mudou para ' + nicheLabelOf(obs, want) + ' para mostrar as trocas citadas'
    }
  }
  const objNiche = f.video ? obs.video(f.video)!.niche : f.channel !== 'all' ? obs.channel(f.channel)!.niche : null
  if (objNiche && f.niche !== 'todos' && f.niche !== objNiche) {
    f.niche = objNiche; nicheNote = 'Nicho mudou para ' + nicheLabelOf(obs, objNiche) + ' para mostrar ' + (f.video ? 'este vídeo' : 'este canal')
  }

  const list = extra(f, query(f))
  const effKey = (c: ObsChange) => { const e = eff(obs, c); return DECIDED.includes(e.status) ? e.effectPp ?? null : null }
  let ordered: ObsChange[]
  if (f.sort === 'recent') {
    const groups = new Map<string, ObsChange[]>()
    for (const c of [...list].sort((a, b) => b.at - a.at)) { const g = groups.get(c.video); if (g) g.push(c); else groups.set(c.video, [c]) }
    ordered = [...groups.values()].flat()
  } else {
    ordered = [...list].sort((a, b) => {
      const ka = effKey(a), kb = effKey(b)
      if (ka == null && kb == null) return b.at - a.at
      if (ka == null) return 1
      if (kb == null) return -1
      return f.sort === 'gain' ? kb - ka : ka - kb
    })
  }
  const visibleVideos = [...new Set(ordered.map(c => c.video))]
  return { f, list, ordered, visibleVideos, nicheNote }
}

export function buildMudancasView(obs: Observatory, p: Record<string, string | undefined>, saved: Set<string>, swipeKeys?: Map<string, string | null>): MudancasView {
  const { f, ordered, visibleVideos, nicheNote } = mudancasList(obs, p, saved)
  const { query, extra, fmtQ } = makeQuery(obs, saved)
  const D = obs.date, F = obs.fmt, RE = obs.RULES.effect
  const back = '?' + filterQuery(f).toString()
  const firstDesc = ordered.find(c => c.type === 'desc' && c.hasText)?.id ?? null

  const heroes: Hero[] = ordered.map(c => {
    const v = obs.video(c.video)!, ch = obs.channel(c.ch)!
    const all = obs.changes.filter(x => x.video === c.video).sort((a, b) => a.at - b.at)
    const idx = all.indexOf(c) + 1
    const growth = ch.sync.problemPhrase ? (obs.channelStats(ch.id, 'long').growth30 as { to?: number } | undefined) : undefined
    const meta = [
      (v.fmt === 'long' ? 'Longo' : 'Short') + (durationText(v.dur) ? ', ' + durationText(v.dur) : ''),
      'Publicado ' + D.dmOrDmy(v.pub),
      // D11 / D15: no count for a video outside the observed ones (it is frozen) nor for a pinned one not checked since the pin (the count
      // is from before it); a pinned video outside the tracked ones says when its count was read
      ...(!isObserved(v) || v.pinState === 'aguardando-primeira' || v.pinState === 'sem-resposta' ? []
        : v.pinned === true && !v.tracked && v.checkedAt != null ? [F.num(v.views) + ' views em ' + D.dmhm(v.checkedAt)]
          : [F.num(v.views) + ' views' + (growth && typeof growth.to === 'number' ? ', até o registro diário de ' + D.dmhm(growth.to) : '')]),
    ]
    if (all.length > 1) meta.push(all.length + ' trocas registradas')
    const saw = saved.has(c.id)
    return {
      id: c.id, type: c.type, typeLabel: c.typeLabel,
      video: {
        id: v.id, title: v.title, channel: ch.name, ago: F.age(v),
        historyHref: obs.link.historico(v.id, { from: 'mudancas', ids: visibleVideos, back }), url: v.url,
        color: ch.color, ini: ch.ini, avatar: ch.avatar ?? null, ink: inkOn(ch.color), niche: ch.niche, nicheLabel: ch.niche ? obs.nicheLabel(ch.niche) : null, meta,
        syncNote: ch.sync.problemPhrase ? cap(ch.sync.problemPhrase) : null,
        pin: pinViewOf(obs, v, { withOut: true }), observed: isObserved(v),
        outNote: isObserved(v) ? null : 'Fora dos ' + ch.video_limit + ' mais recentes de ' + ch.name + ': o efeito destas trocas não é medido.',
      },
      when: {
        text: whenText(obs, c), prec: c.prec,
        rel: (c.prec !== 'min' ? (c.type === 'title' ? 'visto' : 'vista') + ' pela 1ª vez ' : c.type === 'title' ? 'trocado ' : 'trocada ') + c.agoShort,
        seq: all.length > 1 ? idx + 'ª de ' + all.length + ' trocas deste vídeo' : null,
      },
      badges: badges(obs, c),
      revTag: f.sort !== 'recent' && !!c.revertTo,
      ...(c.type === 'title' ? { title: titleView(obs, c) } : c.type === 'thumb' ? { thumbs: thumbViews(obs, c, v) } : { desc: descView(c, c.id === firstDesc) }),
      effect: effectView(obs, c),
      swipe: (() => { const key = swipeKeys && swipeKeys.has(c.id) ? swipeKeys.get(c.id)! : c.toId
        return { saved: key != null && saw, label: key == null ? SWIPE_UNAVAILABLE : saw ? SWIPE_LABEL.on : SWIPE_LABEL.off, key } })(),
    }
  })

  /* ---------------- ledger: window + niche + format, never the local filters */
  const pool = obs.changesIn({ days: f.win, niche: f.niche, fmt: fmtQ(f) })
  const hasCav = (c: ObsChange) => obs.caveats(c.id).length > 0
  const decided = (c: ObsChange) => DECIDED.includes(eff(obs, c).status)
  const rangeTxt = (vals: number[]) => { const a = [...vals].sort((x, y) => x - y); return a.length === 1 ? F.pp(a[0]!) : 'de ' + F.pp(a[0]!).replace(' pp', '') + ' a ' + F.pp(a[a.length - 1]!) }
  const medians: LedgerRow[] = TYPES.map(([type, typeLabel]) => {
    const m = pool.filter(c => c.type === type && !c.revertTo && !hasCav(c) && decided(c))
    const w = m.filter(c => eff(obs, c).status === 'ganhou').length, l = m.filter(c => eff(obs, c).status === 'perdeu').length, fl = m.length - w - l
    const vals = m.map(c => eff(obs, c).effectPp).filter((x): x is number => x != null)
    const few = m.length < RE.minN, med = !few ? obs.median(vals) : null
    const counts = w + ' ' + (w === 1 ? 'ganhou' : 'ganharam') + ', ' + l + ' ' + (l === 1 ? 'perdeu' : 'perderam') + ', ' + fl + ' ' + (fl === 1 ? 'neutra' : 'neutras')
    const range = vals.length ? rangeTxt(vals) : null
    const text = !m.length ? 'nada com veredito, pouco para concluir'
      : counts + (few ? '; ' + (m.length === 1 ? range + ', caso isolado, pouco para concluir' : 'faixa ' + range + ', pouco para concluir') : '')
    return { type, typeLabel, median: med != null ? F.pp(med) : null, n: m.length, range, few, text }
  })
  const reverts = pool.filter(c => c.revertTo && decided(c))
  const withCav = pool.filter(c => !c.revertTo && hasCav(c) && decided(c))
  const inc = pool.filter(c => eff(obs, c).status === 'inconclusivo')
  const incKind = (c: ObsChange): IncKind => eff(obs, c).inconclusiveKind ?? 'outro'
  const inconclusiveByType: Record<string, number> = {}
  for (const [k] of INC_KINDS) inconclusiveByType[k] = inc.filter(c => incKind(c) === k).length
  const noVer = pool.filter(c => { const s = eff(obs, c).status; return !DECIDED.includes(s) && s !== 'inconclusivo' })
  const inMed = medians.reduce((s, m) => s + m.n, 0)
  const outN = reverts.length + withCav.length + inc.length + noVer.length
  const rvals = reverts.map(c => eff(obs, c).effectPp).filter((x): x is number => x != null)
  const rm = reverts.length >= RE.minN ? obs.median(rvals) : null
  const out: Rich = []
  const items: Rich[] = []
  if (reverts.length) items.push([{ num: String(reverts.length) }, ' ' + (reverts.length === 1 ? 'voltou' : 'voltaram') + ' à versão anterior '
    + (rm != null ? '(mediana ' + F.pp(rm) + ')' : reverts.length === 1 ? '(' + F.pp(rvals[0] ?? null) + ', caso isolado)' : '(' + (rvals.length ? rangeTxt(rvals) : '—') + ', pouco para concluir)')])
  if (withCav.length) items.push([{ num: String(withCav.length) }, ' com ressalva (outra troca no mesmo vídeo nos ' + RE.afterDays + ' dias depois)'])
  for (const [k, txt] of INC_KINDS) { const n = inconclusiveByType[k]!; if (n) items.push([{ num: String(n) }, ' ' + txt(n, RE.simultHours)]) }
  if (noVer.length) items.push([{ num: String(noVer.length) }, ' sem veredito ainda (aguardando, sem antes ou sem série)'])
  if (items.length) {
    out.push({ b: 'Fora das medianas' }, ', ')
    items.forEach((it, i) => { if (i) out.push(i === items.length - 1 ? ' e ' : ', '); out.push(...it) })
    out.push('. ')
  } else out.push('Nenhuma troca fora das medianas. ')
  const totalLine: Rich = ['Total: ', { num: String(inMed) }, ' nas medianas + ', { num: String(outN) }, ' fora = ', { num: String(pool.length) }, ' ' + (pool.length === 1 ? 'troca' : 'trocas') + ' na janela.']
  const nicheTxt = f.niche === 'todos' ? '' : ', nicho ' + nicheLabelOf(obs, f.niche)
  const ledger: MudancasView['ledger'] = {
    medians, groups: { reverts: reverts.length, withCaveat: withCav.length, inconclusiveByType, noVerdict: noVer.length },
    total: pool.length, totalCheck: inMed + outN === pool.length, minN: RE.minN,
    winLabel: '(' + f.win + ' dias, ' + FMT_LABEL[f.fmt] + (f.niche === 'todos' ? ', todos os nichos' : nicheTxt) + ')',
    out, totalLine,
    note: f.changes ? 'O balanço cobre a janela de ' + f.win + ' dias' + (f.niche === 'todos' ? '' : ' do nicho ' + nicheLabelOf(obs, f.niche)) + ', não só as ' + f.changes.length + ' trocas da lista citada pela forja.' : null,
    emptyText: pool.length ? null : 'Nenhuma troca em ' + f.win + ' dias (' + FMT_LABEL[f.fmt] + nicheTxt + '): nada para medir.',
  }

  /* ---------------- summary (últimos 7 dias) and the collapsed digest line */
  const wk = obs.changesIn({ days: 7, niche: f.niche, fmt: fmtQ(f) })
  const cnt: Record<ChangeType, number> = { title: 0, thumb: 0, desc: 0 }, per = new Map<string, number>()
  for (const c of wk) { cnt[c.type]++; per.set(c.ch, (per.get(c.ch) ?? 0) + 1) }
  const fmtName = { all: 'longos e Shorts', long: 'vídeos longos', short: 'Shorts' }[f.fmt]
  const from = obs.NOW - 7 * obs.DAY
  const weekWin = 'De ' + D.weekdayShort(from) + ', ' + D.dm(from) + ', a hoje, ' + fmtName + nicheTxt + '.'
  const typed = ([['title', 'de título'], ['thumb', 'de thumbnail'], ['desc', 'de descrição']] as Array<[ChangeType, string]>).filter(([t]) => cnt[t])
  let weekLead: Rich
  if (!wk.length) weekLead = ['Nenhuma troca em ' + fmtName + nicheTxt + ' nesta semana.']
  else {
    weekLead = []
    typed.forEach(([t, name], i) => {
      if (i) weekLead.push(i === typed.length - 1 ? ' e ' : ', ')
      weekLead.push({ num: String(cnt[t]) }, ' ' + (i === 0 ? (cnt[t] === 1 ? 'troca ' : 'trocas ') : '') + name)
    })
    const nv = new Set(wk.map(c => c.video)).size, nc = new Set(wk.map(c => c.ch)).size
    weekLead.push(', em ', { num: String(nv) }, ' ' + (nv === 1 ? 'vídeo' : 'vídeos') + ' de ', { num: String(nc) }, ' ' + (nc === 1 ? 'canal' : 'canais') + '.')
    const top = [...per.entries()].sort((a, b) => b[1] - a[1])[0]
    if (top && top[1] > 1) weekLead.push(' ' + obs.channel(top[0])!.name + ' fez ', { num: String(top[1]) }, ' delas.')
    const revs = wk.filter(c => c.revertTo).length
    weekLead.push(...(revs ? [' ', { num: String(revs) }, ' ' + (revs === 1 ? 'voltou' : 'voltaram') + ' a uma versão anterior.'] : [' Nenhuma voltou a uma versão anterior.']))
    const m = wk.filter(decided).length
    weekLead.push(m ? ' ' + m + ' já com veredito.' : ' Nenhuma com veredito ainda (precisa de ' + RE.afterDays + ' dias depois).')
  }
  const parts = typed.map(([t, name], i) => cnt[t] + ' ' + (i === 0 ? (cnt[t] === 1 ? 'troca ' : 'trocas ') : '') + name)
  const effParts = TYPES.map(([t, label]) => {
    const m = medians.find(x => x.type === t)!
    if (!m.n) return null
    if (m.few) return label.toLowerCase() + ' ' + (m.n === 1 ? (m.range ?? '—') + ' (caso isolado)' : pl(m.n, 'troca', 'trocas') + ', ' + (m.range ?? '—') + ' (pouco para concluir)')
    return label.toLowerCase() + ' ' + m.median + ' (n = ' + m.n + ')'
  }).filter((x): x is string => !!x)
  // mudancas.html renderDigest: the collapsed line lists with commas (the open summary's lead says "e")
  const digest: Rich = [{ b: 'Últimos 7 dias:' }, ' ' + (parts.length ? parts.join(', ') : 'nenhuma troca') + '. ', { b: 'Efeito (' + f.win + ' d):' }, ' ' + (effParts.length ? effParts.join('; ') : 'nada com veredito') + '.']
  const method = 'Precisa de ' + RE.afterDays + ' dias depois da troca; o antes pode ser mais curto (coleta diária desde ' + obs.SERIES_START_LABEL + '). Efeito = variação observada de views/dia ('
    + RE.afterDays + ' dias depois vs até ' + RE.maxBeforeDays + ' dias antes) menos a esperada: a variação dos vídeos sem troca do mesmo canal e formato, na mesma faixa de idade ou no mesmo dia de vida. Ganhou ou perdeu só com mais de '
    + RE.pp + ' pp e fora da faixa normal (interquartil). Inconclusivo com n < ' + RE.minN + ', antes curto ou outro campo mudado em menos de ' + RE.simultHours + ' h. Não prova causa.'

  /* ---------------- controls */
  const typePool = extra(f, query(f, { ignoreType: true }))
  const typeCounts: MudancasView['controls']['typeCounts'] = { all: typePool.length, title: 0, thumb: 0, desc: 0 }
  for (const c of typePool) typeCounts[c.type]++
  const perCh = new Map<string, number>()
  for (const c of query(f, { ignoreChannel: true, ignoreType: true })) perCh.set(c.ch, (perCh.get(c.ch) ?? 0) + 1)
  // one group per niche in the forja's order (IA, Viagem, then the owner's). The built-in pair is always listed, as before;
  // a niche the owner created and that has no competitor yet gets no group, unless it is the tab's own niche
  const channels = forjaOrder(obs.niches).filter(n => f.niche === 'todos' || f.niche === n).map(n => ({
    n, label: obs.nicheLabel(n),
    options: obs.channels.filter(c => c.niche === n && !c.own).map(c => ({ id: c.id, name: c.name, count: perCh.get(c.id) ?? 0 })),
  })).filter(g => g.options.length > 0 || f.niche === g.n || obs.NICHES[g.n]?.builtin === true).map(({ label, options }) => ({ label, options }))
  const chips: MudancasView['controls']['chips'] = []
  if (f.channel !== 'all') chips.push({ key: 'channel', text: 'Canal: ' + obs.channel(f.channel)!.name, label: 'Tirar o filtro de canal', patch: { channel: null } })
  if (f.changes) chips.push({ key: 'changes', text: 'Trocas citadas pela forja (' + f.changes.length + ')', label: 'Tirar este filtro', patch: { changes: null, video: null, win: null, fmt: null } })
  else if (f.video) chips.push({ key: 'video', text: 'Vídeo: ' + obs.video(f.video)!.title, label: 'Tirar este filtro', patch: { video: null, win: null, fmt: null } })

  /* ---------------- paging (whole video groups while sorted by date) */
  const groupByVideo = f.sort === 'recent'
  const cuts: number[] = []
  if (ordered.length) {
    if (groupByVideo) {
      const sizes: number[] = []
      for (let i = 0; i < ordered.length;) { let j = i; while (j < ordered.length && ordered[j]!.video === ordered[i]!.video) j++; sizes.push(j - i); i = j }
      let shown = 0, gi = 0
      for (let limit = PAGE_STEP; ; limit += PAGE_STEP) {
        while (gi < sizes.length && shown < limit) shown += sizes[gi++]!
        cuts.push(shown)
        if (gi >= sizes.length) break
      }
    } else for (let k = PAGE_STEP; ; k += PAGE_STEP) { cuts.push(Math.min(k, ordered.length)); if (k >= ordered.length) break }
  }
  const filtered = f.type !== 'all' || f.channel !== 'all' || f.measured || f.saved || !!f.q || !!f.video || !!f.changes
  const total = ordered.length, nvt = visibleVideos.length
  const outOfPool = f.changes ? f.changes.length - obs.changesIn({ days: 90, niche: 'todos' }).filter(c => f.changes!.includes(c.id)).length : 0
  const countLines: Rich[] = cuts.map(shown => {
    const nv = new Set(ordered.slice(0, shown).map(c => c.video)).size
    return ['Mostrando ', { num: String(shown) }, ' de ', { num: String(total) }, ' ' + (total === 1 ? 'troca' : 'trocas') + (filtered ? (total === 1 ? ' que bate com os filtros' : ' que batem com os filtros') : '') + ', em ',
      { num: String(nv) }, ' de ', { num: String(nvt) }, ' ' + (nvt === 1 ? 'vídeo' : 'vídeos')
      + (f.changes ? '. Lista enviada pelo link da leitura da forja, procurada nos últimos 90 dias (a janela de ' + (first(p.win) && ['7', '30', '90'].includes(p.win!) ? p.win : '30') + ' d não se aplica).'
        + (outOfPool ? ' ' + pl(outOfPool, 'troca citada ficou', 'trocas citadas ficaram') + ' fora da janela de 90 dias.' : '')
        : '. Janela: últimos ' + f.win + ' dias, ' + FMT_LABEL[f.fmt] + (f.sort === 'recent' ? '.' : '. Ordem: ' + (f.sort === 'gain' ? 'maior efeito primeiro' : 'menor efeito primeiro') + ' (uma troca por cartão); trocas sem veredito no fim.'))]
  })
  const restTexts = cuts.map(shown => total - shown > 0 ? pl(total - shown, 'troca ainda não mostrada', 'trocas ainda não mostradas') : 'Fim da lista')

  const fj = forjaOf(obs, f)
  digest.push(' ', { b: 'Forja.' }, ' ' + forjaDigest(obs, fj.forja) + '.' + (f.niche === 'todos' && fj.forja.card.statusText ? ' ' + fj.forja.card.statusText : ''))
  return {
    filters: f, heroes, groupByVideo, ledger,
    summary: { weekWin, weekLead, digest, method },
    controls: { typeCounts, channels, moreCount: (f.channel !== 'all' ? 1 : 0) + (f.measured ? 1 : 0) + (f.saved ? 1 : 0), windowLocked: !!f.changes, chips },
    paging: { cuts, countLines, restTexts },
    empty: total ? null : emptyView(obs, f, query, extra, fmtQ),
    nicheNote,
    ...fj,
  }
}

/** mudancas.html renderDigest "Forja.": per niche, the reading it has ("resumo de 20/10", or the new one) and the request's state. */
export function forjaDigest(obs: Observatory, forja: ForjaView): string {
  return forja.niches.map(b => {
    const r = b.reading ? obs.forja.byId[b.reading.id] : undefined
    const read = !r ? 'sem leitura' : b.reading!.isNew ? 'leitura nova às ' + obs.date.hm(r.generatedAt) : 'resumo de ' + obs.date.dm(r.generatedAt)
    const lab = b.statusLine && b.requestState !== 'publicado' ? b.statusLine.replace(b.label + ': ', '') : null
    return b.label + ', ' + read + (lab ? ', ' + lab : '')
  }).join('; ')
}

/* ------------------------------------------------------------------ forja card (mudancas.html renderForja) */
function forjaOf(obs: Observatory, f: MudancasFilters): Pick<MudancasView, 'forja' | 'forjaCard'> {
  const forja = buildForjaView(obs, { screen: 'mudancas', niche: f.niche })
  // ?reading=<id>: that reading opens in its niche's block (the list does not change)
  const linked = f.reading ? obs.forja.byId[f.reading] : undefined
  let openNiche: Niche | null = null
  if (linked && linked.type === 'resumo-trocas' && linked.niche) {
    const b = forja.niches.find(x => x.niche === linked.niche)
    if (b) { b.reading = forjaReadingView(obs, linked, { active: b.active, isNew: false, activeNote: null }); b.emptyText = null; openNiche = linked.niche }
  }
  const out = forja.niches.flatMap(b => b.out)
  const busy = !!forja.status?.active
  const shortsType = obs.forja.readingTypeFor('short')
  return {
    forja,
    forjaCard: {
      openNiche,
      confirm: forja.ask ? {
        title: 'Pedir nova leitura à forja' + (forja.ask.niches.length > 1 ? ' (um pedido por nicho)' : ''),
        lines: forja.ask.niches.map(n => { const pv = obs.forja.preview('resumo-trocas', n); return { niche: obs.nicheLabel(n), text: pv.text + ' de ' + pl(pv.channelsIn.length, 'canal', 'canais') + (pv.channelsOut.length ? '. Fora: ' + pv.channelsOut.map(o => o.reason.replace(/ fica fora: /, ' — ')).join('; ') : '') + '.' } }),
        note: forja.ask.niches.length > 1 ? queueNote(obs, forja.ask.niches) : null,
        scope: forja.ask.scope,
      } : null,
      outSummary: out.length ? pl(out.length, 'canal fora do próximo pedido', 'canais fora do próximo pedido') + '; o que a forja faz' : 'O que a forja faz aqui',
      outText: out.join('. ') + (out.length ? '. ' : '') + 'A forja classifica o texto das trocas (longos e Shorts); não julga thumbnails nem diz o que funcionou.' + (busy ? '' : ' ' + obs.forja.queue.quotaScope.text),
      shorts: f.fmt === 'short' ? {
        text: obs.forja.shortsNote + ' ' + forja.niches.map(b => { const sr = obs.forja.latest(shortsType, b.niche); return b.label + ': ' + (sr ? 'última de ' + obs.date.dm(sr.generatedAt) : 'sem leitura') }).join('; ') + '.',
        href: obs.link.insights(f.niche === 'todos' ? undefined : { niche: f.niche }) + (f.niche === 'todos' ? '?fmt=short' : '&fmt=short'),
      } : null,
    },
  }
}

/* ------------------------------------------------------------------ empty state (CONVENCOES final round) */
type Q = ReturnType<typeof makeQuery>
function emptyView(obs: Observatory, f: MudancasFilters, query: Q['query'], extra: Q['extra'], fmtQ: Q['fmtQ']): NonNullable<MudancasView['empty']> {
  const D = obs.date, DAY = obs.DAY, ARCHIVE = obs.SERIES_START
  const tp = f.type !== 'all' ? ' de ' + TYPE_NAME[f.type] : ''
  const where = (f.niche !== 'todos' ? ' em canais de ' + nicheLabelOf(obs, f.niche) : '') + ' (' + FMT_LABEL[f.fmt] + ')'
  const clear: Patch = { changes: null, fmt: null, type: null, channel: null, measured: null, saved: null, q: null, video: null, win: null }
  if (f.changes) {
    const ids = f.changes, lst = obs.changesIn({ days: 90, niche: 'todos' }).filter(c => ids.includes(c.id))
    const kinds = [...new Set(lst.map(c => c.typeLabel.toLowerCase()))]
    if (!lst.length) return {
      title: pl(ids.length, 'troca citada', 'trocas citadas') + ' fora da janela de 90 dias',
      text: 'A lista veio do link da leitura da forja, mas ' + (ids.length === 1 ? 'a troca citada é anterior' : 'as trocas citadas são anteriores') + ' aos últimos 90 dias, a janela que esta tela procura.',
      hiddenBy: 'a janela de 90 dias',
      actions: [{ label: 'Tirar a lista da forja', patch: { changes: null, win: null, fmt: null } }],
    }
    return {
      title: 'Nenhuma das ' + pl(lst.length, 'troca citada', 'trocas citadas') + ' pela forja' + (f.type !== 'all' ? ' é de ' + TYPE_NAME[f.type] : ' passa nos filtros'),
      text: 'A lista veio do link da leitura da forja. ' + (f.type !== 'all' ? 'Ela tem ' + kinds.join(' e ') + '.' : ''),
      hiddenBy: f.type !== 'all' ? 'tipo ' + TYPE_NAME[f.type] : 'os filtros',
      actions: [{ label: 'Tirar a lista da forja', patch: { changes: null, win: null, fmt: null } }, ...(f.type !== 'all' ? [{ label: 'Todos os tipos', patch: { type: null } }] : [])],
    }
  }
  const base = obs.changesIn({ days: f.win, niche: f.niche, fmt: fmtQ(f) })
  interface FiltDef { on: boolean; name: string; label: string; patch: Patch; drop: Partial<MudancasFilters> }
  const DEFS: FiltDef[] = [
    { on: f.type !== 'all', name: 'tipo ' + (f.type !== 'all' ? TYPE_NAME[f.type] : ''), label: 'Todos os tipos', patch: { type: null }, drop: { type: 'all' } },
    { on: f.measured, name: '“só com efeito medido”', label: 'Mostrar também as sem veredito', patch: { measured: null }, drop: { measured: false } },
    { on: f.saved, name: '“só o swipe file”', label: 'Tirar “só o swipe file”', patch: { saved: null }, drop: { saved: false } },
    { on: !!f.q, name: 'a busca “' + f.q + '”', label: 'Limpar a busca', patch: { q: null }, drop: { q: '' } },
    { on: f.channel !== 'all', name: f.channel !== 'all' ? 'o canal ' + obs.channel(f.channel)!.name : '', label: 'Todos os canais', patch: { channel: null }, drop: { channel: 'all' } },
    { on: !!f.video, name: 'o filtro de vídeo', label: 'Tirar o filtro de vídeo', patch: { video: null }, drop: { video: null } },
  ]
  const FILT = DEFS.filter(x => x.on)
  const restr = (f.measured ? ' com efeito medido' : '') + (f.saved ? ' no swipe file' : '') + (f.q ? ' com “' + f.q + '”' : '') + (f.channel !== 'all' ? ' de ' + obs.channel(f.channel)!.name : '')
  const since = f.type === 'thumb' ? ARCHIVE : null, capped = since != null && obs.NOW - f.win * DAY < since
  const descNote = f.type === 'desc' && obs.NOW - f.win * DAY < ARCHIVE
  const title = 'Nenhuma troca' + tp + restr + where + (capped ? ' desde ' + D.dm(since!) + ' (início da detecção)' : ' nos últimos ' + f.win + ' dias')
  let text: string, hiddenBy: string | null = null
  const actions: Array<{ label: string; patch: Patch }> = []
  if (base.length) {
    const fix = FILT.map(x => ({ x, n: extra({ ...f, ...x.drop }, query({ ...f, ...x.drop })).length })).filter(o => o.n > 0)
    const typed = f.type !== 'all' ? base.filter(c => c.type === f.type) : base
    if (f.measured && typed.length && typed.every(c => !MEASURED.includes(obs.effect(c.id)!.status))) {
      const by = new Map<string, number>()
      for (const c of typed) { const s = obs.effect(c.id)!.label; by.set(s, (by.get(s) ?? 0) + 1) }
      text = (typed.length === 1 ? 'A única troca' : 'As ' + typed.length + ' trocas') + tp + ' desta janela' + where + ' ainda não ' + (typed.length === 1 ? 'tem' : 'têm') + ' efeito medido: ' + [...by].map(([k, n]) => n + ' ' + k).join(', ') + '.'
      hiddenBy = '“só com efeito medido”'
    } else if (capped && !typed.length) {
      text = 'Trocas de thumbnail só são detectadas desde ' + D.dm(since!) + ' (' + Math.floor((obs.NOW - since!) / DAY) + ' dias); nesse período, nenhuma' + where + '. Há ' + pl(base.length, 'troca', 'trocas') + ' de outros tipos nesta janela.'
      hiddenBy = 'tipo ' + TYPE_NAME.thumb
    } else {
      text = 'Há ' + pl(base.length, 'troca', 'trocas') + where + ' nesta janela; ' + (fix.length
        ? fix.map(o => o.x.name + ' esconde ' + (o.n === base.length ? (o.n === 1 ? 'a única' : 'todas as ' + o.n) : String(o.n))).join(', ')
        : 'a combinação dos filtros esconde todas') + '.'
      hiddenBy = fix.length ? fix.map(o => o.x.name).join(', ') : 'a combinação dos filtros'
    }
    for (const o of fix) actions.push({ label: o.x.label + ' (' + o.n + ')', patch: o.x.patch })
  } else {
    const wider = ([30, 90] as const).filter(w => w > f.win).map(w => [w, obs.changesIn({ days: w, niche: f.niche, fmt: fmtQ(f) }).length] as const).find(x => x[1] > 0)
    if (wider) {
      text = 'Nenhuma troca' + where + ' nesta janela. Em ' + wider[0] + ' dias há ' + pl(wider[1], 'troca.', 'trocas.')
      hiddenBy = 'a janela de ' + f.win + ' dias'
      actions.push({ label: 'Ampliar para ' + wider[0] + ' dias', patch: { win: String(wider[0]) } })
    } else {
      text = 'Nenhuma troca' + where + ' nos últimos ' + f.win + ' dias, com qualquer filtro. Isso é resultado: esses canais não mexeram em títulos, thumbnails nem descrições nesse período'
        + (obs.NOW - f.win * DAY < ARCHIVE ? ' (thumbnails só detectadas desde ' + D.dm(ARCHIVE) + ')' : '') + '.'
    }
  }
  if (descNote) text += ' Descrições anteriores a ' + D.dm(ARCHIVE) + ' aparecem sem o texto.'
  actions.push({ label: 'Limpar filtros', patch: clear })
  return { title, text, hiddenBy, actions }
}
