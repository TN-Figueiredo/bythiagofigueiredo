/**
 * View model of the per-video history (port of historico-video.html build/context/pairs/render* texts).
 * Pure: every text, date and number comes from the engine (obs.*); the components only map the abstract units
 * produced here (hours since publication, fractions of the y scale, percentages of the effect scale) to pixels.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import type { ObsChange } from '@/lib/youtube/observatorio/changes'
import type { EffectResult } from '@/lib/youtube/observatorio/effect'
import type { NicheScope } from '@/lib/youtube/observatorio/niche'
import { parseNiche } from '@/lib/youtube/observatorio/niche'
import type { Niche, ObsChannel, ObsVideo, SeriesPoint } from '@/lib/youtube/observatorio/types'
import type { TitleOp } from '@/lib/youtube/observatorio/text-diff'
import { mudancasList, effectView, type EffectView } from '../_mudancas/view-model'
import { buildOutliersView, ages2label } from '../_outliers/view-model'

export type HistState = 'full' | 'pre' | 'few' | 'none' | 'noreg' | 'untr' | 'old' | 'err' | 'bf' | 'not-found'
export type LaneType = 'title' | 'thumb' | 'desc'
export type FromTab = 'canais' | 'mudancas' | 'outliers' | 'insights'
/** How the start of a version is known: at publication, to the minute, inside a 6 h / 1 d window, or not observed. */
export type VersionPrecision = 'publicacao' | 'min' | '6h' | '1d' | 'aberto'

/** An archived thumbnail (Vercel Blob) or the honest text that replaces it; never a drawn stand-in. */
export interface ThumbImg { src: string | null; missing: string; alt: string }

export interface VersionView {
  id: string
  /** Display label: T1…, D1…, or the thumbnail letter (the same image keeps its letter). */
  label: string
  /** Start / end texts ("06/10 13:00 (publicação)", "trocado entre 11/10 06h e 12h", "agora"). */
  from: string; to: string
  /** The start or the end was not observed: the duration says "pelo menos". */
  atLeast: boolean
  /** "visto"/"vista" (title is masculine; thumbnail and description feminine). */
  participle: string
  /** "trocado"/"trocada". */
  changedParticiple: string
  precision: VersionPrecision
  /** Hours since publication (lane geometry). */
  fromH: number; toH: number; win: [number, number] | null
  span: string; dur: string; rate: string; cur: boolean
  aria: string
  /** Text shown inside the lane clip (title text, "texto não guardado", "no ar"), null = only the label. */
  clipText: string | null
  tag: { kind: 'now' | 'ret'; text: string } | null
  thumb: ThumbImg | null
  reverted: boolean
  /** Description whose text was not kept. */
  noText: boolean
  /** Title only: the comparison against the previous title. */
  titleDiff: TitleDiffView | null
}
export interface TitleDiffView { after: Array<{ op: TitleOp; text: string; title: string | null }>; gone: Array<{ kind: 'del' | 'ins' | 'text'; text: string }> }

export interface TipView {
  title: string; when: string
  body: { kind: 'title'; before: string; after: string }
    | { kind: 'thumb'; before: ThumbImg; after: ThumbImg; revert: string | null }
    | { kind: 'desc'; text: string; sub: string | null }
}
export interface MarkerView { idx: number; changeId: string; pairK: string | null; h: number; win: [number, number] | null; aria: string; tip: TipView }
export interface LaneView {
  type: LaneType; label: string
  versions: VersionView[]; markers: MarkerView[]
  /** Thumbnail before the image archive started (hatched, "antes de DD/MM"). */
  pre: { fromH: number; toH: number; text: string; title: string } | null
}

export interface LegendItem { kind: 'curve' | 'dash' | 'shade' | 'hatch' | 'win' | 'thumb' | 'text'; text: string }
export interface Bin { a: number; b: number; vpd: number; y: number; from0: boolean; label: string; labelY: number }

export interface ChartView {
  /** Brief contract: the step points (t = end of the interval, ms) and the expected curve. */
  points: Array<{ t: number; vpd: number | null }>
  expected: Array<{ t: number; vpd: number }>
  expectedMethod: string
  /** seriesStart (ms) when the period before it is compressed; null otherwise. */
  compressedBefore: number | null
  /** Total hours since publication (x domain is 0..H). */
  H: number
  /** Hours since publication of seriesStart, when the compressed band applies. */
  B0: number | null
  few: boolean
  src: { bold: string | null; text: string }
  empty: { title: string; text: string; last: { views: string; at: string } | null; tail: string | null; link: { href: string; text: string } | null } | null
  bins: Bin[]
  expectedSteps: Array<{ a: number; b: number; y: number; joined: boolean }>
  yTicks: Array<{ y: number; label: string }>
  pre: { toH: number; lines: string[] } | null
  hatch: { fromH: number; note: string | null } | null
  firstNote: { toH: number; text: string } | null
  xTicks: Array<{ h: number; label: string }>
  aria: string
  /** Few-records axis under the lanes. */
  fewAxis: Array<{ h: number; label: string }> | null
  stale: { fromH: number; title: string } | null
  table: Array<[string, string, string, string]> | null
}

export interface BaSide { thumb: ThumbImg | null; title: string | null; label: string }
export interface ScaleView {
  aria: string; hasBase: boolean
  iqr: { left: number; width: number } | null; med: number | null; obs: number; zero: number
  obsLabelLeft: number; baseLabel: string | null; obsLabel: string; rangeLabel: string
}
export interface ComparisonView {
  /** Pair key (the first change of the group). */
  changeId: string
  /** Brief contract: before → after means (media de views/dia) and the scale text. */
  before: string; after: string; scale: string
  /** Mudanças' effect view of the change (R53: one effect text per change across screens). */
  effect: EffectView
  chip: string
  ba: BaSide[] | null
  /** Effect without measured numbers (waiting, no series, no base…). */
  nobase: { strong: string; text: string } | null
  full: {
    what: string; whatWhen: string; days: string; verdictStrong: string; verdictText: string
    /** The engine's short verdict label (lower case, as in the mockup pill). */
    pill: string
    scale: ScaleView; src: string; second: { strong: string; text: string } | null; caveats: string[]
  } | null
  descLink: boolean
  windows: { before: [number, number]; after: [number, number] } | null
}

export interface CrumbsView { from: FromTab; crumb: string; href: string; sub: { text: string; href: string } | null }
export interface PagerView { prev: string | null; next: string | null; backHref: string; position: string; prevLabel: string; nextLabel: string }

export interface HeaderView {
  thumb: ThumbImg; dur: string | null
  chan: { name: string; ini: string; color: string; niche: string | null }
  views: { num: string | null; text: string }
  pub: { age: string; full: string }
  fmt: string
  sync: { text: string; bad: boolean; title: string }
  mult: { text: string; title: string }
  fallback: string | null
  counts: Array<{ type: LaneType | null; text: string }>
}

export interface VersionsView {
  thumbs: { src: string; cards: VersionView[]; notes: Array<{ kind: 'ab' | 'warn'; text: string }> }
  titles: { src: string; same: string | null; items: VersionView[] }
  descs: {
    src: string; same: string | null; rows: VersionView[]
    notes: string[]
    diffs: Array<{ sum: string; utm: number; utmNote: string | null; rows: DiffRow[] }>
  }
}
export type DiffRow = { kind: 'fold'; text: string } | { kind: 'ctx' | 'add' | 'rem'; text: string; noise?: boolean } | { kind: 'utm'; from: string; extra: string }

