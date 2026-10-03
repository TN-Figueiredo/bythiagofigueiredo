/**
 * View model of the Outliers screen (port of outliers.html: applyParams, render0, card, emptyState).
 * Pure: every count, multiplier, phase, base and date comes from the engine (Observatory.outliers / multiplier /
 * channelStats / fmt / date). The screen only lays out what this returns; nothing here reads the clock.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import type { NicheScope } from '@/lib/youtube/observatorio/niche'
import type { OutlierItem, OutlierQuery, OutlierSort } from '@/lib/youtube/observatorio/outliers'
import type { MultiplierResult } from '@/lib/youtube/observatorio/multiplier'
import type { Fmt, ObsChannel, ObsVideo, ThumbArt } from '@/lib/youtube/observatorio/types'
import { buildForjaView, type ForjaReadingView, type ForjaView } from '../_chrome/forja-view-model'

/** Inline text with emphasis: strings, bold runs, warning runs and an abbreviation with its explanation. */
export type RichPart = string | { b: string } | { w: string } | { abbr: string; title: string }
export type Rich = RichPart[]

export type PhaseKey = 'estourando' | 'recente' | 'perene' | 'antigo' | 'novos' | 'sem-ritmo'
export type GroupKey = PhaseKey | 'flat' | 'above' | 'below'
export type Tone = 'hot' | 'mid' | 'ever' | 'old' | 'none' | 'flat' | 'above' | 'below'
export type Tier = 'mid' | 'high' | 'top'

export interface OutlierCardView {
  id: string; main: boolean; title: string; channel: string; channelFull: string
  niche: 'viagem' | 'ia' | null; nicheLabel: string | null
  age: string; ageTitle: string; ageShort: string
  mult: string; multLabel: string; method: string; tier: Tier | null; weak: boolean; stale: boolean; neutral: boolean
  views: string; vpd7: string | null; vpdText: string; vpdTitle: string | null; vpdShort: string; vpdShortNote: string | null
  historyHref: string; url: string; thumb: string | null; art: ThumbArt | null; dur: string | null
  /** "Como o 6,0× é calculado" (tooltip) and, on the main card, the visible explanation. */
  tip: Rich; why: Rich | null
  flags: string[]
  phase: { id: PhaseKey; label: string; tone: Tone }; showPhase: boolean; phaseWhy: string | null
  reuse: null | { month: string; vpd7: string; median: string }
  /** Log scale 1×..50× in % of the track; ticks at 2×, 5×, 10×. */
  ruler: { pos: number; from: number; ticks: number[]; legend: string[]; tone: Tier | 'muted' }
}
export interface OutlierGroupView {
  id: GroupKey; label: string; tone: Tone; why: string
  count: number | null; weakCount: number; countText: string | null; onlyWeakText: string | null
  cards: OutlierCardView[]; pageNote: string | null
}
export interface OutlierChipView {
  key: string; label: string; invalid: boolean; removeHref: string
  kind: 'link' | 'bad' | 'asof' | 'own' | 'pick'; removeLabel: string
  link?: { label: string; href: string }; picks?: Array<{ label: string; href: string }>; title?: string
  /** A count drawn bold after the label (the reading chip's "hoje, no mesmo escopo, são <b>41</b>"). */
  strong?: string
}
export interface OutlierEmptyAction { label: string; href: string; n: number; primary: boolean; dest: 'outliers' | 'canais' }
export interface OutliersView {
  query: {
    niche: NicheScope; fmt: Fmt; ages: string[] | 'all'; min: number; topic: string | null; formula: string | null; channel: string | null
    asof: string | null; reading: string | null; sort: OutlierSort; view: 'grid' | 'list'
  }
  /** Shortcut "Até 90 dias" (the default) and the exclusive windows. */
  shortcut: { label: string; count: number; selected: boolean; disabled: boolean; href: string; title: string | null; ariaLabel: string }
  timeline: Array<{ id: string; label: string; count: number; selected: boolean; href: string; barPx: number; title: string | null; ariaLabel: string }>
  allCount: number; allHref: string; allSelected: boolean; allLabel: 'Todos' | 'Leitura'; allTitle: string | null; allAriaLabel: string
  fmtLinks: Array<{ value: Fmt; label: string; href: string; pressed: boolean }>
  viewLinks: Array<{ value: 'grid' | 'list'; label: string; href: string; pressed: boolean }>
  sortOptions: Array<{ value: OutlierSort; label: string; href: string }>
  chipsLead: string | null; chips: OutlierChipView[]
  /** Summary line (plain text and with emphasis) and the "Como contamos" paragraphs. */
  baseText: string; baseParts: Rich; basisMore: string[]
  /** The screen shows another niche than the saved one (channel or reading of that niche); toast, not persisted. */
  nicheNotice: null | { niche: NicheScope; title: string; body: string }
  problems: null | { shown: Array<{ name: string; phrase: string }>; tail: string; rest: Array<{ name: string; phrase: string }>; restLabel: string; hideLabel: string }
  groups: OutlierGroupView[]
  more: null | { href: string; label: string; note: string }
  empty: null | { title: string; text: string; actions: OutlierEmptyAction[] }
  /** "Link da leitura de 20/10: ela via N; hoje são M" */
  asofNote: string | null
  /** Non-weak outliers in the current query (what the tab and the empty-state buttons count). */
  count: number
  /** The video ids the screen shows, in screen order (the list Histórico's pager walks). */
  pageIds: string[]
  /** The forja (padrões de título): header button/status and the collapsed forja bar (Task 35). */
  forja: ForjaView
  forjaBar: OutliersForjaBar | null
}
export interface OutliersForjaBar {
  bad: boolean
  /** With a request: its state chip and the engine line(s); without: "Leituras da forja: Viagem 20/10, IA 20/10". */
  summary: { kind: 'request'; chip: string; chipCls: 'bad' | 'warnst' | ''; line: string; split: boolean; statusText: string } | { kind: 'readings'; when: string }
  /** "Desde então" on its own line (one line, each niche labelled when two). */
  since: { multi: boolean; items: Array<{ id: string; label: string; body: string }> }
  req: { cls: 'forja' | 'refused'; text: string; trackHref: string | null } | null
  sideBad: string[]
  rows: Array<{ niche: string; isNew: boolean; first: string; reading: ForjaReadingView; href: string }>
  scope: { text: string; outs: string[] } | null
}

/* ------------------------------------------------------------------ constants (outliers.html) */
export const PAGE = 60
const NICHE_LABEL: Record<NicheScope, string> = { todos: 'Todos', viagem: 'Viagem', ia: 'IA' }
const PHASE_TONE: Record<PhaseKey, Tone> = { estourando: 'hot', recente: 'mid', perene: 'ever', antigo: 'old', novos: 'none', 'sem-ritmo': 'none' }
const PHASE_TITLE: Record<PhaseKey, string> = { estourando: 'Estourando agora', recente: 'Recentes', perene: 'Perenes', antigo: 'Antigos', novos: 'Novos', 'sem-ritmo': 'Sem ritmo medido' }
const NO_LEAD: readonly string[] = ['novos', 'sem-ritmo']
const AGE_ALIASES: Record<string, string> = { '365': '365+', 'mais-de-1-ano': '365+', '365mais': '365+' }
const FROM: Record<string, string> = { insights: 'Insights', mudancas: 'Mudanças', historico: 'Histórico do vídeo', canais: 'Canais', moldura: 'Fila da forja' }
const BAD_LABEL: Record<string, string> = { sort: 'ordem', view: 'visualização', niche: 'nicho', fmt: 'formato', age: 'idade', ages: 'idade', min: 'multiplicador mínimo', theme: 'tema', topic: 'tema', formula: 'fórmula', channel: 'canal', canal: 'canal', asof: 'data de leitura', reading: 'leitura' }
const BAD_FEM: readonly string[] = ['age', 'ages', 'formula', 'asof', 'reading', 'sort', 'view']
const OUT_READING_TYPES: readonly string[] = ['padroes-titulo', 'padroes-titulo-shorts', 'temas']
const SORT_LABEL: Record<OutlierSort, string> = { mult: 'Ordenar: multiplicador', vpd: 'Ordenar: views/dia', recent: 'Ordenar: mais recente' }

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const lcfirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s)
const plainOf = (r: Rich) => r.map(p => (typeof p === 'string' ? p : 'b' in p ? p.b : 'w' in p ? p.w : p.abbr)).join('')