export interface HistoricoView {
  video: {
    id: string; title: string; channel: string; niche: Niche | null; age: string; url: string
    /** Toast when the video belongs to another niche than the chosen one (display only, nothing persisted). */
    nicheToast: string | null
  } | null
  /** The niche the chrome shows for this view (the video's when it differs from the persisted one). */
  chromeNiche: NicheScope
  crumbs: CrumbsView
  header: HeaderView | null
  chart: ChartView | null
  lanes: LaneView[]
  legends: Record<string, LegendItem[]>
  comparisons: ComparisonView[]
  /** The comparison selected on load (first with a verdict, else the first). */
  defaultPair: string | null
  compareEmpty: string | null
  versions: VersionsView | null
  pager: PagerView | null
  state: HistState
  untracked: { text: string; href: string } | null
  notFound: { title: string; text: string; href: string; back: string } | null
}

const H_MS = 36e5, DAY = 864e5
const TYPE_NAME: Record<LaneType, string> = { title: 'Título', thumb: 'Thumbnail', desc: 'Descrição' }
const FEM: Record<LaneType, boolean> = { title: false, thumb: true, desc: true }
const FROM_LABEL: Record<FromTab, string> = { mudancas: 'Mudanças', outliers: 'Outliers', canais: 'Canais', insights: 'Insights' }
const NICHE_LABEL: Record<Niche, string> = { ia: 'IA', viagem: 'Viagem' }
const cap = (t: string) => (t ? t[0]!.toUpperCase() + t.slice(1) : '')
const endDot = (t: string) => { const s = String(t).trim(); return /[.!?…]$/.test(s) ? s : s + '.' }

export function parseFrom(raw: string | undefined): FromTab {
  return raw === 'canais' || raw === 'outliers' || raw === 'insights' || raw === 'mudancas' ? raw : 'mudancas'
}

/** Base path (no query) of an Observatório tab. */
function tabPath(obs: Observatory, page: FromTab): string {
  const l = page === 'canais' ? obs.link.canais() : page === 'mudancas' ? obs.link.mudancas() : page === 'outliers' ? obs.link.outliers() : obs.link.insights()
  return l.split('?')[0]!
}

interface Params { [k: string]: string | undefined }

export function buildHistoricoView(obs: Observatory, id: string, p: Params, opts?: { savedChangeIds?: ReadonlySet<string> }): HistoricoView {
  const D = obs.date
  const from = parseFrom(p.from)
  const userNiche: NicheScope = parseNiche(p.niche) ?? 'todos'
  const back = p.back && p.back.startsWith('?') ? p.back : null
  const backHref = (page: FromTab, def: string) => (back ? tabPath(obs, page) + back : def)
  const v = obs.video(id)

  if (!v) {
    const href = backHref(from, from === 'mudancas' ? obs.link.mudancas({ niche: userNiche }) : from === 'outliers' ? obs.link.outliers({ niche: userNiche }) : from === 'canais' ? obs.link.canais({ niche: userNiche }) : obs.link.insights({ niche: userNiche }))
    return {
      video: null, chromeNiche: userNiche, header: null, chart: null, lanes: [], legends: {}, comparisons: [], defaultPair: null, compareEmpty: null,
      versions: null, pager: null, state: 'not-found', untracked: null,
      crumbs: { from, crumb: FROM_LABEL[from], href, sub: null },
      notFound: { title: 'Vídeo não encontrado: “' + id + '”.', text: 'Ele não está entre os vídeos observados: o link pode estar errado ou o vídeo saiu da lista do canal.', href, back: 'Voltar para ' + FROM_LABEL[from] },
    }
  }

  const ch = obs.channel(v.ch)!
  const now = obs.NOW, SS = obs.SERIES_START, S03 = obs.SERIES_START_LABEL
  const dmhmY = (ms: number) => D.dmOrDmy(ms) + ' ' + D.hm(ms)
  const pub = v.pub, H = (now - pub) / H_MS, hx = (ms: number) => (ms - pub) / H_MS
  const F = obs.fmt
  const sy = ch.sync
  const syncOk = sy.state === 'ok'

  // ---------- niche: another niche changes the niche only for this view (nothing persisted) ----------
  let chromeNiche: NicheScope = userNiche, nicheToast: string | null = null
  if (v.niche && userNiche !== 'todos' && userNiche !== v.niche) {
    if (p.nicheParam) nicheToast = 'Este vídeo é do nicho ' + NICHE_LABEL[v.niche] + '; o paginador continua no nicho do vídeo'
    else { chromeNiche = v.niche; nicheToast = 'Nicho mudou para ' + NICHE_LABEL[v.niche] + ' para mostrar este vídeo' }
  }
  const ctxNiche: NicheScope = userNiche !== 'todos' && userNiche !== v.niche ? (v.niche ?? 'todos') : userNiche

  // ---------- series → bins (views/day between records) ----------
  const pts: SeriesPoint[] = v.series.slice()
  const bins: Array<{ a: number; b: number; v: number; from0: boolean; t: number }> = []
  let firstNote: { views: number; h: number; t: number } | null = null
  if (pts.length && pub >= SS && !v.truncated) {
    const fh = (pts[0]!.t - pub) / H_MS
    if (fh >= 24) bins.push({ a: 0, b: hx(pts[0]!.t), v: pts[0]!.views / (fh / 24), from0: true, t: pts[0]!.t })
    else firstNote = { views: pts[0]!.views, h: fh, t: pts[0]!.t }
  }
  for (let i = 1; i < pts.length; i++) bins.push({ a: hx(pts[i - 1]!.t), b: hx(pts[i]!.t), v: (pts[i]!.views - pts[i - 1]!.views) / ((pts[i]!.t - pts[i - 1]!.t) / DAY), from0: false, t: pts[i]!.t })
  const seriesStartH = bins.length ? bins[0]!.a : pts.length ? hx(pts[0]!.t) : H
  const changes: ObsChange[] = obs.changes.filter(c => c.video === v.id).sort((a, b) => a.at - b.at)
  const obsSince: number | null = sy.added ?? ch.snapshots[0]?.t ?? null
  const stalled = (sy.state === 'atrasado' || sy.state === 'erro') && sy.last != null
  const endNow = stalled ? Math.min(now, sy.last!) : now
  const recentAdd = sy.added != null && sy.added > pub
  const few = pts.length < 2
  const stale = pts.length > 0 && pts[pts.length - 1]!.idx < obs.LAST_IDX
  const nextSnapMs = D.snapTime(obs.LAST_IDX + 1), nextSnap = D.dm(nextSnapMs) + ' ' + D.hh(nextSnapMs)
  const compress = pub < SS && (SS - pub) / (now - pub) > 0.14
  const preDays = Math.round((SS - pub) / DAY)

  // ---------- versions ----------
  type Ver = { id: string; first_seen: number; last_seen: number; current: boolean; prec: string | null; window: [number, number] | null; seenSinceArchive?: boolean }
  // Production writes the first version of a video as precision 'first' with first_seen = the sync that saw it
  // (competitor-versions.ts). The oracle rule (dados.js:524): only a video published BEFORE the archive start
  // (SERIES_START) has a first version whose start was not observed ("visto desde DD/MM", seenSinceArchive);
  // a video published after it was watched from publication, so its 'first' version stands from publication.
  const preArchive = pub < SS
  const isPub = (x: Ver) => x.prec === 'publicacao' || ((x.prec === 'first' || x.prec == null) && (x.first_seen <= pub || !preArchive))
  const lateObs = (x: Ver) => isPub(x) && obsSince != null && obsSince > pub && x.first_seen <= pub
  const openStart = (x: Ver) => lateObs(x) || x.prec === 'desde-arquivo' || !!x.seenSinceArchive || (x.prec === 'first' && x.first_seen > pub && preArchive)
  /** Effective start: a 'first' version that stands from publication starts at the publication. */
  const startMs = (x: Ver) => (isPub(x) ? Math.min(x.first_seen, pub) : x.first_seen)
  const du = (ms: number) => D.dur(ms).replace(/ 0 h$/, '').replace(/ 0 min$/, '')
  const thumbKeys = new Map<string, string>()
  for (const t of v.thumbs) if (!thumbKeys.has(t.key)) { const k = thumbKeys.size; thumbKeys.set(t.key, k < 26 ? String.fromCharCode(65 + k) : 'Z' + (k - 25)) }
  const verLabel = new Map<string, string>()
  v.titles.forEach((t, i) => verLabel.set(t.id, 'T' + (i + 1)))
  v.descs.forEach((t, i) => verLabel.set(t.id, 'D' + (i + 1)))
  v.thumbs.forEach(t => verLabel.set(t.id, thumbKeys.get(t.key)!))
  const keyOf = (k: string) => thumbKeys.get(k) ?? k
  const curWord = (type: LaneType) => (stalled ? (FEM[type] ? 'última vista' : 'último visto') : 'no ar')
  const revertedIds = new Set(changes.filter(c => c.revertTo).map(c => c.toId))

  const thumbImg = (t: { blobUrl: string | null }, label: string): ThumbImg => ({
    src: t.blobUrl ?? null,
    // A version without its archived image says so; the "antes de DD/MM" text is only for what lies before the archive
    // (the hatched lane region and the "Antes" side of a comparison), never for a version that was seen.
    missing: 'A imagem desta versão não foi arquivada.',
    alt: 'Thumbnail ' + label,
  })

  function versionsOf(type: LaneType, arr: Ver[]): VersionView[] {
    const o = FEM[type] ? 'a' : 'o'
    return arr.map((x, i) => {
      const nx = arr[i + 1]
      const startLbl = lateObs(x)
        ? (recentAdd ? 'vist' + o + ' na 1ª conferência, ' + dmhmY(obsSince!) : 'vist' + o + ' desde ' + D.dmOrDmy(obsSince!))
        : isPub(x) ? dmhmY(pub) + ' (publicação)'
          : x.prec === 'min' ? dmhmY(x.first_seen)
            : openStart(x) ? 'vist' + o + ' desde ' + D.dmOrDmy(x.first_seen)
              : 'vist' + o + ' pela 1ª vez ' + D.dmOrDmy(x.first_seen) + ' ' + D.hh(x.first_seen)
      const sObs = lateObs(x) ? obsSince! : startMs(x)
      const sLo = x.window ? x.window[0] : sObs, sHi = sObs
      const eLo = nx ? (nx.window ? nx.window[0] : nx.first_seen) : endNow, eHi = nx ? nx.first_seen : endNow
      const open = openStart(x), openEnd = !nx && stalled
      const dMin = eLo - sHi, dMax = eHi - sLo
      const rng = dMax - dMin < H_MS ? du(dMax) : du(Math.max(0, dMin)) + ' a ' + du(dMax)
      const atLeast = open || openEnd
      const durTxt = atLeast ? 'pelo menos ' + du(Math.max(0, dMin)) : rng
      const end = nx ? (nx.window ? 'trocad' + o + ' ' + D.windowText(nx.window[0], nx.window[1]) : dmhmY(nx.first_seen)) : stalled ? 'até ' + dmhmY(endNow) + ' (última conferência)' : 'agora'
      const span = /^trocad[ao] /.test(end) ? startLbl + '; ' + end : end.startsWith('até ') ? startLbl + ' ' + end : startLbl + ' até ' + end
      const label = verLabel.get(x.id) ?? x.id
      const desc = type === 'desc' ? (x as unknown as { lines: string[] | null; hasText: boolean }) : null
      const noText = !!desc && (desc.lines == null || !desc.hasText)
      const precision: VersionPrecision = open ? 'aberto' : isPub(x) ? 'publicacao' : x.prec === 'min' ? 'min' : x.prec === '1d' ? '1d' : '6h'
      const reverted = type === 'thumb' && revertedIds.has(x.id)
      const cur = !nx
      const tText = type === 'title' ? (x as unknown as { text: string }).text : null
      return {
        id: x.id, label, from: startLbl, to: end, atLeast, participle: 'vist' + o, changedParticiple: 'trocad' + o, precision,
        fromH: Math.max(0, hx(startMs(x))), toH: hx(eLo), win: x.window ? [hx(x.window[0]), hx(x.window[1])] : null,
        span, dur: durTxt, rate: obs.periodRate(v!.id, startMs(x), eLo).text, cur,
        aria: TYPE_NAME[type] + ' ' + label + (noText ? ' (texto não guardado)' : '') + ': ' + span,
        clipText: type === 'title' ? tText : type === 'desc' ? (noText ? 'texto não guardado' : cur ? curWord(type) : null) : null,
        tag: cur ? { kind: 'now', text: curWord(type) } : reverted ? { kind: 'ret', text: 'voltou' } : null,
        thumb: type === 'thumb' ? thumbImg(x as Ver & { blobUrl: string | null }, label) : null,
        reverted, noText, titleDiff: null,
      }
    })
  }
  const titles = versionsOf('title', v.titles)
  const thumbs = versionsOf('thumb', v.thumbs)
  const descs = versionsOf('desc', v.descs)
  titles.forEach((t, i) => { if (i) t.titleDiff = titleDiffView(obs, v.titles[i - 1]!.text, v.titles[i]!.text) })
  const t0v = v.thumbs[0]
  const thumbPreAt = t0v && openStart(t0v) && t0v.first_seen > pub ? t0v.first_seen : null
  const preLabel = thumbPreAt != null && thumbPreAt > SS + DAY ? D.dm(thumbPreAt) : S03

  // ---------- comparison pairs ----------
  const nameOf = (c: ObsChange) => c.type === 'thumb'
    ? 'Thumbnail ' + keyOf((c.before as { key: string }).key) + ' → ' + keyOf((c.after as { key: string }).key)
    : c.typeLabel + ' ' + (verLabel.get(c.fromId) ?? c.fromId) + ' → ' + (verLabel.get(c.toId) ?? c.toId)
  const partAgo = (c: ObsChange) => { const o = FEM[c.type] ? 'a' : 'o'; return c.window ? 'vist' + o + ' pela 1ª vez ' + c.agoShort : 'trocad' + o + ' ' + c.agoShort }
  interface Pair { k: string; label: string; group: ObsChange[]; e: EffectResult; e2: EffectResult | null; labs: string[] | null }
  const pairs: Pair[] = []
  {
    const used = new Set<string>(), ord: Record<LaneType, number> = { title: 0, thumb: 1, desc: 2 }
    for (const c of changes) {
      if (used.has(c.id)) continue
      let group: ObsChange[] = [c]
      if (c.type === 'thumb' && c.revertedBy) { const r = obs.change(c.revertedBy); if (r) group = [c, r] }
      else for (const oid of c.sameWindow) { const o = obs.change(oid); if (o && o.video === c.video && !used.has(o.id)) group.push(o) }
      group.forEach(g => used.add(g.id))
      const rev = group.length === 2 && group.every(g => g.type === 'thumb')
      if (!rev) group.sort((a, b) => ord[a.type] - ord[b.type])
      const label = rev
        ? 'Thumbnail ' + keyOf((group[0]!.before as { key: string }).key) + ' → ' + keyOf((group[0]!.after as { key: string }).key) + ' → ' + keyOf((group[1]!.after as { key: string }).key)
        : group.map(nameOf).join(' + ') + (group.length > 1 ? ' (mesma janela)' : '')
      const e = obs.effect(group[0]!.id)
      if (!e) continue
      pairs.push({ k: group[0]!.id, label, group, e, e2: rev ? obs.effect(group[1]!.id) : null,
        labs: rev ? group.map(g => keyOf((g.before as { key: string }).key) + ' → ' + keyOf((g.after as { key: string }).key)) : null })
    }
  }
  const pairOfChange = (cid: string) => pairs.find(q => q.group.some(g => g.id === cid))?.k ?? null

  // ---------- lanes ----------
  const arrOf = (t: LaneType) => (t === 'title' ? titles : t === 'thumb' ? thumbs : descs)
  const rawOf = (t: LaneType): Ver[] => (t === 'title' ? v.titles : t === 'thumb' ? v.thumbs : v.descs)
  const events = changes.map(c => {
    const idx = rawOf(c.type).findIndex(x => x.id === c.toId)
    const win: [number, number] | null = c.window ? [hx(c.window[0]), hx(c.window[1])] : null
    return { type: c.type, idx, c, h: win ? (win[0] + win[1]) / 2 : hx(c.at), win }
  })
  const tipOf = (c: ObsChange, idx: number): TipView => {
    const arr = arrOf(c.type), b = arr[idx - 1], a = arr[idx]
    const when = (c.window ? c.whenText + ' (janela de ' + (c.prec === '1d' ? '1 dia, sincronização antiga' : '6 h') + ')' : c.whenText + ', horário exato') + ', ' + partAgo(c)
    const title = TYPE_NAME[c.type] + ': ' + (b?.label ?? '') + ' → ' + (a?.label ?? '')
    if (c.type === 'title') return { title, when, body: { kind: 'title', before: String(c.before), after: String(c.after) } }
    if (c.type === 'thumb') return { title, when, body: { kind: 'thumb', before: b?.thumb ?? miss(), after: a?.thumb ?? miss(), revert: c.revertTo ? 'Voltou para a versão ' + keyOf(c.revertTo) + ' (mesma imagem).' : null } }
    return { title, when, body: { kind: 'desc', text: c.diff ? c.diff.label : 'A descrição mudou; o texto antigo não foi guardado (antes de ' + S03 + ').', sub: c.diff ? 'Comparação linha a linha em Descrições, abaixo.' : null } }
  }
  const lanes: LaneView[] = (['title', 'thumb', 'desc'] as LaneType[]).map(type => ({
    type, label: TYPE_NAME[type], versions: arrOf(type),
    markers: events.filter(e => e.type === type && e.idx > 0).map(e => ({
      idx: e.idx, changeId: e.c.id, pairK: pairOfChange(e.c.id), h: e.h, win: e.win,
      aria: TYPE_NAME[type] + ' ' + (FEM[type] ? 'trocada' : 'trocado') + ' ' + (e.win ? e.c.whenText : 'em ' + e.c.whenText),
      tip: tipOf(e.c, e.idx),
    })),
    pre: type === 'thumb' && thumbPreAt != null
      ? { fromH: 0, toH: hx(thumbPreAt), text: compress ? 'antes de ' + preLabel : 'antes de ' + preLabel + ': não registrada', title: 'Thumbnail antes de ' + preLabel + ': não registrada' }
      : null,
  }))

  // ---------- context: breadcrumb + pager (rebuilds the origin list) ----------
  const qids = (p.ids ?? '').split(',').map(x => x.trim()).filter(x => x && obs.video(x))
  const bp = new URLSearchParams(back ? back.slice(1) : '')
  const ctx = context()
  function context(): { crumb: string; href: string; ids: string[]; keepIds: string[] | null; of: string; outside: string; sub: { text: string; href: string } | null } {
    const n = ctxNiche, vv = v!
    if (from === 'outliers') {
      const href = backHref('outliers', obs.link.outliers({ niche: userNiche }))
      if (qids.length) return { crumb: 'Outliers', href, ids: qids, keepIds: qids, of: 'em Outliers, na ordem da lista aberta', outside: 'fora da lista de Outliers aberta', sub: null }
      // The list Outliers shows for these params (same parser, defaults, age aliases and reading scope as the screen).
      const params: Record<string, string | undefined> = Object.fromEntries(bp)
      if (!params.niche) params.niche = userNiche
      const ov = buildOutliersView(obs, params), q = ov.query
      const ALL = obs.OUT_WINDOWS.map(w => w.id)
      const ageTxt = q.ages === 'all' || q.ages.length === ALL.length ? 'todas as idades' : ages2label(obs, q.ages)
      const minTxt = q.min === 0 ? 'todos os vídeos' : F.mult(q.min) + ' ou mais'
      const desc = [q.niche !== 'todos' ? 'nicho ' + NICHE_LABEL[q.niche] : 'todos os nichos', q.fmt === 'short' ? 'Shorts' : 'longos', ageTxt, minTxt,
        q.channel ? obs.channel(q.channel)?.name ?? null : null, q.formula ? obs.formula(q.formula)?.label ?? null : null, q.topic ? (obs.theme(q.topic)?.label ?? q.topic) : null,
        q.reading ? 'escopo da leitura' : null, q.sort === 'vpd' ? 'por views/dia' : q.sort === 'recent' ? 'mais recentes primeiro' : 'por fase'].filter(Boolean).join(', ')
      return { crumb: 'Outliers', href, ids: ov.pageIds, keepIds: null, of: 'em Outliers (' + desc + ')', outside: 'fora da lista de Outliers (' + desc + ')', sub: null }
    }
    if (from === 'canais') {
      const own = obs.videos.filter(x => x.ch === vv.ch && x.tracked && x.fmt === vv.fmt).sort((a, b) => b.pub - a.pub).map(x => x.id)
      const ids = qids.length ? qids : own
      let href: string, subHref: string
      if (bp.get('channel')) {
        const b2 = new URLSearchParams(bp); b2.delete('channel'); const qs = b2.toString()
        href = tabPath(obs, 'canais') + (qs ? '?' + qs : '')
        subHref = tabPath(obs, 'canais') + back!
      } else { href = backHref('canais', obs.link.canais({ niche: userNiche })); subHref = obs.link.canais({ channel: vv.ch }) }
      return { crumb: 'Canais', href, ids, keepIds: qids.length ? qids : null, sub: { text: ch.name, href: subHref },
        of: 'de ' + ch.name + ' (' + (vv.fmt === 'short' ? 'Shorts' : 'longos') + ' acompanhados, do mais novo ao mais antigo)', outside: 'fora dos vídeos acompanhados de ' + ch.name }
    }
    if (from === 'insights') return { crumb: 'Insights', href: backHref('insights', obs.link.insights({ niche: userNiche })), ids: [], keepIds: null, of: '', outside: 'aberto a partir de Insights', sub: null }
    const href = backHref('mudancas', obs.link.mudancas({ video: vv.id }))
    if (qids.length) return { crumb: 'Mudanças', href, ids: qids, keepIds: qids, of: 'em Mudanças, na ordem da lista aberta', outside: 'fora da lista de Mudanças aberta', sub: null }
    // The list Mudanças shows for these params (same parseFilters, query, search, saved set and sort as the screen).
    const params: Record<string, string | undefined> = Object.fromEntries(bp)
    if (!parseNiche(params.niche)) params.niche = userNiche
    const { f, ordered } = mudancasList(obs, params, new Set(opts?.savedChangeIds ?? []))
    const ids = [...new Set(ordered.map(c => c.video))]
    const TL: Record<string, string> = { title: 'títulos', thumb: 'thumbnails', desc: 'descrições' }, SL: Record<string, string | null> = { recent: null, gain: 'maior ganho primeiro', loss: 'maior perda primeiro' }
    const desc = [f.niche !== 'todos' ? 'nicho ' + NICHE_LABEL[f.niche] : 'todos os nichos', f.type !== 'all' ? TL[f.type] ?? f.type : null, f.channel !== 'all' ? obs.channel(f.channel)?.name ?? null : null,
      f.fmt !== 'all' && !f.video ? (f.fmt === 'short' ? 'Shorts' : 'longos') : null, f.video ? 'um vídeo' : null,
      f.changes ? F.plural(f.changes.length, 'troca marcada', 'trocas marcadas') : f.win + ' dias', f.measured ? 'só efeito medido' : null,
      f.saved ? 'só salvas' : null, f.q ? 'busca “' + f.q + '”' : null, SL[f.sort] ?? null, F.plural(ordered.length, 'troca', 'trocas')].filter(Boolean).join(', ')
    return { crumb: 'Mudanças', href, ids, keepIds: null, of: 'com trocas em Mudanças (' + desc + ')', outside: 'fora da lista de Mudanças (' + desc + ')', sub: null }
  }
  const k = ctx.ids.indexOf(v.id)
  const navHref = (j: number) => (j < 0 || j >= ctx.ids.length ? null
    : obs.link.historico(ctx.ids[j]!, { from, ...(ctx.keepIds ? { ids: ctx.keepIds } : {}), ...(back ? { back } : {}) }))
  const pager: PagerView = {
    prev: k < 0 ? null : navHref(k - 1), next: k < 0 ? null : navHref(k + 1), backHref: ctx.href,
    position: k < 0 ? ctx.outside : 'vídeo ' + (k + 1) + ' de ' + ctx.ids.length + ' ' + ctx.of,
    prevLabel: 'Vídeo anterior em ' + ctx.crumb, nextLabel: 'Próximo vídeo em ' + ctx.crumb,
  }
  const crumbs: CrumbsView = { from, crumb: ctx.crumb, href: ctx.href, sub: ctx.sub }

  // ---------- coverage texts ----------
  const syncPhrase = () => {
    if (sy.added != null && now - sy.added < 48 * H_MS) return 'canal adicionado ' + D.ago(sy.added) + (sy.state === 'backfill' ? ', ' + (sy.problemPhrase || 'ainda buscando vídeos') : '')
    if (sy.problemPhrase) return sy.problemPhrase
    return ('canal ' + (sy.label ?? '')).trim()
  }
  const syncTail = () => (sy.state === 'backfill' || (sy.added != null && now - sy.added < 48 * H_MS) ? ', ' + syncPhrase() : '')
  const sameSinceText = (field: 'título' | 'descrição') => {
    const fem = field === 'descrição'
    if (obsSince != null && pub >= obsSince && syncOk) return 'Mesm' + (fem ? 'a' : 'o') + ' ' + field + ' desde a publicação.'
    const fromMs = obsSince != null ? Math.max(obsSince, pub) : pub
    return 'Sem troca de ' + field + ' vista desde ' + D.dmOrDmy(fromMs) + (syncOk || sy.last == null ? '' : '; não conferid' + (fem ? 'a' : 'o') + ' desde ' + dmhmY(sy.last) + syncTail()) + '.'
  }
  const watchText = () => {
    const sinceTxt = obsSince != null ? 'Observamos ' + ch.name + ' desde ' + D.dmOrDmy(obsSince) : 'Observamos ' + ch.name
    if (sy.added != null && now - sy.added < 48 * H_MS) return 'Canal adicionado ' + D.ago(sy.added) + ': as trocas são conferidas a partir de ' + dmhmY(sy.added) + ', ' + obs.SYNC.cadence
    if (!syncOk) return sinceTxt + ', mas as trocas não estão sendo conferidas' + (sy.last != null ? ' desde ' + dmhmY(sy.last) : '') + syncTail()
    return sinceTxt + '; título, thumbnail e descrição são conferidos a cada sincronização, ' + obs.SYNC.cadence
  }

  // ---------- header ----------
  const header = buildHeader()
  function buildHeader(): HeaderView {
    const vv = v!, m = vv.mult
    const nT = titles.length, distinct = new Set(v!.thumbs.map(t => t.key)).size, nD = descs.length, ret = changes.some(c => c.revertTo)
    const counts: HeaderView['counts'] = !vv.tracked ? [] : !changes.length ? [{ type: null, text: 'Nenhuma troca registrada' }] : [
      { type: 'title', text: F.plural(nT, 'título', 'títulos') },
      { type: 'thumb', text: thumbs.length > 1 ? distinct + ' thumbnails em ' + thumbs.length + ' períodos' + (ret ? ' (uma voltou)' : '') : thumbPreAt != null ? '1 thumbnail (vista desde ' + preLabel + ')' : F.plural(thumbs.length, 'thumbnail', 'thumbnails') },
      { type: 'desc', text: F.plural(nD, 'descrição', 'descrições') },
    ]
    const lastP = pts[pts.length - 1]
    let multText: string
    if (!m || (m.value == null && !vv.tracked)) multText = 'sem multiplicador'
    else if (m.value == null) multText = 'sem multiplicador: ' + (m.reason === 'sem série' ? 'nenhum registro diário ainda' : m.reason || m.label || 'sem base')
    else {
      const lab = String(m.label ?? '').replace('vs vídeos do canal', vv.fmt === 'short' ? 'vs Shorts do canal' : 'vs vídeos do canal')
      const core = lab + (m.weak ? ' (base fraca)' : '') + (m.fallback && m.fallbackText ? '' : ', método: ' + m.method)
      multText = syncOk || !lastP ? core : core + ', até o registro diário de ' + dmhmY(lastP.t)
    }
    const cur = thumbs[thumbs.length - 1]
    return {
      thumb: cur?.thumb ?? { src: null, missing: 'Nenhuma thumbnail registrada.', alt: 'Thumbnail' },
      dur: fmtDur(vv.dur),
      chan: { name: ch.name, ini: ch.ini || ch.name.slice(0, 2).toUpperCase(), color: ch.color || '#3B2F8F', niche: vv.niche ? NICHE_LABEL[vv.niche] : null },
      views: vv.views != null ? { num: F.num(vv.views), text: ' views' + (syncOk || vv.viewsAt == null ? '' : ' até o registro diário de ' + dmhmY(vv.viewsAt)) } : { num: null, text: 'views ainda não registradas' },
      pub: { age: F.age(vv), full: dmhmY(pub) },
      fmt: vv.fmt === 'short' ? 'Short' : 'Vídeo longo',
      sync: { text: sy.problemPhrase || obs.syncText(ch.id), bad: !syncOk, title: sy.msg ?? '' },
      mult: { text: multText, title: m?.method ? 'Método do multiplicador: ' + m.method + (m.fallbackText ? '. ' + cap(m.fallbackText) : '') + '. O efeito de cada troca tem método próprio, no card de comparação.' : '' },
      fallback: m?.fallback && m.fallbackText ? endDot(cap(m.fallbackText)) : null,
      counts,
    }
  }

  const videoOut = { id: v.id, title: v.title, channel: ch.name, niche: v.niche, age: F.age(v), url: v.url, nicheToast }
  const state = stateOf(obs, v, ch, changes)
  if (!v.tracked) {
    return {
      video: videoOut, chromeNiche, crumbs, header, chart: null, lanes: [], legends: {}, comparisons: [], defaultPair: null, compareEmpty: null,
      versions: null, pager, state, notFound: null,
      untracked: { text: ch.name + ' tem ' + F.plural(ch.video_limit, 'vídeo acompanhado', 'vídeos acompanhados') + ', os mais recentes; este ficou de fora. Sem registro diário de views e sem versões de título, thumbnail ou descrição para mostrar.', href: obs.link.canais({ channel: v.ch }) },
    }
  }

  // ---------- chart ----------
  const expectedRaw = obs.expectedCurve(v.id).filter(q => q.vpdAnchored != null && q.t - q.from >= DAY - 60e3)
  const expected = expectedRaw.map(q => ({ a: hx(q.from), b: hx(q.t), v: q.vpdAnchored!, n: q.nAnchored, t: q.t }))
  const vmax = Math.max(...bins.map(b => b.v), ...expected.map(e => e.v), 1) * 1.12
  const mag = Math.pow(10, Math.floor(Math.log10(vmax / 4)))
  const step = [1, 2, 5, 10].map(x => x * mag).find(s => vmax / s <= 5) ?? 10 * mag
  const ymax = Math.ceil(vmax / step) * step
  const yf = (x: number) => x / ymax
  const yTicks: ChartView['yTicks'] = []
  for (let kk = 0; kk <= ymax + 1e-9; kk += step) yTicks.push({ y: yf(kk), label: kk === 0 ? '0' : F.num(kk) })
  const tStart = compress ? SS : pub, days = Math.ceil((now - tStart) / DAY), stepD = Math.max(1, Math.ceil(days / 6))
  const xTicks: ChartView['xTicks'] = compress ? [{ h: 0, label: D.dmOrDmy(pub) }] : []
  for (let d = 0; d <= days; d += stepD) { const ms = tStart + d * DAY; if (ms <= now) xTicks.push({ h: hx(ms), label: D.dmOrDmy(ms) }) }
  if (!xTicks.length || H - xTicks[xTicks.length - 1]!.h > stepD * 12) xTicks.push({ h: H, label: D.dmOrDmy(now) })
  const lastPt = pts[pts.length - 1]
  const pre = pub < SS
  const lastBinB = bins.length ? bins[bins.length - 1]!.b : null
  const channelsHref = obs.link.canais({ channel: v.ch })
  const chart: ChartView = {
    points: bins.map(b => ({ t: b.t, vpd: b.v })),
    expected: expected.map(e => ({ t: e.t, vpd: e.v })),
    expectedMethod: expectedRaw.length ? obs.expectedCurve(v.id).methodLabel : '',
    compressedBefore: compress ? SS : null,
    H, B0: compress ? hx(SS) : null, few,
    src: few ? { bold: null, text: 'registro diário de views às ' + (lastPt ? D.hh(lastPt.t) : D.hh(nextSnapMs)) }
      : { bold: F.plural(pts.length, 'registro diário', 'registros diários'), text: ' (às ' + D.hh(lastPt!.t) + (pre ? ', desde ' + S03 : '') + '); views ganhas entre um registro e outro; último ' + dmhmY(lastPt!.t) },
    empty: few ? {
      title: 'Ainda não há curva: ' + (pts.length ? 'só 1 registro diário' : 'nenhum registro diário') + '.',
      text: 'O vídeo saiu ' + F.age(v) + ', em ' + dmhmY(pub) + '. A curva precisa de pelo menos 2 registros. ' + (!syncOk ? 'O próximo registro depende da sincronização do canal, hoje com problema: ' + syncPhrase() + '.' : 'O próximo é ' + nextSnap + '.'),
      last: lastPt ? { views: F.num(lastPt.views), at: dmhmY(lastPt.t) } : null,
      tail: changes.length ? ' As trocas já aparecem nas faixas abaixo.' : null,
      link: !syncOk ? { href: channelsHref, text: 'Ver o canal em Canais' } : null,
    } : null,
    bins: bins.map(b => {
      const ex = expected.find(e => Math.abs(e.b - b.b) < 0.5)
      return { a: b.a, b: b.b, vpd: b.v, y: yf(b.v), from0: b.from0, label: F.num(b.v), labelY: yf(Math.max(b.v, ex ? ex.v : 0)) }
    }),
    expectedSteps: expected.map((e, i) => ({ a: e.a, b: e.b, y: yf(e.v), joined: i > 0 && Math.abs(expected[i - 1]!.b - e.a) < 0.5 })),
    yTicks,
    pre: pre ? { toH: compress ? hx(SS) : seriesStartH, lines: compress ? ['antes de ' + S03, preDays + ' dias', 'comprimidos,', 'sem registro'] : ['sem registro por vídeo antes de ' + S03] } : null,
    hatch: lastBinB != null && H > lastBinB ? { fromH: lastBinB, note: stale ? 'sem registro desde ' + D.dm(lastPt!.t) : null } : null,
    firstNote: firstNote ? { toH: hx(firstNote.t), text: F.num(firstNote.views) + ' em ' + Math.round(firstNote.h) + ' h' } : null,
    xTicks,
    aria: 'Views por dia de ' + v.title + ', ' + pts.length + ' registros diários. ' + events.length + ' trocas marcadas. Valores na tabela abaixo.',
    fewAxis: few ? [{ h: 0, label: dmhmY(pub) }, ...changes.flatMap(c => (c.window ? [{ h: hx(c.window[0]), label: D.hh(c.window[0]) }, { h: hx(c.window[1]), label: D.hh(c.window[1]) }] : [])), { h: H, label: 'agora ' + D.hm(now) }] : null,
    stale: stalled && hx(endNow) < H ? { fromH: hx(endNow), title: 'sem conferência desde ' + dmhmY(sy.last!) } : null,
    table: few ? null : pts.map((pt, i) => {
      const b = bins.find(x => Math.abs(x.b - hx(pt.t)) < 0.01), ex = expected.find(e => e.t === pt.t)
      return [dmhmY(pt.t), F.num(pt.views), b ? F.num(b.v) + (b.from0 ? ' (desde a publicação)' : '') : i === 0 ? '1º registro' : 'sem registro anterior',
        ex ? F.num(ex.v) + ' (' + ex.n + ')' : i === 0 && firstNote ? 'sem média (menos de 24 h desde a publicação)' : 'menos de 3 vídeos para comparar']
    }),
  }

  // ---------- comparisons ----------
  const versionAt = (type: LaneType, ms: number) => { const raw = rawOf(type), arr = arrOf(type); let r = 0; raw.forEach((x, i) => { if (x.first_seen <= ms) r = i }); return { raw: raw[r], view: arr[r], text: type === 'title' ? v!.titles[r]?.text ?? null : null } }
  const effLabel = (e: EffectResult) => (e.status === 'aguardando' ? 'aguardando (' + e.collected + ' de 7 dias)' : e.label)
  const fmtLong = v.fmt === 'short' ? 'Shorts' : 'vídeos longos'
  const comparisons: ComparisonView[] = pairs.map(q => {
    const e = q.e, c0 = q.group[0]!, last = q.group[q.group.length - 1]!
    let ba: BaSide[] | null = null
    if (c0.type !== 'desc') {
      if (q.e2) {
        const tb = thumbs.find(t => t.id === c0.fromId), ta = thumbs.find(t => t.id === c0.toId), tl = thumbs.find(t => t.id === last.toId)
        ba = [
          { thumb: tb?.thumb ?? miss(), title: null, label: keyOf((c0.before as { key: string }).key) + ' até ' + c0.whenText },
          { thumb: ta?.thumb ?? miss(), title: null, label: keyOf((c0.after as { key: string }).key) + ' por ' + D.dur(c0.nextLivedMs ?? 0) },
          { thumb: tl?.thumb ?? miss(), title: null, label: keyOf((last.after as { key: string }).key) + ' de volta em ' + dmhmY(last.at) },
        ]
      } else {
        const preMs = (c0.window ? c0.window[0] : c0.at) - 60e3, postMs = Math.max(...q.group.map(g => g.at)) + 60e3
        const tb = versionAt('thumb', preMs), ta = versionAt('thumb', postMs), Tb = versionAt('title', preMs), Ta = versionAt('title', postMs)
        const known = !!tb.raw && !(openStart(tb.raw) && tb.raw.first_seen > preMs)
        ba = [
          { thumb: known ? tb.view!.thumb : tb.raw ? { src: null, missing: 'Thumbnail antes de ' + preLabel + ': não registrada', alt: 'Thumbnail' } : null, title: Tb.text, label: 'Antes (' + (Tb.view?.label ?? '') + (known ? ', thumbnail ' + tb.view!.label : '') + ')' },
          { thumb: ta.view?.thumb ?? null, title: Ta.text, label: 'Depois (' + (Ta.view?.label ?? '') + (ta.view ? ', thumbnail ' + ta.view.label : '') + ')' },
        ]
      }
    }
    let nobase: ComparisonView['nobase'] = null, full: ComparisonView['full'] = null
    let scaleTxt = '', windows: ComparisonView['windows'] = null
    // R53: the effect text of a change is Mudanças' (effectView), the same on both screens.
    const ev = effectView(obs, c0)
    const line = ['sem-antes', 'sem-serie', 'aguardando'].includes(e.status) ? ev.detail : endDot(ev.label + '. ' + ev.detail)
    if (e.observed == null) {
      nobase = {
        strong: line,
        text: e.readyOn && !['aguardando', 'sem-serie', 'sem-antes'].includes(e.status) ? ' Primeira leitura possível em ' + D.dmOrDmy(e.readyOn) + '.' : '',
      }
    } else {
      const hasBase = e.expected != null && !!e.iqr && e.iqr[0] != null && e.iqr[1] != null
      const q1 = hasBase ? Math.min(e.iqr![0]!, e.iqr![1]!) : null, q3 = hasBase ? Math.max(e.iqr![0]!, e.iqr![1]!) : null
      const vals = [e.observed, 0, ...(hasBase ? [e.expected!, q1!, q3!] : [])].map(x => x * 100)
      const lo = Math.floor((Math.min(...vals) - 6) / 5) * 5, hi = Math.ceil((Math.max(...vals) + 6) / 5) * 5
      const pos = (x: number) => ((x * 100 - lo) / (hi - lo)) * 100
      scaleTxt = 'escala ' + F.pct(lo / 100) + ' a ' + F.pct(hi / 100)
      const cDate = (t: string) => { const mm = String(t).match(/(\d{2})\/(\d{2})(?: (\d{2})(?::(\d{2})|h))?/); return mm ? +mm[2]! * 1e6 + +mm[1]! * 1e4 + +(mm[3] || 0) * 100 + +(mm[4] || 0) : 0 }
      const cav = [...obs.caveats(e.id)].sort((a, b) => cDate(a) - cDate(b))
      if (q.group.some(g => g.testCompare)) cav.unshift('Alternância compatível com Testar e comparar (teste A/B do YouTube), não confirmada: o YouTube não informa o teste nem o vencedor.')
      full = {
        what: q.e2 ? 'Thumbnail ' + q.labs![0] : q.label,
        whatWhen: ', ' + c0.whenText + ' (' + partAgo(c0) + ')',
        days: 'antes: ' + F.plural(e.beforeDays ?? 0, 'dia', 'dias') + '; depois: ' + F.plural(e.afterDays ?? 0, 'dia', 'dias') + '; o dia da troca fica de fora',
        verdictStrong: (hasBase ? cap(e.numbersFlat ?? '') : 'Observado ' + F.pct(e.observed) + '; ' + (e.noBaseText ?? '')) + '.',
        pill: e.label,
        verdictText: ' ' + line + (e.status === 'neutro' ? ' Não dá para dizer que a troca ajudou ou atrapalhou.' : ''),
        scale: {
          aria: hasBase ? 'Observado ' + F.pct(e.observed) + ', esperado ' + F.pct(e.expected!) + ', faixa normal de ' + F.pct(q1) + ' a ' + F.pct(q3) : 'Observado ' + F.pct(e.observed),
          hasBase, iqr: hasBase ? { left: pos(q1!), width: Math.max(0.6, pos(q3!) - pos(q1!)) } : null, med: hasBase ? pos(e.expected!) : null,
          obs: pos(e.observed), zero: pos(0), obsLabelLeft: Math.min(85, Math.max(15, pos(e.observed))),
          baseLabel: hasBase ? 'faixa normal ' + F.pct(q1) + ' a ' + F.pct(q3) + ', esperado ' + F.pct(e.expected!) : null,
          obsLabel: 'observado ' + F.pct(e.observed), rangeLabel: scaleTxt,
        },
        src: hasBase ? 'Faixa normal: metade dos outros ' + fmtLong + ' de ' + ch.name + ' ficou entre ' + F.pct(q1) + ' e ' + F.pct(q3) + ' na mesma idade (' + e.band + ' em ' + D.dm(c0.at) + '; n = ' + e.n + ', sem contar este vídeo; método: ' + e.method + ').' + (e.fallbackText ? ' ' + e.fallbackText + '.' : '') : '',
        second: q.e2 ? { strong: q.labs![1] + ':', text: ' ' + (q.e2.observed != null ? q.e2.numbersFlat + '. ' : '') + F.labelReason(q.e2.label, q.e2.reason, { sentence: true }) } : null,
        caveats: cav,
      }
      if (e.expected != null && e.firstPointAfter != null && e.k != null) {
        const fa = hx(e.firstPointAfter), aEnd = fa + (e.afterDays ?? 0) * 24, bEnd = hx(D.snapTime(e.k - 1)), bStart = Math.max(0, bEnd - (e.beforeDays ?? 0) * 24)
        windows = { before: [bStart, bEnd], after: [fa, aEnd] }
      }
    }
    return {
      changeId: q.k, before: e.beforeAvg != null ? F.num(e.beforeAvg) : '—', after: e.afterAvg != null ? F.num(e.afterAvg) : '—', scale: scaleTxt,
      effect: ev,
      chip: q.e2 ? 'Thumbnail ' + q.labs![0] + ': ' + effLabel(e) + ' · ' + q.labs![1] + ': ' + effLabel(q.e2) : q.label + ': ' + effLabel(e),
      ba, nobase, full, descLink: c0.type === 'desc' && !!c0.diff, windows,
    }
  })
  const defaultPair = (pairs.find(q => ['neutro', 'ganhou', 'perdeu'].includes(q.e.status)) ?? pairs[0])?.k ?? null

  // ---------- legend (per selected pair) ----------
  const hasType = (t: LaneType) => events.some(e => e.type === t)
  const legendFor = (pk: string | null): LegendItem[] => {
    const q = pk ? pairs.find(x => x.k === pk) ?? null : null, cmp = pk ? comparisons.find(x => x.changeId === pk) ?? null : null
    const out: LegendItem[] = []
    if (!few) out.push({ kind: 'curve', text: 'views/dia (degrau = 1 dia entre registros)' })
    if (!few && !expected.length && bins.length) out.push({ kind: 'dash', text: 'esperado pela idade: sem base, menos de 3 outros vídeos do canal com registro na mesma idade em dias' + (q && (q.e.n ?? 0) > 0 && q.e.method === 'aproximação por faixa' ? '; a comparação abaixo usa a faixa de idade, que junta mais vídeos' : '') })
    if (!few && expected.length) {
      const ns = expected.map(x => x.n), lo = Math.min(...ns), hi = Math.max(...ns)
      out.push({ kind: 'dash', text: 'esperado pela idade: mediana dos outros ' + fmtLong + ' do canal sem trocas, na mesma idade em dias, sem contar este, ' + (pub < SS ? 'ancorada no 1º registro deste vídeo (' + D.dm(pts[0]!.t) + ')' : 'ancorada no 1º dia completo deste vídeo') + ' (n = ' + (lo === hi ? lo : lo + ' a ' + hi) + '; some quando n < 3)' })
    }
    if (q && cmp?.windows && q.e.observed != null) out.push({ kind: 'shade', text: 'janelas antes e depois de ' + q.label })
    if (compress) out.push({ kind: 'text', text: preDays + ' dias antes de ' + S03 + ' comprimidos à esquerda (sem registro por vídeo)' })
    if (!few && bins.length && H > bins[bins.length - 1]!.b) out.push({ kind: 'hatch', text: stale ? 'sem registro desde ' + D.dm(lastPt!.t) + ', ' + syncPhrase() : 'dia em coleta, fecha ' + nextSnap })
    if (thumbPreAt != null) out.push({ kind: 'hatch', text: 'thumbnail antes de ' + preLabel + ': não registrada' })
    if (events.some(e => e.win)) out.push({ kind: 'win', text: 'janela entre duas sincronizações: título e descrição não têm minuto; sincronização ' + obs.SYNC.cadence })
    if (hasType('thumb')) out.push({ kind: 'thumb', text: 'troca de thumbnail com horário exato (detectada pela mudança do arquivo da imagem)' })
    if (!events.length) out.push({ kind: 'text', text: 'Nenhuma troca registrada.' })
    return out
  }
  const legends: Record<string, LegendItem[]> = { '': legendFor(null) }
  for (const q of pairs) legends[q.k] = legendFor(q.k)

  // ---------- versions section ----------
  const tc = changes.filter(c => c.type === 'thumb' && c.testCompare)
  const thumbNotes: VersionsView['thumbs']['notes'] = []
  if (tc.length) { const c = tc[0]!; const b = keyOf((c.before as { key: string }).key), a = keyOf((c.after as { key: string }).key); thumbNotes.push({ kind: 'ab', text: b + ' → ' + a + ' → ' + b + ' em ' + D.dur(c.cycleMs ?? 0) + ': alternância típica do Testar e comparar (teste A/B do YouTube). Compatível, não confirmado — o YouTube não informa o teste nem o vencedor.' }) }
  if (thumbPreAt != null) thumbNotes.push({ kind: 'warn', text: 'Thumbnail vista desde ' + preLabel + ', quando o arquivo de imagens começou. Trocas de thumbnail anteriores vinham de um método antigo (pela URL), que não é confiável, então não aparecem como troca.' })
  const dc = changes.filter(c => c.type === 'desc'), withText = dc.filter(c => c.diff)
  const versions: VersionsView = {
    thumbs: { src: thumbs.length > 1 ? new Set(v.thumbs.map(t => t.key)).size + ' imagens em ' + thumbs.length + ' períodos, em ordem' : thumbs.length ? 'sem troca vista' : 'Nenhuma thumbnail registrada', cards: thumbs, notes: thumbNotes },
    titles: { src: titles.length > 1 ? 'trechos alterados contra o anterior' : 'sem troca vista', same: titles.length > 1 ? null : sameSinceText('título'), items: titles },
    descs: {
      src: descs.length < 2 ? 'sem troca vista' : withText.length ? 'comparação linha a linha' : 'texto antigo não guardado',
      same: descs.length < 2 ? sameSinceText('descrição') : null, rows: descs,
      notes: descs.length < 2 ? [] : dc.filter(c => !c.diff).map(c => (verLabel.get(c.fromId) ?? c.fromId) + ' → ' + (verLabel.get(c.toId) ?? c.toId) + ' (' + c.whenText + '): antes de ' + S03 + ' a sincronização só registrava que a descrição mudou, sem guardar o texto. Não há comparação linha a linha para esta troca.'),
      diffs: descs.length < 2 ? [] : withText.map(c => ({
        sum: (verLabel.get(c.fromId) ?? c.fromId) + ' → ' + (verLabel.get(c.toId) ?? c.toId) + ': ' + c.diff!.label,
        utm: c.diff!.utm, utmNote: c.diff!.utm ? F.plural(c.diff!.utm, 'mudança só de link/UTM oculta', 'mudanças só de link/UTM ocultas') : null,
        rows: diffRows(obs, c.diff!.lines),
      })),
    },
  }

  return {
    video: videoOut, chromeNiche, crumbs, header, chart, lanes, legends, comparisons, defaultPair,
    compareEmpty: pairs.length ? null : endDot(watchText()) + ' Se o canal trocar título, thumbnail ou descrição, a troca aparece na curva acima e entra em Mudanças.',
    versions, pager, state, untracked: null, notFound: null,
  }
}