interface Bad { key: string; value: string }
interface State {
  niche: NicheScope; fmt: Fmt; ages: string[]; sort: OutlierSort; view: 'grid' | 'list'; limit: number
  min: number | null; theme: string | null; formula: string | null; channel: string | null
  reading: string | null; own: string | null; notOut: { id: string; label: string } | null
  asofNone: string | null; asofPick: { af: string; ids: string[] } | null; from: string | null; bad: Bad[]
}
/** What an href changes from the current state (null = drop). */
type Nav = Partial<Pick<State, 'fmt' | 'ages' | 'sort' | 'view' | 'limit' | 'min' | 'theme' | 'formula' | 'channel' | 'reading' | 'bad' | 'asofPick'>> & { niche?: NicheScope; agesAll?: boolean }

export function buildOutliersView(obs: Observatory, p: Record<string, string | undefined>): OutliersView {
  const F = obs.fmt, D = obs.date, RULES = obs.RULES
  const ALL_AGES = obs.OUT_WINDOWS.map(w => w.id)
  const DEFAULT = [...obs.DEFAULT_AGES]
  const ch = (id: string) => obs.channel(id)
  const sortAges = (a: string[]) => [...new Set(a)].sort((x, y) => ALL_AGES.indexOf(x) - ALL_AGES.indexOf(y))
  const sameSet = (a: string[], b: string[]) => sortAges(a).join() === sortAges(b).join()

  /* ---------------- parameters (applyParams) */
  const S: State = { niche: 'todos', fmt: 'long', ages: DEFAULT, sort: 'mult', view: 'grid', limit: PAGE, min: null, theme: null, formula: null, channel: null, reading: null, own: null, notOut: null, asofNone: null, asofPick: null, from: null, bad: [] }
  const get = (k: string) => { const v = p[k]; return v == null || v === '' ? null : v }
  const n0 = get('niche')
  if (n0) { const k = n0 === 'all' ? 'todos' : n0; if (k === 'todos' || k === 'viagem' || k === 'ia') S.niche = k; else S.bad.push({ key: 'niche', value: n0 }) }
  const f0 = get('fmt'); if (f0) { if (f0 === 'long' || f0 === 'short') S.fmt = f0; else S.bad.push({ key: 'fmt', value: f0 }) }
  const ageKey = get('age') != null ? 'age' : get('ages') != null ? 'ages' : null
  const a0 = ageKey ? get(ageKey)! : null
  let agesAll = false
  if (a0) {
    const toks = a0.split(',').map(x => x.trim()).filter(Boolean)
    const ok: string[] = []
    for (const t of toks) {
      if (t === 'all' || t === 'todos') agesAll = true
      else if (t === '90') ok.push(...DEFAULT)
      else { const k = AGE_ALIASES[t] ?? t; if (ALL_AGES.includes(k)) ok.push(k); else S.bad.push({ key: ageKey!, value: t }) }
    }
    if (agesAll) S.ages = [...ALL_AGES]; else if (ok.length) S.ages = sortAges(ok)
  }
  const m0 = get('min'); if (m0 != null) { const x = Number(m0.replace(',', '.')); if (!Number.isNaN(x) && x >= 0 && x <= 100) S.min = x; else S.bad.push({ key: 'min', value: m0 }) }
  const th0 = get('theme'), tp = get('topic') ?? (th0 && th0 !== 'light' && th0 !== 'dark' && obs.theme(th0) ? th0 : null)
  if (tp) { if (obs.theme(tp)) S.theme = tp; else S.bad.push({ key: 'topic', value: tp }) }
  const so = get('sort'); if (so) { if (so === 'mult' || so === 'vpd' || so === 'recent') S.sort = so; else S.bad.push({ key: 'sort', value: so }) }
  const vw = get('view'); if (vw) { if (vw === 'grid' || vw === 'list') S.view = vw; else S.bad.push({ key: 'view', value: vw }) }
  const fo = get('formula'); if (fo) { if (obs.formula(fo)) S.formula = fo; else S.bad.push({ key: 'formula', value: fo }) }
  const chKey = get('channel') != null ? 'channel' : get('canal') != null ? 'canal' : null
  if (chKey) { const id = get(chKey)!, o = ch(id); if (o && o.own) S.own = id; else if (o) S.channel = id; else S.bad.push({ key: chKey, value: id }) }
  const lim = Number(get('limit')); if (Number.isInteger(lim) && lim > PAGE) S.limit = lim
  S.from = FROM[get('from') ?? ''] ? get('from') : null

  const minOf = () => S.min ?? RULES.outlierMin
  /** The niche the page resolved (URL or saved); this screen may show another one without persisting it. */
  const saved = S.niche
  let nicheNotice: OutliersView['nicheNotice'] = null
  const moveNiche = (n: NicheScope, what: string) => {
    if (n === S.niche) return
    S.niche = n
    nicheNotice = { niche: n, title: 'Mostrando ' + NICHE_LABEL[n] + ' para exibir ' + what, body: 'Seu nicho salvo não mudou.' }
  }
  // channel=<id> of another niche: show that niche on this screen only (mockup applyParams/moveNiche)
  if (S.channel && S.niche !== 'todos') { const c = ch(S.channel)!; if (c.niche !== S.niche) moveNiche(c.niche ?? 'todos', 'este canal') }
  const scopeOfId = (id: string) => obs.forja.readingScope(id)
  const useReading = (id: string) => {
    const sc = scopeOfId(id)!
    S.reading = id
    if (sc.niche && sc.niche !== S.niche) moveNiche(sc.niche, 'esta leitura')
    if (sc.fmt) S.fmt = sc.fmt
    if (sc.ages) S.ages = sortAges(sc.ages)
  }
  const rd = get('reading')
  if (rd) {
    const r = obs.forja.byId[rd]
    if (r && scopeOfId(rd)) useReading(rd)   // the engine returns null for readings that are not of outliers
    else if (r) S.notOut = { id: rd, label: r.type }
    else S.bad.push({ key: 'reading', value: rd })
  }
  const af = get('asof')
  if (af && !S.reading) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(af)) S.bad.push({ key: 'asof', value: af })
    else {
      // asof without reading: the outliers readings of that day in the format; more than one (niches or types) → ask
      const dmy = af.split('-').reverse().join('/'), ns = S.niche === 'todos' ? ['ia', 'viagem'] : [S.niche]
      let rs = Object.values(obs.forja.byId).filter(r => r.niche != null && ns.includes(r.niche) && !(r as { scenario?: boolean }).scenario && D.dmy(r.generatedAt) === dmy && (r.fmt ?? 'long') === S.fmt && !!scopeOfId(r.id))
      if (S.formula) rs = rs.filter(r => r.type !== 'temas')
      if (S.theme) { const tn = obs.theme(S.theme)!.niche, byN = rs.filter(r => r.niche === tn), temas = byN.filter(r => r.type === 'temas'); rs = temas.length ? temas : byN }
      if (rs.length === 1) useReading(rs[0]!.id)
      else if (rs.length > 1) S.asofPick = { af, ids: rs.map(r => r.id) }
      else S.asofNone = af
    }
  }

  /* ---------------- queries (all through obs.outliers), for this state or for a destination href */
  /** The niche a destination shows: an explicit niche=, else the reading's, else the channel's (when the saved one excludes it), else the saved one. */
  const nicheFor = (st: { reading: string | null; channel: string | null }): NicheScope => {
    if (st.reading) { const sc = scopeOfId(st.reading); if (sc?.niche) return sc.niche }
    if (st.channel && saved !== 'todos') { const c = ch(st.channel); if (c && c.niche !== saved) return c.niche ?? 'todos' }
    return saved
  }
  const queryOf = (nav: Nav = {}, extra: Partial<OutlierQuery> = {}): OutlierQuery => {
    const st = { ...S, ...nav }
    return {
      niche: nav.niche ?? nicheFor(st), fmt: st.fmt, ages: nav.agesAll ? 'all' : st.ages, min: st.min ?? RULES.outlierMin,
      theme: st.theme, formula: st.formula, channel: st.channel, ...(st.reading ? { reading: st.reading } : {}), ...extra,
    }
  }
  /** Count a destination shows (what an empty-state button promises). */
  const countAt = (nav: Nav) => obs.outliers(queryOf(nav)).count
  const q = (over: Partial<OutlierQuery> = {}) => obs.outliers(queryOf({}, over))
  const R = q(), Rw = q({ includeWeak: true }), all = q({ ages: 'all' })
  const scope = S.reading ? R.scope : null
  const effNiche: NicheScope = S.niche, effFmt: Fmt = S.fmt
  const effAges = S.ages
  const minOn = () => S.min != null && S.min !== RULES.outlierMin
  const allMode = () => S.min != null && S.min < RULES.outlierMin
  const hasLink = () => minOn() || !!S.theme || !!S.formula || !!S.channel
  const nm = allMode()
  const unit: [string, string] = nm ? ['vídeo', 'vídeos'] : ['outlier', 'outliers']
  const compact = !!(S.theme || S.formula || S.channel || minOn() || nm || S.reading || S.own || S.notOut || S.bad.length || S.from)

  /* ---------------- hrefs: the URL is the state (curQuery) */
  const hrefOf = (nav: Nav = {}, opt: { keepBad?: Bad[] } = {}): string => {
    const st = { ...S, ...nav }
    const ages = nav.agesAll ? 'all' : (st.ages.length === ALL_AGES.length ? 'all' : sameSet(st.ages, DEFAULT) ? null : sortAges(st.ages))
    const base = obs.link.outliers({
      fmt: st.fmt === 'short' ? 'short' : undefined, ages: ages ?? undefined, min: st.min ?? undefined,
      topic: st.theme ?? undefined, formula: st.formula ?? undefined, channel: st.channel ?? undefined, reading: st.reading ?? undefined,
    })
    const [path, qs0] = base.split('?')
    const u = new URLSearchParams(qs0 ?? '')
    if (nav.niche) u.set('niche', nav.niche)
    if (st.sort !== 'mult') u.set('sort', st.sort)
    if (st.view !== 'grid') u.set('view', st.view)
    if (st.limit > PAGE) u.set('limit', String(st.limit))
    if (st.asofPick && !st.reading) u.set('asof', st.asofPick.af)
    if (S.from) u.set('from', S.from)
    for (const b of opt.keepBad ?? st.bad) {
      const k = b.key === 'ages' ? 'age' : b.key === 'canal' ? 'channel' : b.key
      if (k === 'age') { const cur = u.get('age'); u.set('age', cur ? cur + ',' + b.value : b.value) }
      else if (!u.has(k)) u.set(k, b.value)
    }
    const s = u.toString()
    return path + (s ? '?' + s : '')
  }
  /** Leaving the reading: any window or format change drops it (mockup: "Saiu do escopo da leitura"). */
  const off = (nav: Nav): Nav => ({ reading: null, asofPick: null, limit: PAGE, ...nav })

  /* ---------------- timeline */
  const isDefault = sameSet(effAges, DEFAULT), isAll = effAges.length === ALL_AGES.length
  // outliers.html render0: the shortcut sums the current result's own bands (in reading mode too)
  const n90 = DEFAULT.reduce((sum, k) => sum + (R.byAge[k] ?? 0), 0)
  const partial = (w: { lo: number; hi: number }) => !!scope && scope.maxAge != null && w.lo <= scope.maxAge && w.hi > scope.maxAge
  const maxCount = Math.max(1, ...ALL_AGES.map(k => R.byAge[k] ?? 0))
  const windows = obs.OUT_WINDOWS.filter(w => !(partial(w) && scope!.maxAge! - w.lo < 7) && !(scope && scope.maxAge != null && w.lo > scope.maxAge))
  const timeline = windows.map(w => {
    const label = partial(w) ? w.lo + '–' + scope!.maxAge + ' d' : cap(w.label)
    const sel = effAges.includes(w.id)
    const next = sel && effAges.length > 1 ? effAges.filter(x => x !== w.id) : sel ? effAges : [...effAges, w.id]
    const count = R.byAge[w.id] ?? 0
    return {
      id: w.id, label, count, selected: sel, href: hrefOf(off({ ages: sortAges(next) })), barPx: Math.round(count / maxCount * 36) + 2,
      title: partial(w) ? 'Faixa cortada pela janela da leitura: só até ' + scope!.maxAge + ' dias' : null,
      ariaLabel: (partial(w) ? label : w.label) + ': ' + F.plural(count, unit[0], unit[1]),
    }
  })
  const hi90 = obs.OUT_WINDOWS[1]!.hi
  const shortcut = {
    label: 'Até ' + hi90 + ' dias', count: n90, selected: !scope && isDefault, disabled: !!scope, href: hrefOf(off({ ages: DEFAULT })),
    title: scope ? 'Modo leitura: a janela é a da leitura (' + scope.windowDays + ' dias). Tire a leitura para usar os atalhos.' : null,
    ariaLabel: 'Atalho até ' + hi90 + ' dias: ' + F.plural(n90, unit[0], unit[1]),
  }
  const readingSent = S.reading ? obs.forja.byId[S.reading]?.sent.text ?? null : null

  /* ---------------- summary ("Como contamos") */
  const fmtName = effFmt === 'short' ? 'Shorts' : 'vídeos longos'
  const nicheTxt = effNiche === 'todos' || S.channel ? '' : ' de ' + (effNiche === 'ia' ? 'IA' : 'viagem')
  const chTxt = S.channel ? ' de ' + ch(S.channel)!.name : ''
  const competitors = obs.channels.filter(c => !c.own)
  const selCh = scope ? scope.channels : competitors.filter(c => (effNiche === 'todos' || c.niche === effNiche) && (!S.channel || c.id === S.channel)).map(c => c.id)
  const nCh = selCh.length
  const lims = competitors.map(c => c.video_limit)
  const limTxt = (lims.length ? Math.min(...lims) : 0) + ' a ' + (lims.length ? Math.max(...lims) : 0)
  const tf = [S.theme ? 'tema “' + obs.theme(S.theme)!.label + '”' : '', S.formula ? 'fórmula “' + obs.formula(S.formula)!.label + '”' : ''].filter(Boolean).join(' e ')
  const tfBase = tf ? q({ theme: null, formula: null }) : null
  const W = R.weakShown
  const outsInList = nm ? q({ min: RULES.outlierMin }).count : 0
  const noBase = nm ? R.noBase : 0
  const where = scope ? 'no escopo da leitura' : ages2label(obs, effAges)
  const flat = S.sort !== 'mult' || nm
  const order = !Rw.countWithWeak ? '' : flat ? (S.sort === 'vpd' ? 'ordenados por views/dia, canais atrasados no fim' : S.sort === 'recent' ? 'do mais recente ao mais antigo' : '') : 'agrupados por fase'
  const baseParts: Rich = nm
    ? [{ b: String(R.count) }, (tf && !compact ? ' com ' + tf : '') + ' de ' + R.analyzed + ' ' + fmtName + chTxt + nicheTxt + ' ' + where + ', ' + (outsInList ? outsInList : 'nenhum') + ' com ' + F.mult(RULES.outlierMin) + ' ou mais' + (noBase && !compact ? ', +' + noBase + ' sem nenhum vídeo para comparar' : '')]
    : [{ b: String(R.count) }, { b: ' ' + (R.count === 1 ? 'outlier' : 'outliers') }, (tf ? (compact ? '' : ' com ' + tf) + ' (de ' + tfBase!.count + ' desta janela)' : '') + ' entre ' + R.analyzed + ' ' + fmtName + chTxt + nicheTxt + ' ' + where + (minOn() ? ', com ' + F.mult(S.min) + ' ou mais' : '')]
  baseParts.push((W && !compact ? ', +' + W + ' com base fraca' : '') + (order && !compact ? '; ' + order : '') + '.')
  const basisMore = [
    'Acompanhados em ' + nCh + ' ' + (nCh === 1 ? 'canal' : 'canais') + (R.untracked ? ' (+' + R.untracked + ' fora dos acompanhados: cada canal acompanha só os seus ' + limTxt + ' vídeos mais recentes)' : '') + '. '
      + (compact && (W || noBase) ? (W ? 'Mais ' + W + ' com base fraca. ' : '') + (noBase ? 'Mais ' + noBase + ' sem nenhum vídeo para comparar. ' : '') : '')
      + 'Outlier é o vídeo com ' + F.mult(RULES.outlierMin) + ' ou mais a base: a mediana de views dos outros vídeos do mesmo canal e formato com a mesma idade, sem contar o próprio vídeo.'
      + (W ? ' Os vídeos com base fraca (menos de ' + RULES.weakBase + ' vídeos para comparar) aparecem em cinza tracejado, fora da contagem.' : ''),
    'Publicados desde ' + obs.SERIES_START_LABEL + ' são comparados no mesmo dia de vida quando há ' + RULES.weakBase + ' ou mais vídeos para comparar; senão, e para os mais antigos, vale a aproximação por faixa (' + obs.AGE_BANDS.map(b => b.label.replace(' dias', '').replace('mais de 365', '365+')).join(', ') + ' dias). Views/dia: últimos 7 dias; vídeos com menos de 7 dias mostram a média desde a publicação.',
  ]

  /* ---------------- channels with a sync problem (probs) */
  const probCh = selCh.map(id => ch(id)).filter((c): c is ObsChannel => !!c && !!c.sync.problemPhrase)
  let problems: OutliersView['problems'] = null
  if (probCh.length) {
    const shownC = S.channel || probCh.length === 1 ? probCh : probCh.filter(c => c.sync.state === 'erro')
    const restC = probCh.filter(c => !shownC.includes(c))
    const named = (c: ObsChannel) => ({ name: c.name, phrase: c.sync.problemPhrase! })
    const joinE = (a: string[]) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1])
    problems = {
      shown: shownC.map(named), tail: probCh.length === 1 ? 'Outliers dele podem faltar.' : 'Outliers deles podem faltar.', rest: restC.map(named),
      restLabel: restC.length ? (shownC.length ? '+' : '') + (shownC.length || compact ? F.plural(restC.length, 'canal', 'canais') + ' com problema' : joinE(restC.map(c => c.name)) + ' com problema de sincronização') : '',
      hideLabel: 'Ocultar ' + F.plural(restC.length, 'canal', 'canais'),
    }
  }

  /* ---------------- chips */
  const chips: OutlierChipView[] = []
  const unlinkHref = (k: 'theme' | 'formula' | 'channel' | 'min') => hrefOf({ [k]: null, limit: PAGE } as Nav)
  if (scope && S.reading) {
    const r = obs.forja.byId[S.reading]
    // outliers.html readChip: the reading's own scope ("A leitura de 20/10 (6 meses, 7 canais)") and what it saw then vs now
    const N = scope.nThen
    const viaText = r && scope.text ? cap(scope.text.replace(/ via \d+$/, '')) + (r.type === 'temas' ? ' · temas' : ' · padrões') + ': '
      + (N ? 'via ' + F.plural(N, unit[0], unit[1]) : 'não via nenhum ' + unit[0]) + '; hoje, no mesmo escopo, ' + (R.count === 1 ? 'é' : 'são') : null
    const note = viaText ?? asofNoteOf(r ? D.dm(r.generatedAt) : (get('asof') ?? '').split('-').reverse().slice(0, 2).join('/'), N, R.count)
    chips.push({ key: 'reading', kind: 'asof', label: note, ...(viaText ? { strong: String(R.count) } : {}), invalid: false, removeHref: hrefOf({ reading: null }), removeLabel: 'Tirar a referência à leitura', title: readingSent ?? undefined })
  }
  if (S.asofPick) {
    const pick = S.asofPick
    chips.push({
      key: 'asof', kind: 'pick', invalid: false, label: 'A data ' + pick.af.split('-').reverse().slice(0, 2).join('/') + ' tem ' + pick.ids.length + ' leituras; escolha:',
      picks: pick.ids.map(id => { const r = obs.forja.byId[id]!; return { label: NICHE_LABEL[r.niche ?? 'todos'] + ' · ' + (r.type === 'temas' ? 'temas' : 'padrões'), href: hrefOf({ reading: id, asofPick: null }) } }),
      removeHref: hrefOf({ asofPick: null }), removeLabel: 'Ignorar a data da leitura',
    })
  }
  const linkChip = (key: string, label: string, k: 'theme' | 'formula' | 'channel' | 'min') => chips.push({ key, kind: 'link', label, invalid: false, removeHref: unlinkHref(k), removeLabel: 'Remover filtro ' + label })
  if (S.theme) linkChip('topic', 'Tema “' + obs.theme(S.theme)!.label + '”', 'theme')
  if (S.formula) linkChip('formula', 'Fórmula “' + obs.formula(S.formula)!.label + '”', 'formula')
  if (S.channel) linkChip('channel', 'Canal ' + ch(S.channel)!.name, 'channel')
  if (nm) linkChip('min', 'Todos os vídeos', 'min'); else if (minOn()) linkChip('min', F.mult(S.min) + ' ou mais', 'min')
  if (S.own) chips.push({ key: 'channel', kind: 'own', label: 'Seu canal não entra em Outliers:', link: { label: 'veja em Canais', href: obs.link.canais({ channel: S.own }) }, invalid: false, removeHref: hrefOf(), removeLabel: 'Dispensar aviso' })
  if (S.notOut) chips.push({ key: 'reading', kind: 'bad', label: 'A leitura “' + S.notOut.label + '” não é de outliers: mostrando a tela sem ela', invalid: true, removeHref: hrefOf(), removeLabel: 'Dispensar aviso' })
  if (S.asofNone) chips.push({ key: 'asof', kind: 'bad', label: 'Sem leitura de outliers ' + (S.niche === 'todos' ? '' : 'de ' + NICHE_LABEL[S.niche] + ' ') + 'em ' + S.asofNone.split('-').reverse().slice(0, 2).join('/') + ': mostrando os dados de hoje', invalid: true, removeHref: hrefOf(), removeLabel: 'Dispensar aviso da data' })
  for (const b of S.bad) {
    chips.push({
      key: b.key, kind: 'bad', invalid: true, label: cap(BAD_LABEL[b.key] ?? b.key) + ' “' + b.value + '” não ' + (BAD_FEM.includes(b.key) ? 'reconhecida, ignorada' : 'reconhecido, ignorado'),
      removeHref: hrefOf({}, { keepBad: S.bad.filter(x => x !== b) }), removeLabel: 'Dispensar aviso do filtro ' + b.value,
    })
  }
  const linkChips = chips.filter(c => c.kind === 'link').length
  const chipsLead = chips.length || S.from ? (S.from ? (chips.length ? 'Vindo de ' + FROM[S.from] + ':' : 'Vindo de ' + FROM[S.from] + ', sem filtros extras.') : linkChips ? 'Filtros do link:' : null) : null
  const asofChip = chips.find(c => c.kind === 'asof'), asofNote = asofChip ? asofChip.label + (asofChip.strong ? ' ' + asofChip.strong : '') : null

  /* ---------------- groups and cards */
  const itemById = new Map(Rw.items.map(it => [it.id, it]))
  const PH = obs.PHASES
  let left = S.limit
  const ordered = Rw.orderedGroups(S.sort)
  const pageIds = ((): string[] => { let l = S.limit; const ids: string[] = []; for (const g of ordered) { const take = g.ids.slice(0, Math.max(0, l)); ids.push(...take); l -= take.length } return ids })()
  const backQs = '?' + (hrefOf().split('?')[1] ?? '')
  const cardOf = (it: OutlierItem, main: boolean): OutlierCardView => buildCard(obs, it, { main, flat, nm, channelFilter: !!S.channel, pageIds, back: backQs })
  const groups: OutlierGroupView[] = []
  for (const g of ordered) {
    const full = g.ids.map(id => itemById.get(id)!).filter(Boolean)
    const items = full.slice(0, Math.max(0, left)); left -= items.length
    if (!items.length) continue
    const k = g.k as GroupKey
    const phaseCount = (R.byPhase as Record<string, number>)[k]
    const nIn = k === 'above' || k === 'below' || k === 'flat' ? full.filter(it => !it.weak).length : phaseCount ?? 0
    const nW = full.length - nIn
    const label = k === 'above' ? 'Com ' + F.mult(RULES.outlierMin) + ' ou mais (' + nIn + ')' : k === 'below' ? 'Abaixo de ' + F.mult(RULES.outlierMin) + ' (' + nIn + ')' : k === 'flat' ? 'Todos os outliers' : PHASE_TITLE[k as PhaseKey]
    const why = k === 'above' ? 'Os outliers' + (tf ? ' com ' + tf : '') + ': ' + F.mult(RULES.outlierMin) + ' ou mais a mediana do canal.'
      : k === 'below' ? (tf ? 'Têm ' + tf : 'Entram na lista') + ', mas ficam abaixo de ' + F.mult(RULES.outlierMin) + ' a mediana do canal. Sem cor de faixa.'
      : k === 'flat' ? '' : cap(PH.find(x => x.id === k)!.why) + '.'
    const isPhase = k !== 'above' && k !== 'below' && k !== 'flat'
    const withLead = !flat && !nm && items.length > 1 && !NO_LEAD.includes(k)
    groups.push({
      id: k, label, tone: isPhase ? PHASE_TONE[k as PhaseKey] : (k as Tone), why,
      count: isPhase && nIn ? nIn : null, weakCount: nW,
      countText: nW && (nIn || !isPhase) ? '+' + nW + ' com base fraca' : null,
      onlyWeakText: isPhase && !nIn ? 'Só com base fraca (' + nW + ')' : null,
      cards: items.map((it, i) => cardOf(it, withLead && i === 0 && !it.weak)),
      pageNote: items.length < full.length ? 'Mostrando ' + items.length + ' de ' + full.length + ' deste grupo.' : null,
    })
  }
  const total = Rw.countWithWeak, shownN = pageIds.length
  const more = shownN < total ? { href: hrefOf({ limit: S.limit + PAGE }), label: 'Mostrar mais ' + Math.min(PAGE, total - shownN) + ' (de ' + (total - shownN) + ' restantes)', note: 'Mostrando ' + shownN + ' de ' + total + '.' } : null

  /* ---------------- empty state */
  const empty = Rw.countWithWeak ? null : buildEmpty()
  function buildEmpty(): NonNullable<OutliersView['empty']> {
    const actions: OutlierEmptyAction[] = []
    const add = (label: string, href: string, n: number, primary = false, dest: OutlierEmptyAction['dest'] = 'outliers') => { if (n > 0) actions.push({ label, href, n, primary: primary && !actions.some(a => a.primary), dest }) }
    /** An Outliers destination: the href and its N come from the same navigation, so N is what the destination shows. */
    const go = (label: (n: number) => string, nav: Nav, primary = false) => { const n = countAt(nav); add(label(n), hrefOf(nav), n, primary) }
    const nicheName = effNiche === 'todos' ? '' : ' de ' + (effNiche === 'ia' ? 'IA' : 'viagem')
    const c = S.channel ? ch(S.channel)! : null
    const chTxtE = c ? ' de ' + c.name : ''
    const nLinks = [S.theme, S.formula, S.channel, minOn()].filter(Boolean).length
    const unlinkAll = () => { if (nLinks >= 2) go(n => 'Tirar filtros do link (' + n + ')', { theme: null, formula: null, channel: null, min: null, limit: PAGE }) }
    const otherFmt: Fmt = effFmt === 'short' ? 'long' : 'short'
    const otherFmtBtn = () => go(n => 'Ver ' + (otherFmt === 'short' ? 'Shorts' : 'longos') + ' desta janela (' + n + ')', off({ fmt: otherFmt, ages: effAges }))
    const one = effFmt === 'short' ? 'Short' : 'vídeo longo', many = effFmt === 'short' ? 'Shorts' : 'vídeos longos'
    if (!R.analyzed) {
      if (!S.reading && effAges.length < ALL_AGES.length) go(n => 'Ver todas as idades (' + n + ')', off({ agesAll: true }), true)
      otherFmtBtn(); unlinkAll()
      const text = (R.untracked
        ? (R.untracked === 1 ? 'O único' : 'Os ' + R.untracked) + ' ' + (R.untracked === 1 ? one : many) + ' ' + (c ? 'de ' + c.name + ' ' : 'dos canais' + nicheName + ' ') + ages2label(obs, effAges) + ' ' + (R.untracked === 1 ? 'está' : 'estão') + ' fora dos acompanhados: cada canal acompanha só os seus ' + limTxt + ' vídeos mais recentes.'
        : 'Não há o que comparar nesta janela: nenhum ' + one + ' ' + (c ? 'de ' + c.name : 'dos canais acompanhados') + ' foi publicado nessas idades.')
        + (c && c.sync.problemPhrase ? ' ' + c.name + ' está com problema de sincronização, então pode faltar vídeo; o motivo está no aviso acima.' : '')
      return { title: 'Nenhum ' + one + ' ' + (c ? 'de ' + c.name + ' ' : '') + ages2label(obs, effAges) + ' entre os acompanhados', text, actions }
    }
    if (tf && tfBase && tfBase.count) {
      const un: [string, string] = nm ? ['vídeo', 'vídeos'] : ['outlier', 'outliers']
      const head = tfBase.count === 1 ? 'O único ' + un[0] + chTxtE + ' desta janela não tem ' + tf : 'Nenhum dos ' + tfBase.count + ' ' + un[1] + chTxtE + ' desta janela tem ' + tf
      const both = !!(S.theme && S.formula)
      const lbl = (n: number) => (nm ? (n === 1 ? 'Ver o vídeo' : 'Ver os ' + n + ' vídeos') : n === 1 ? 'Ver o outlier' : 'Ver os ' + n + ' outliers') + ' sem ' + (both ? 'os filtros' : 'o filtro')
      go(lbl, { theme: null, formula: null, limit: PAGE }, true)
      if (!S.reading && effAges.length < ALL_AGES.length) go(n => 'Ver todas as idades (' + n + ')', off({ agesAll: true }))
      return { title: head, text: 'Há ' + un[1] + ' ' + ages2label(obs, effAges) + ' entre os ' + fmtName + (chTxtE || nicheName) + ', mas nenhum com ' + (both ? 'esse tema e essa fórmula' : S.theme ? 'esse tema' : 'esse tipo de título') + '.', actions }
    }
    const idx = effAges.map(a => ALL_AGES.indexOf(a)), lo = Math.min(...idx), hi = Math.max(...idx)
    let below = -1, above = -1
    for (let i = lo - 1; i >= 0; i--) if ((R.byAge[ALL_AGES[i]!] ?? 0) > 0) { below = i; break }
    for (let i = hi + 1; i < ALL_AGES.length; i++) if ((R.byAge[ALL_AGES[i]!] ?? 0) > 0) { above = i; break }
    const nb = (i: number) => go(n => 'Ver ' + obs.OUT_WINDOWS[i]!.label + ' (' + n + ')', off({ ages: [ALL_AGES[i]!] }), i === (below >= 0 ? below : above))
    if (below >= 0) nb(below)
    if (above >= 0) nb(above)
    otherFmtBtn()
    if (effNiche !== 'todos' && !c) go(n => 'Todos os nichos (' + n + ')', { niche: 'todos' })
    if (minOn() && S.min! > RULES.outlierMin) go(n => 'Tirar o mínimo de ' + F.mult(S.min) + ' (' + n + ')', { min: null, limit: PAGE }, true)
    unlinkAll()
    const probs = competitors.filter(x => (effNiche === 'todos' || x.niche === effNiche) && (!c || x.id === c.id) && x.sync.problemPhrase)
    if (probs.length === 1) add('Ver ' + probs[0]!.name + ' em Canais', obs.link.canais({ channel: probs[0]!.id }), 1, false, 'canais')
    else if (probs.length > 1) add('Ver ' + F.plural(probs.length, 'canal', 'canais') + ' com problema', obs.link.canais({ filter: 'problemas', niche: effNiche }), probs.length, false, 'canais')
    const minX = F.mult(S.min != null && S.min > RULES.outlierMin ? S.min : RULES.outlierMin)
    const whereE = scope ? 'no escopo da leitura (' + ((scope.windowDays ?? 0) >= 180 ? '6 meses' : scope.windowDays + ' dias') + ')' : 'nesta janela'
    const what = nm ? (effFmt === 'short' ? 'um Short' : 'um vídeo longo') + (tf ? ' com ' + tf : '') : (effFmt === 'short' ? 'um Short' : 'um vídeo longo') + (tf ? ' com ' + tf : '') + ' com ' + minX + ' ou mais a base'
    const title = c ? c.name + ' não teve ' + what + ' ' + whereE : nCh === 1 ? 'O canal que você monitora' + nicheName + ' não teve ' + what + ' ' + whereE : 'Nenhum dos ' + nCh + ' canais' + nicheName + ' que você monitora teve ' + what + ' ' + whereE
    const probTxt = probs.length ? (c ? ' ' + c.name + ' está com problema de sincronização, então pode faltar vídeo; o motivo está no aviso acima.' : ' ' + F.plural(probs.length, 'canal deste recorte está', 'canais deste recorte estão') + ' com problema de sincronização; o motivo está no aviso acima.') : ''
    const text = 'Foram ' + R.analyzed + ' ' + fmtName + ' ' + (scope ? whereE : ages2label(obs, effAges)) + ' comparados com a base do próprio canal' + (hasLink() ? ', já com os filtros do link' : '') + '. Isso diz que não houve estouro ' + (c ? 'neste canal' : 'entre os canais acompanhados') + ', não que o tema esteja frio no YouTube.' + probTxt
    return { title, text, actions }
  }

  return {
    query: { niche: effNiche, fmt: effFmt, ages: isAll ? 'all' : effAges, min: minOf(), topic: S.theme, formula: S.formula, channel: S.channel, asof: get('asof'), reading: S.reading, sort: S.sort, view: S.view },
    shortcut, timeline,
    allCount: all.count, allHref: scope ? hrefOf() : hrefOf(off({ agesAll: true })), allSelected: scope ? true : isAll,
    allLabel: scope ? 'Leitura' : 'Todos', allTitle: scope ? readingSent : null, allAriaLabel: 'Todas as idades: ' + F.plural(all.count, unit[0], unit[1]),
    fmtLinks: (['long', 'short'] as const).map(v => ({ value: v, label: v === 'long' ? 'Longos' : 'Shorts', href: hrefOf(off({ fmt: v, ages: effAges })), pressed: effFmt === v })),
    viewLinks: (['grid', 'list'] as const).map(v => ({ value: v, label: v === 'grid' ? 'Grade' : 'Lista', href: hrefOf({ view: v }), pressed: S.view === v })),
    sortOptions: (['mult', 'vpd', 'recent'] as const).map(v => ({ value: v, label: SORT_LABEL[v], href: hrefOf({ sort: v, limit: PAGE }) })),
    chipsLead, chips, asofNote,
    baseText: plainOf(baseParts), baseParts, basisMore, nicheNotice,
    problems, groups, more, empty, count: R.count, pageIds,
    ...forjaBarOf(obs, S.channel ? obs.channel(S.channel)?.niche ?? effNiche : effNiche, effFmt),
  }
}

/* ------------------------------------------------------------------ forja bar (outliers.html forjaBar) */
const BUSY_ST = ['na fila', 'trabalhando', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia']
const WARN_ST = ['atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia']
const DEAD_ST = ['falhou', 'recusado (dado velho)']
function forjaBarOf(obs: Observatory, niche: NicheScope, fmt: Fmt): Pick<OutliersView, 'forja' | 'forjaBar'> {
  const F = obs.fmt
  const forja = buildForjaView(obs, { screen: 'outliers', niche, fmt })
  const sc = obs.forja.session.current(forja.niche, { type: forja.type })
  const has = !sc.empty && sc.requests.length > 0
  const rs = forja.niches.filter(b => b.reading).map(b => ({ b, r: b.reading! }))
  if (!rs.length && !has) return { forja, forjaBar: null }
  const capT = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
  const bad = has && sc.terminal && DEAD_ST.includes(sc.state)
  const anyActive = has && sc.requests.some(x => BUSY_ST.includes(x.state))
  const split = has && sc.split && !!sc.statusLines
  const quotaTxt = (): string => {
    const q = sc.quota, by = q.byNiche
    const differs = sc.split && by && Object.values(by).some(x => x && !x.free)
    if (!differs && /cota/i.test(sc.statusText || '')) return ''
    if (sc.split && by) return (Object.keys(by) as Array<'ia' | 'viagem'>).map(n => obs.NICHES[n].label + ': ' + by[n]!.text).join(' · ') + '.'
    return capT(q.text) + '.'
  }
  const sinceBody = (r: ForjaReadingView) => r.since ? r.since.shortText.replace(/^desde então:\s*/i, '') : 'sem comparação com os dados de hoje'
  const pv = forja.niches.filter(b => forja.ask?.niches.includes(b.niche) ?? false)
  const outs = pv.flatMap(b => b.out)
  const win = obs.forja.preview(forja.type, forja.niche, fmt).window
  return {
    forja,
    forjaBar: {
      bad,
      summary: has
        ? { kind: 'request', chip: anyActive && !BUSY_ST.includes(sc.state) ? 'em andamento' : sc.state, chipCls: bad ? 'bad' : WARN_ST.includes(sc.state) ? 'warnst' : '',
          line: split ? sc.statusLines!.join(' · ') : sc.statusText, split, statusText: sc.statusText }
        : { kind: 'readings', when: rs.map(x => x.b.label + ' ' + x.r.when.slice(0, 5)).join(', ') },
      since: { multi: rs.length > 1, items: rs.map(x => ({ id: x.r.id, label: x.b.label, body: sinceBody(x.r) })) },
      req: has ? {
        cls: bad ? 'refused' : 'forja',
        text: (sc.split && sc.state !== 'publicado' ? F.plural(sc.requests.length, 'pedido enviado', 'pedidos enviados') + ' à forja (' + sc.requests.map(x => obs.NICHES[x.niche].label).join(' e ') + '). ' : '') + (bad ? 'A leitura anterior continua valendo. ' : '') + quotaTxt(),
        trackHref: sc.terminal ? null : obs.link.insights(forja.niche === 'todos' ? undefined : { niche: forja.niche }),
      } : null,
      sideBad: has && !sc.terminal ? sc.requests.filter(x => DEAD_ST.includes(x.state)).map(x => obs.NICHES[x.niche].label + ': ' + (x.statusLabel ?? x.state) + '. A leitura anterior de ' + obs.NICHES[x.niche].label + ' continua valendo.') : [],
      rows: rs.map(x => ({ niche: x.b.label, isNew: x.r.isNew, first: x.r.keyItems[0] ?? x.r.lead, reading: x.r, href: obs.link.insights({ niche: x.b.niche }) })),
      // the next request's scope: only free niches (Todos with one busy), never while nothing can be asked
      scope: forja.ask && pv.length ? { text: 'Próximo pedido (últimos ' + (win ?? '6 meses') + '). ' + pv.map(b => (forja.niche === 'todos' ? b.label + ' · ' : '') + obs.forja.preview(forja.type, b.niche, fmt).text).join('; '), outs: outs } : null,
    },
  }
}

/** "Link da leitura de 20/10: ela via N; hoje são M" (CONVENCOES: Outliers asof=). */
function asofNoteOf(dm: string, nThen: number | null, m: number): string {
  return 'Link da leitura de ' + dm + ': ' + (nThen != null ? 'ela via ' + nThen + '; ' : '') + 'hoje ' + (m === 1 ? 'é' : 'são') + ' ' + m
}

/** outliers.html ages2label. */
export function ages2label(obs: Observatory, ages: string[]): string {
  const ALL = obs.OUT_WINDOWS.map(w => w.id)
  const s = [...new Set(ages)].sort((x, y) => ALL.indexOf(x) - ALL.indexOf(y)), a = s.join()
  if (s.length === ALL.length) return 'de qualquer idade'
  if (a === '0-30,31-90') return 'com até 90 dias'
  if (a === '0-30,31-90,91-180') return 'com até 6 meses'
  if (a === '0-30,31-90,91-180,181-365') return 'com até 12 meses'
  if (s.length === 1) { const w = obs.OUT_WINDOWS.find(x => x.id === s[0])!; if (w.hi >= 1e6) return 'com ' + w.label }
  const idx = s.map(x => ALL.indexOf(x))
  if (idx[0]! > 0 && idx[idx.length - 1] === ALL.length - 1 && idx.length === ALL.length - idx[0]!) return 'com mais de ' + obs.OUT_WINDOWS[idx[0]! - 1]!.hi + ' dias'
  return 'com ' + s.map(id => obs.OUT_WINDOWS.find(w => w.id === id)!.label.replace(/ d$/, ' dias')).join(' ou ')
}

/* ------------------------------------------------------------------ card (outliers.html card/multBlock/baseSentence) */
function durOf(d: unknown): string | null {
  if (typeof d === 'string') return d || null
  if (typeof d !== 'number' || !Number.isFinite(d) || d <= 0) return null
  const s = Math.round(d), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60
  const p2 = (n: number) => (n < 10 ? '0' : '') + n
  return h ? h + ':' + p2(m) + ':' + p2(x) : m + ':' + p2(x)
}

function buildCard(obs: Observatory, it: OutlierItem, o: { main: boolean; flat: boolean; nm: boolean; channelFilter: boolean; pageIds: string[]; back: string }): OutlierCardView {
  const F = obs.fmt, D = obs.date, RULES = obs.RULES
  const v = it.video as ObsVideo & { vpd: number | null; vpd7: number | null }, m: MultiplierResult = it.mult, c = obs.channel(v.ch)!
  const stale = c.sync.state === 'atrasado' || c.sync.state === 'erro'
  const partial = c.sync.state === 'backfill'
  const neutral = o.nm && (m.value ?? 0) < RULES.outlierMin
  const short = v.fmt === 'short'
  const lastData = c.lastIdx != null ? D.snapTime(c.lastIdx) : c.sync.last
  // a channel never synced has no last record (Task 20b): say so with a dash, never a made-up date
  const at = (ms: number | null | undefined) => (ms != null ? D.dmhm(ms) : '—')
  const viewsAt = v.viewsAt != null ? D.dmhm(v.viewsAt) : at(lastData)
  const outros = m.n === 1 ? 'do único outro ' + (short ? 'Short' : 'vídeo longo') : 'dos outros ' + m.n + ' ' + (short ? 'Shorts' : 'vídeos longos')
  const sameDay = m.method === 'mesmo dia de vida'
  // card wording from the engine (reference and n note, fmt.plural for the age at the reading)
  const ct = obs.multiplierCard(v.id)
  const ref: Rich = ct.lifeDay != null
    ? ['no ', { abbr: 'dia ' + ct.lifeDay + ' de vida', title: 'dia de vida = dias desde a publicação; compara com os outros vídeos do canal na mesma idade' }]
    : [ct.ref]
  const nTxt = ct.nText
  const multLabel = plainOf([o.nm ? 'a mediana do canal ' : 'vs ' + (short ? 'Shorts' : 'vídeos') + ' do canal ', ...ref, ' ' + nTxt])
  const fb = !m.fallback ? '' : m.dayN === 0 ? 'Nenhum outro ' + (short ? 'Short' : 'vídeo longo') + ' do canal tem série desde o dia 0, então '
    : 'Só ' + m.dayN + ' outro' + (m.dayN === 1 ? '' : 's') + ' ' + (m.dayN === 1 ? (short ? 'Short' : 'vídeo longo') : short ? 'Shorts' : 'vídeos longos') + ' do canal ' + (m.dayN === 1 ? 'tem' : 'têm') + ' série desde o dia 0, então '
  const methodTxt = sameDay ? 'Método: mesmo dia de vida (publicado depois de ' + obs.SERIES_START_LABEL + ', quando a série diária começou).'
    : 'Método: aproximação por faixa. ' + fb + (fb ? 'a' : 'A') + ' comparação é com a faixa de ' + m.band + ' ' + (m.readNote || stale ? 'daquele registro' : 'de hoje') + '; os mais velhos da faixa tiveram mais tempo para acumular views.'
  const bandRef = m.readNote || stale
    ? 'que tinham ' + m.band + ' no ' + (stale ? 'último registro diário do canal,' : 'registro de') + ' ' + (stale ? 'o de ' : '') + at(m.readAt ?? lastData) + (ct.ageAtRead ? ', quando este vídeo tinha ' + ct.ageAtRead : '')
    : 'que hoje têm ' + m.band
  const tip: Rich = sameDay
    ? [{ b: F.mult(m.value) }, ' = ' + F.num(v.views) + ' views de ' + viewsAt + ' (dia ' + m.lifeDay + ' de vida) ÷ ', { b: F.num(m.base ?? null) }, ', ' + (m.n === 1 ? 'as views' : 'a mediana') + ' ' + outros + ' de ' + c.name + ' no mesmo dia de vida, sem contar este vídeo. ' + methodTxt]
    : [{ b: F.mult(m.value) }, ' = ' + F.num(v.views) + ' views de ' + viewsAt + ' ÷ ', { b: F.num(m.base ?? null) }, ', ' + (m.n === 1 ? 'as views' : 'a mediana') + ' ' + outros + ' de ' + c.name + ' ' + bandRef + ', sem contar este vídeo. ' + methodTxt]
  if (m.weak) tip.push(' ', { w: 'Base fraca: com menos de ' + RULES.weakBase + ' vídeos para comparar, um único vídeo distorce a mediana. Por isso ele fica fora da contagem.' })
  if (stale) tip.push(' ', { w: 'Canal com problema de sincronização: ' + (c.sync.problemPhrase ?? '') + '. Views até o registro diário de ' + at(lastData) + '.' })
  const why: Rich | null = o.main
    ? [F.num(v.views) + ' views de ' + viewsAt + ' ÷ ', { b: F.num(m.base ?? null) }, ', ' + (m.n === 1 ? 'views' : 'mediana') + ' ' + outros + ' do canal ', ...ref, (ct.ageAtRead ? ', quando este tinha ' + ct.ageAtRead : '') + ', sem contar este. Método: ' + m.method + (m.fallback ? ' (' + lcfirst(fb.replace(/, então $/, '')) + ')' : '') + '.']
    : null
  const flags: string[] = []
  if (m.weak) flags.push('base fraca')
  if (stale) {
    const ld = at(lastData), ph = c.sync.problemPhrase ?? ''
    flags.push(o.channelFilter ? 'sincronização: ' + (c.sync.label ?? '') : ph + (ph.includes(ld) ? '' : ' · views até o registro diário de ' + ld))
  }
  if (partial && c.sync.backfill) flags.push('base parcial (' + c.sync.backfill.done + ' de ' + c.sync.backfill.total + ')')
  // vpdInfo
  let vpdText: string, vpdTitle: string | null = null, vpdShort: string, vpdShortNote: string | null = null
  if (stale) { vpdText = 'sem views/dia recentes'; vpdShort = vpdText }
  else if (v.vpd7 != null) { vpdText = F.num(v.vpd7) + '/dia'; vpdTitle = 'Views/dia nos últimos 7 dias'; vpdShort = F.num(v.vpd7) }
  else if (v.vpd == null || v.ageDays < 1) { vpdText = 'menos de 1 dia no ar, sem média'; vpdShort = 'menos de 1 dia no ar' }
  else { const d = v.ageDays === 1 ? '1 dia' : v.ageDays + ' dias'; vpdText = F.num(v.vpd) + '/dia, média de ' + d + ' no ar'; vpdTitle = 'Ainda não há 7 dias de série'; vpdShort = F.num(v.vpd); vpdShortNote = 'média de ' + d }
  // reuse note (antigos)
  let reuse: OutlierCardView['reuse'] = null
  if (it.phase.id === 'antigo') {
    const md = obs.channelStats(v.ch, v.fmt).vpd7Median
    reuse = { month: D.dmy(v.pub).slice(3), vpd7: F.num(v.vpd7), median: F.num(typeof md === 'number' ? md : null) }
  }
  const pos = (x: number) => Math.max(0, Math.min(100, Math.log(Math.max(x, 1)) / Math.log(50) * 100))
  const tier = stale || m.weak || neutral ? null : obs.tierOf(m.value)
  const thumbV = v.thumbs.find(t => t.current) ?? v.thumbs[v.thumbs.length - 1]
  const thumb = thumbV?.blobUrl ?? (thumbV?.art ? null : v.ytId ? 'https://i.ytimg.com/vi/' + encodeURIComponent(v.ytId) + '/mqdefault.jpg' : null)
  const phaseId = it.phase.id as PhaseKey
  return {
    id: v.id, main: o.main, title: v.title, channel: c.name, channelFull: c.fullName || c.name,
    niche: v.niche, nicheLabel: v.niche ? obs.NICHES[v.niche].label : null,
    age: F.age(v), ageShort: F.age(v).replace('há ', ''), ageTitle: 'Publicado em ' + D.dmy(v.pub) + ' às ' + D.hm(v.pub) + ' · dia ' + v.ageDays + ' de vida',
    mult: F.mult(m.value), multLabel, method: m.method ?? '', tier, weak: it.weak, stale, neutral,
    views: F.num(v.views), vpd7: v.vpd7 != null ? F.num(v.vpd7) : null, vpdText, vpdTitle, vpdShort, vpdShortNote,
    historyHref: obs.link.historico(v.id, { from: 'outliers', ids: o.pageIds, back: o.back }), url: v.url,
    thumb, art: thumbV?.art ?? null, dur: durOf(v.dur),
    tip, why, flags,
    phase: { id: phaseId, label: cap(it.phase.label), tone: PHASE_TONE[phaseId] }, showPhase: o.flat,
    phaseWhy: o.flat && NO_LEAD.includes(phaseId) ? cap(it.phase.why) + '.' : null,
    reuse,
    ruler: { pos: pos(m.value ?? 1), from: pos(RULES.outlierMin), ticks: [pos(RULES.outlierMin), pos(RULES.tiers.high), pos(RULES.tiers.top)], legend: [RULES.tiers.mid + '×', RULES.tiers.high + '×', RULES.tiers.top + '×'], tone: tier ?? 'muted' },
  }
}