const miss = (): ThumbImg => ({ src: null, missing: 'Imagem não registrada.', alt: 'Thumbnail' })

/** Duration of the video: seconds → "24:18" / "1:02:03" (the oracle already carries the text). */
function fmtDur(d: number | string | null): string | null {
  if (d == null) return null
  if (typeof d === 'string') return d
  if (!Number.isFinite(d) || d <= 0) return null
  const s = Math.round(d), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  const p2 = (n: number) => (n < 10 ? '0' : '') + n
  return h ? h + ':' + p2(m) + ':' + p2(ss) : m + ':' + p2(ss)
}

function titleDiffView(obs: Observatory, a: string, b: string): TitleDiffView {
  const d = obs.titleDiff(a, b)
  const after = d.after.map(s => ({ op: s.op, text: s.text, title: s.op === 'move' ? d.labels.move : s.op === 'case' ? d.labels.case : null }))
  const gone: TitleDiffView['gone'] = []
  const sep = () => { if (gone.length) gone.push({ kind: 'text', text: '; ' }) }
  const list = (label: string | null, words: string[], kind: 'del' | 'ins') => {
    sep(); gone.push({ kind: 'text', text: (label ?? '') + ': ' })
    words.forEach((w, i) => { if (i) gone.push({ kind: 'text', text: ', ' }); gone.push({ kind, text: w }) })
  }
  if (d.removed.length) list(d.labels.rem, d.removed, 'del')
  if (d.added.length) list(d.labels.add, d.added, 'ins')
  const mv = d.after.filter(x => x.op === 'move').map(x => x.text.trim()), cs = d.after.filter(x => x.op === 'case').map(x => x.text.trim())
  if (mv.length) { sep(); gone.push({ kind: 'text', text: (d.labels.move ?? '') + ': ' + mv.join(', ') }) }
  if (cs.length) { sep(); gone.push({ kind: 'text', text: (d.labels.case ?? '') + ': ' + cs.join(', ') }) }
  return { after, gone }
}

function diffRows(obs: Observatory, lines: Array<{ op: 'ctx' | 'add' | 'rem' | 'utm'; text: string; from?: string }>): DiffRow[] {
  const rows: DiffRow[] = []
  let run: Array<{ text: string }> = []
  const flush = () => {
    if (run.length >= 3 && run.every(r => r.text)) rows.push({ kind: 'fold', text: obs.fmt.plural(run.length, 'linha sem mudança', 'linhas sem mudança') + ' (' + run.map(r => r.text).join(', ') + ')' })
    else run.forEach(r => rows.push({ kind: 'ctx', text: r.text }))
    run = []
  }
  for (const l of lines) {
    if (l.op === 'ctx' && l.text) { run.push(l); continue }
    flush()
    if (l.op === 'ctx') rows.push({ kind: 'ctx', text: '' })
    else if (l.op === 'utm') rows.push({ kind: 'utm', from: l.from ?? '', extra: l.text.slice((l.from ?? '').length) })
    else rows.push({ kind: l.op, text: l.text })
  }
  flush()
  return rows
}

function stateOf(obs: Observatory, v: ObsVideo, ch: ObsChannel, changes: ObsChange[]): HistState {
  if (!v.tracked) return 'untr'
  if (ch.sync.state === 'backfill') return 'bf'
  if (ch.sync.state === 'erro') return 'err'
  if (!v.series.length) return 'noreg'
  if (v.series.length < 2) return 'few'
  if (changes.length) return changes.some(c => c.preSeries) ? 'pre' : 'full'
  // "Antigo sem trocas": published before the channel was first observed (no part of its life was watched).
  const since = ch.sync.added ?? ch.snapshots[0]?.t ?? null
  return v.pub < obs.SERIES_START && since != null && v.pub < since ? 'old' : 'none'
}
