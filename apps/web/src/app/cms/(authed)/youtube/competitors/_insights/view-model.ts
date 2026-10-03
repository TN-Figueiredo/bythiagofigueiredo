/**
 * Insights view model (port of insights.html render*): every number and text the screen shows comes from here, computed
 * by the engine (patternsNow, cadence, heatmap, themeTrend, nicheStats, ownCoverage, RULES). The components only lay it
 * out. The frozen-reading hero, "Desde então" and the forja button arrive in Task 35 (`reading: null`).
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import type { NicheScope } from '@/lib/youtube/observatorio/niche'
import type { Fmt as VideoFmt, Niche } from '@/lib/youtube/observatorio/types'

/** Rich text: plain strings, bold and monospace numbers (the mockup's <b> and <span class="mono">). */
export type RichPart = string | { b: string } | { mono: string } | { bmono: string }
export type Rich = RichPart[]

export interface LinkOrText { href: string | null; text: string; n: number }
export interface EmptyBlock { title: string; text: string; link?: { href: string; text: string } }

export interface FormulaRow {
  id: string; label: string
  verdict: 'padrao' | 'recorrencia' | 'sem-diferenca'
  /** The engine's verdict sentence, verbatim ("…: recorrência observada (n = 7) — pouco para concluir"). */
  verdictText: string
  chip: { kind: 'ok' | 'weak' | 'neg'; text: string; title: string | null }
  sentence: Rich; example: string | null; link: LinkOrText
  bars: Array<{ kind: 'a' | 'b'; label: string; width: string; value: string }>
}
export interface FormulasSection { meta: string; rows: FormulaRow[]; zero: { ids: string[]; text: string } | null; empty: EmptyBlock | null; foot: Rich }

export interface CadTick { left: string; height: number; tier: string | null; title: string }
export interface CadHatch { kind: 'part' | 'sync' | 'parado'; left: string | null; width: string; title: string; text: string; short: string | null }
export interface CadRow {
  id: string; name: string; fullName: string; ini: string; color: string; aria: string
  syncOff: boolean; warn: string | null; none: string | null; noneSub: string | null
  pace: string | null; partial: boolean; habit: string | null; costuma: boolean
  outLink: LinkOrText | null; ticks: CadTick[]; hatches: CadHatch[]
  last: { kind: 'none' | 'parado' | 'age'; text: string; title: string | null; warn: boolean; srNote: string | null }
}
export interface CadenceSection {
  meta: string; legend: Array<{ color: string; text: string }>; axis: Array<{ left: string; text: string }>
  rows: CadRow[]; empty: string | null; foot: string
}

export interface HeatCellView { cls: string; bg: string | null; text: string; title: string; peak: boolean }
export interface HeatMode {
  intro: string; aria: string; note: Rich; cells: HeatCellView[][]
  table: string[][]; caption: string; scale: Array<{ cls: string; bg: string | null; text: string; mono?: boolean; hidden?: boolean }>
}
export interface HeatmapSection {
  meta: string; days: string[]; hourLabels: string[]; blocks: string[]
  uploads: HeatMode; mult: HeatMode; excluded: string | null; empty: string | null
}

export interface ThemeRow {
  theme: string; label: string
  /** null when the theme coverage cannot support a trend (ruling R49): no ▲/▼ and no spark. */
  trend: string | null; trendText: Rich | null; trendCls: 'up' | 'down' | 'flat'
  channels: { text: string; weak: boolean }; median: Rich | null; outLink: LinkOrText
  spark: { prev: number; now: number; aria: string; text: string } | null
}
export interface ThemesSection { meta: string; seal: string | null; coverageNote: string | null; rows: ThemeRow[]; empty: EmptyBlock | null; foot: string | null }

export interface YouRow {
  key: string; label: string; value: string; few: boolean; fewText: string | null
  scale: { aria: string; niche: string; me: string; lo: string; hi: string }
  median: string; verdict: { cls: 'up' | 'down' | 'flat'; text: string }
}
export interface YouSection {
  meta: string; empty: EmptyBlock | null
  head: { ini: string; title: string; sub: string } | null
  rows: YouRow[]; foot: string | null
}

export interface GapRow { theme: string; label: string; sub: Rich }
export interface GapsSection { meta: string; empty: EmptyBlock | null; rows: GapRow[]; none: string | null; foot: string | null }

export interface InsightsView {
  niche: NicheScope; fmt: VideoFmt
  window: { label: string; dates: string; title: string }
  fmtOptions: Array<{ key: VideoFmt; label: string; pressed: boolean }>
  /** The frozen reading hero (Task 35). */
  reading: null
  /** Todos: Insights compares inside one niche. */
  all: { title: string; text: string; go: Array<{ niche: Niche; label: string; href: string }> } | null
  formulas: FormulasSection | null; cadence: CadenceSection | null; heatmap: HeatmapSection | null
  themes: ThemesSection | null; youInNiche: YouSection | null; gaps: GapsSection | null
}

const FMT_LABEL: Record<VideoFmt, string> = { long: 'longos', short: 'Shorts' }
const FMT_ONE: Record<VideoFmt, string> = { long: 'longo', short: 'Short' }
/** Display bins of the multiplier heatmap (mockup HEAT_BINS; display only, centred on the channel's normal 1,0×). */
const HEAT_BINS = { low2: 0.7, low1: 0.9, normalHi: 1.1, slightHi: 1.3, high1: 1.5, high2: 2.5 }
const LV_BG: Record<string, string> = { c2: 'var(--cool-2)', c1: 'var(--cool-1)', nz: 'var(--heat-nz)', l1: 'var(--heat-1)', l2: 'var(--heat-2)', l3: 'var(--heat-3)', l4: 'var(--heat-4)' }
const AGES_90 = ['0-30', '31-90'], AGES_6M = ['0-30', '31-90', '91-180']
const DAY = 864e5
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const pctW = (x: number) => (Math.round(x * 10) / 10).toFixed(1) + '%'
const joinAnd = (xs: string[]) => xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1]

/** " Fora da análise: X: buscando vídeos (18 de 50); …" — channels the engine left out (backfill or stale), with the engine's phrase. */
function outOf(obs: Observatory, niche: Niche, staleIds: readonly string[]): string {
  const out = obs.channels.filter(c => !c.own && c.niche === niche && (c.sync.state === 'backfill' || staleIds.includes(c.id)))
  return out.length ? ' Fora da análise: ' + out.map(c => c.name + (c.sync.problemPhrase ? ': ' + c.sync.problemPhrase : '')).join('; ') + '.' : ''
}

export interface InsightsParams { niche: NicheScope; fmt?: string | null }
export function parseFmt(raw: string | null | undefined): VideoFmt { return raw === 'short' ? 'short' : 'long' }

export function buildInsightsView(obs: Observatory, p: InsightsParams): InsightsView {
  const fmt = parseFmt(p.fmt), niche = p.niche, { date: DT } = obs
  const base = {
    niche, fmt, reading: null,
    window: { label: 'Últimos 90 dias', dates: DT.dm(obs.NOW - 90 * DAY) + '–' + DT.dm(obs.NOW), title: 'Janela fixa desta aba' },
    fmtOptions: (['long', 'short'] as const).map(k => ({ key: k, label: k === 'long' ? 'Longos' : 'Shorts', pressed: k === fmt })),
  }
  if (niche === 'todos') {
    return {
      ...base,
      all: {
        title: 'Insights compara dentro de um nicho',
        text: 'Misturar viagem e IA somaria públicos, horários e fórmulas que não têm nada a ver. Escolha um nicho para ver a leitura da forja, as fórmulas e os temas.',
        go: (['viagem', 'ia'] as const).map(n => ({ niche: n, label: 'Ver ' + obs.NICHES[n].label, href: '?niche=' + n + (fmt === 'short' ? '&fmt=short' : '') })),
      },
      formulas: null, cadence: null, heatmap: null, themes: null, youInNiche: null, gaps: null,
    }
  }
  return {
    ...base, all: null,
    formulas: formulasSection(obs, niche, fmt), cadence: cadenceSection(obs, niche, fmt), heatmap: heatmapSection(obs, niche, fmt),
    themes: themesSection(obs, niche, fmt), youInNiche: youSection(obs, niche, fmt), gaps: gapsSection(obs, niche, fmt),
  }
}

/* ------------------------------------------------------------------ fórmulas */
type Pattern = ReturnType<Observatory['patternsNow']>['patterns'][number]

/**
 * The chip of a formula row. "Passa a regra" only when the engine says padrão AND the rule holds (n ≥ minN, Δ ≥ minDiff):
 * the screen never upgrades a verdict.
 */
export function formulaChip(obs: Observatory, p: Pick<Pattern, 'nUse' | 'diff' | 'verdict'>): FormulaRow['chip'] {
  const R = obs.RULES.pattern
  const passes = p.verdict.id === 'padrao' && p.nUse >= R.minN && p.diff != null && p.diff >= R.minDiff
  if (passes) return { kind: 'ok', text: '● passa a regra', title: null }
  if (p.verdict.id === 'recorrencia' || p.nUse < R.minN) return { kind: 'weak', text: '◌ pouco para concluir', title: 'Menos de ' + R.minN + ' vídeos com a fórmula' }
  return { kind: 'neg', text: '≈ diferença abaixo da regra', title: null }
}

function formulasSection(obs: Observatory, niche: Niche, fmt: VideoFmt): FormulasSection {
  const F = obs.fmt, R = obs.RULES, N = obs.patternsNow(niche, fmt)
  const meta = N.nVideos + ' ' + FMT_LABEL[fmt] + ' até ' + obs.date.dm(N.asOf) + ', 6 meses'
  const used = new Set<string>()
  const example = (formula: string) => {
    const t = [...N.base.videos].filter(v => v.formulas.includes(formula)).sort((a, b) => b.mult - a.mult).map(v => v.title).find(x => !used.has(x))
    if (t) used.add(t)
    return t ?? null
  }
  const withUse = N.patterns.filter(p => p.nUse), zero = N.patterns.filter(p => !p.nUse)
  const rows0 = [...withUse].sort((a, b) => (b.diff ?? -9) - (a.diff ?? -9))
  const max = Math.max(...rows0.map(p => Math.max(p.medUse ?? 0, p.medNot ?? 0)), 0.1)
  const rows: FormulaRow[] = rows0.map(p => {
    const q = { niche, fmt, ages: AGES_6M, min: 0, formula: p.formula }, n = obs.outliers(q).count
    const chip = formulaChip(obs, p)
    // the row's verdict always follows the chip, both ways
    const verdict: FormulaRow['verdict'] = chip.kind === 'ok' ? 'padrao' : chip.kind === 'weak' ? 'recorrencia' : 'sem-diferenca'
    const attr = p.attribution ? (p.attribution.textMid || p.attribution.text) : ''
    return {
      id: p.formula, label: obs.formula(p.formula)?.label ?? p.label, verdict, verdictText: p.verdict.text, chip,
      sentence: ['Hoje: mediana ', { bmono: F.mult(p.medUse) }, ' com a fórmula, contra ', { bmono: F.mult(p.medNot) }, ' sem ', { mono: '(n = ' + p.nUse + ' vs ' + p.nNot + ')' }, (attr ? '; ' + attr + '.' : '.')],
      example: example(p.formula),
      link: n ? { href: obs.link.outliers(q), text: F.verVideos(n) + ' com a fórmula', n } : { href: null, text: 'nenhum vídeo com a fórmula hoje', n: 0 },
      bars: [
        { kind: 'a', label: 'com', width: pctW((p.medUse ?? 0) / max * 100), value: F.mult(p.medUse) },
        { kind: 'b', label: 'sem', width: pctW((p.medNot ?? 0) / max * 100), value: F.mult(p.medNot) },
      ],
    }
  })
  const empty: EmptyBlock | null = N.nVideos ? null : {
    title: 'Sem títulos para analisar',
    text: 'Nenhum ' + FMT_ONE[fmt] + ' dos concorrentes de ' + obs.NICHES[niche].label + ' nos últimos 6 meses com views comparáveis. As fórmulas aparecem a partir do primeiro vídeo; uma fórmula só “passa a regra” com ' + R.pattern.minN + ' vídeos ou mais.' + outOf(obs, niche, N.excluded),
  }
  return {
    meta, rows, empty,
    zero: !empty && zero.length ? { ids: zero.map(p => p.formula), text: 'Sem títulos com: ' + zero.map(p => F.lcfirst(p.label)).join(', ') + '.' } : null,
    foot: [{ b: 'Multiplicador' }, ' = views do vídeo ÷ mediana dos ', { b: 'outros' }, ' vídeos do canal (sem contar este). Publicados depois de ' + obs.SERIES_START_LABEL + ' comparam no mesmo dia de vida; quando o canal tem menos de ' + R.weakBase + ' vídeos com série desde o dia 0, cai para a aproximação por faixa de idade, que também vale para os anteriores a ' + obs.SERIES_START_LABEL + '. Base com menos de ' + R.weakBase + ' vídeos fica fora. “Passa a regra” exige ' + R.pattern.minN + ' vídeos com a fórmula e diferença de ' + F.dec1(R.pattern.minDiff) + '× ou mais. A tabela é a análise de hoje (base de ' + obs.date.dm(N.asOf) + '), sem selo da forja. Exemplos: títulos reais do nicho. Associação, não causa.'],
  }
}

/* ------------------------------------------------------------------ cadência */
function cadenceSection(obs: Observatory, niche: Niche, fmt: VideoFmt): CadenceSection {
  const F = obs.fmt, DT = obs.date, R = obs.RULES, W = R.habit.weeks
  const FROM = obs.NOW - 90 * DAY, SPAN = 90 * DAY
  const comps = obs.channels.filter(c => !c.own && c.niche === niche)
  const kind = fmt === 'short' ? 'Short' : 'longo'
  const rows: CadRow[] = comps.map(ch => {
    const cad = obs.cadence(ch.id, fmt)
    const all = obs.videos.filter(v => v.ch === ch.id && v.fmt === fmt).sort((a, b) => b.pub - a.pub)
    const inWin = all.filter(v => v.pub > FROM)
    const sy = ch.sync, syncOff = (sy.state === 'atrasado' || sy.state === 'erro') && sy.last != null && sy.last > FROM
    const warn = syncOff ? (sy.problemPhrase || 'sem sincronização ' + DT.ago(sy.last!)) : null
    const head = { id: ch.id, name: ch.name, fullName: ch.fullName || ch.name, ini: ch.ini, color: ch.color, syncOff, warn }
    if (!all.length) {
      return { ...head, none: 'Nenhum ' + kind + ' acompanhado', noneSub: 'nenhum ' + kind + ' acompanhado', pace: null, partial: false, habit: null, costuma: false, outLink: null, ticks: [], hatches: [],
        last: { kind: 'none', text: '—', title: null, warn: false, srNote: null },
        aria: ch.name + ': nenhum ' + kind + ' acompanhado' + (warn ? ', ' + warn : '') }
    }
    const lastAge = F.age(all[0]!)
    const nOut = obs.outliers({ fmt, channel: ch.id }).count
    const ticks: CadTick[] = inWin.map(v => {
      const m = v.mult && !v.mult.weak ? v.mult.value : null
      const h = m == null ? 8 : Math.round(6 + Math.min(1, Math.log10(1 + m) / 1.1) * 18)
      return { left: pctW((v.pub - FROM) / SPAN * 100), height: h, tier: obs.tierOf(m), title: (!v.mult || v.mult.weak || v.mult.value == null ? 'base fraca' : F.mult(v.mult.value) + ' a mediana') + ' · ' + DT.weekdayShort(v.pub) + ' ' + DT.dm(v.pub) + ' ' + DT.hm(v.pub) }
    })
    const hatches: CadHatch[] = []
    if (cad.partial && cad.fetchedSince != null && cad.fetchedSince > FROM) hatches.push({ kind: 'part', left: '0%', width: pctW((cad.fetchedSince - FROM) / SPAN * 100), title: cad.partialText ?? '', text: 'ainda buscando vídeos', short: null })
    if (syncOff) hatches.push({ kind: 'sync', left: null, width: pctW((obs.NOW - sy.last!) / SPAN * 100), title: 'sem sincronização desde ' + DT.dm(sy.last!) + ' ' + DT.hm(sy.last!), text: 'sem sincronização desde ' + DT.dm(sy.last!), short: '⚠' })
    const parado = ch.activity.state === 'parado' && cad.lastUpload != null
    if (parado) hatches.push({ kind: 'parado', left: null, width: pctW(Math.min(100, (obs.NOW - cad.lastUpload!) / SPAN * 100)), title: 'parado, sem upload ' + lastAge, text: 'parado', short: null })
    const last: CadRow['last'] = parado
      ? { kind: 'parado', text: '⏸ ' + lastAge, title: 'último em ' + DT.dm(cad.lastUpload!), warn: false, srNote: null }
      : { kind: 'age', text: lastAge, warn: syncOff,
        title: 'último upload: ' + DT.weekdayShort(all[0]!.pub) + ' ' + DT.dm(all[0]!.pub) + ' ' + DT.hm(all[0]!.pub) + (syncOff ? ' · sem sincronização desde ' + DT.dm(sy.last!) + ' ' + DT.hm(sy.last!) + ', pode haver upload que ainda não vimos' : ''),
        srNote: syncOff ? ' (sem sincronização recente; pode haver upload não visto)' : null }
    return {
      ...head, none: null, noneSub: null, pace: F.dec1(cad.pw), partial: cad.partial, habit: cad.habit.text, costuma: cad.habit.costuma,
      outLink: nOut ? { href: obs.link.outliers({ fmt, channel: ch.id }), text: (nOut === 1 ? 'Ver o outlier' : 'Ver os ' + nOut + ' outliers') + ' do canal', n: nOut } : { href: null, text: 'nenhum outlier em 90 dias', n: 0 },
      ticks, hatches, last,
      aria: ch.name + ': ' + cad.n + ' uploads em ' + W + ' semanas, ' + cad.habit.text + ', último ' + lastAge + (cad.partial && cad.partialText ? '. ' + cad.partialText : '') + (warn ? ', ' + warn : ''),
    }
  })
  const t = (f: number) => DT.dm(FROM + f * SPAN), T = R.tiers
  return {
    meta: FMT_LABEL[fmt] + ', uploads dos últimos 90 dias; ritmo e hábito em ' + W + ' semanas',
    legend: [
      { color: 'var(--dim)', text: 'upload (altura = views ÷ mediana do canal)' },
      { color: 'var(--tier-mid)', text: '≥ ' + T.mid + '×' }, { color: 'var(--tier-high)', text: '≥ ' + T.high + '×' }, { color: 'var(--tier-top)', text: '≥ ' + T.top + '×' },
    ],
    axis: [{ left: '0', text: t(0) }, { left: '33.33%', text: t(1 / 3) }, { left: '66.66%', text: t(2 / 3) }, { left: '100%', text: 'hoje, ' + DT.weekdayShort(obs.NOW) + ' ' + DT.dm(obs.NOW) }],
    rows,
    empty: !rows.length ? 'Nenhum canal concorrente em ' + obs.NICHES[niche].label + '.'
      : rows.every(r => !r.ticks.length) ? 'Nenhum ' + kind + ' dos concorrentes de ' + obs.NICHES[niche].label + ' nos últimos 90 dias.' + outOf(obs, niche, []) : null,
    foot: '“Costuma” só aparece quando o mesmo dia da semana e hora somam ' + R.habit.minCount + ' vídeos ou mais e ' + F.int(R.habit.minShare * 100) + '% ou mais dos uploads do canal em ' + W + ' semanas. Hachurado no começo = vídeos que ainda não foram buscados; no fim = período sem sincronização do canal.',
  }
}

/* ------------------------------------------------------------------ mapa de calor */
type HM = ReturnType<Observatory['heatmap']>
function viewsLevel(m: number): string {
  const B = HEAT_BINS, r = Math.round(m * 10) / 10
  if (r < B.low2) return 'c2'; if (r < B.low1) return 'c1'; if (r <= B.normalHi) return 'nz'; if (r < B.high1) return 'l1'; if (r < B.high2) return 'l2'; return 'l4'
}
function heatmapSection(obs: Observatory, niche: Niche, fmt: VideoFmt): HeatmapSection {
  const F = obs.fmt, R = obs.RULES, HM: HM = obs.heatmap(niche, fmt), cells = HM.cells
  const days = HM.days.map(cap), blk = (b: number) => HM.blocks[b]!, day = (d: number) => days[d]!
  const name = (id: string) => obs.channel(id)?.name ?? id
  const domNote = (dc: { id: string; n: number } | null, n: number): string => {
    if (!dc || dc.n / n <= R.attribution.solo) return ''
    return dc.n === n ? ' Todos são de ' + name(dc.id) + ': é o hábito de um canal, não do nicho.' : ' ' + dc.n + ' desses ' + n + ' são de ' + name(dc.id) + ', então o horário pode ser só o hábito do canal.'
  }
  type Tie = { d: number; b: number; c: HM['cells'][number][number]; lbl: string }
  const tieNotes = (list: Tie[]) => {
    const parts = list.map(x => { const dc = x.c.dominantChannel; return dc ? x.lbl + ': ' + (dc.n === dc.of ? 'todos' : dc.n + ' de ' + dc.of) + ' de ' + (dc.name || name(dc.id)) : null }).filter((s): s is string => !!s)
    return parts.length ? ' ' + parts.join('; ') + '. Nesses blocos, o horário pode ser só o hábito de um canal, não do nicho.' : ''
  }
  const flat: Tie[] = cells.flatMap((r, d) => r.map((c, b) => ({ d, b, c, lbl: day(d) + ' ' + blk(b) })))
  const caption = (m: string) => m + ' por dia e bloco de 2 horas'
  const excluded = HM.excluded.length ? 'Fora do mapa: ' + HM.excluded.map(e => e.reason).join('; ') + '.' : null
  const nComp = obs.channels.filter(c => !c.own && c.niche === niche).length
  // n = 0 because channels are still fetching is not "nobody published": say so, and show the engine's reasons (excluded)
  const empty = HM.n ? null
    : HM.excluded.length && HM.excluded.length === nComp ? 'O mapa espera os canais de ' + obs.NICHES[niche].label + ': todos ainda estão buscando vídeos.'
    : 'Nenhum ' + FMT_ONE[fmt] + ' dos concorrentes de ' + obs.NICHES[niche].label + ' publicado nos últimos 90 dias.'

  // uploads
  const max = Math.max(1, ...cells.flat().map(c => c.n)), pk = HM.peak
  const lvOf = (n: number) => n ? Math.min(4, 1 + Math.floor(n / max * 3.99)) : 0
  const ties = pk ? flat.filter(x => x.c.n === pk.n && x.c.n > 0) : []
  const few = pk && pk.n <= 3 ? ' Pouco para concluir.' : ''
  const upNote: Rich = !pk ? ['Nenhum upload no recorte.']
    : ties.length > 1 ? ['Mais uploads, empate: ', { b: joinAnd(ties.map(x => x.lbl)) }, ', ' + pk.n + ' cada, de ' + HM.n + '.' + few + tieNotes(ties)]
    : ['Mais uploads: ', { b: day(pk.dow) + ' ' + blk(pk.block) }, ', ' + pk.n + ' de ' + HM.n + '.' + few + domNote(pk.dominantChannel, pk.n)]
  const rng = [0, 1, 2, 3, 4].map(lv => {
    if (!lv) return '0'
    const ns: number[] = []; for (let k = 1; k <= max; k++) if (lvOf(k) === lv) ns.push(k)
    return ns.length ? (ns[0] === ns[ns.length - 1] ? String(ns[0]) : ns[0] + '–' + ns[ns.length - 1]) : null
  })
  const uploads: HeatMode = {
    intro: 'Contagem de vídeos publicados em cada bloco.',
    aria: !pk ? 'Uploads por dia e bloco de 2 horas. Nenhum upload.' : 'Uploads por dia e bloco de 2 horas. ' + (ties.length > 1 ? 'Empate no pico: ' + ties.map(x => x.lbl).join(', ') + ', ' + pk.n + ' uploads cada' : 'Pico ' + day(pk.dow) + ' ' + blk(pk.block) + ', ' + pk.n + ' uploads') + '.',
    note: upNote,
    cells: cells.map((r, d) => r.map((c, b) => {
      const lv = lvOf(c.n)
      return { cls: lv ? 'l' + lv : 'z', bg: 'var(--heat-' + lv + ')', text: c.n ? String(c.n) : '', title: day(d) + ' ' + blk(b) + ': ' + F.plural(c.n, 'upload', 'uploads'), peak: ties.some(x => x.d === d && x.b === b) }
    })),
    table: cells.map(r => r.map(c => String(c.n))), caption: caption('Uploads'),
    scale: [
      ...[0, 1, 2, 3, 4].filter(i => rng[i] != null).map(i => ({ cls: i ? '' : 'z', bg: 'var(--heat-' + i + ')', text: rng[i]!, mono: true })),
      { cls: '', bg: null, text: 'uploads por bloco', hidden: true },
      ...(pk ? [{ cls: 'pk', bg: 'var(--heat-0)', text: 'contorno = ' + (ties.length > 1 ? 'pico (empate)' : 'pico') }] : []),
    ],
  }

  // multiplicador mediano
  const bm = HM.bestMult, thin = new Set(HM.thin.map(t => t.dow + '|' + t.block)), r1 = (x: number) => Math.round(x * 10) / 10
  const isThin = (d: number, b: number, c: { medMult: number | null }) => thin.has(d + '|' + b) || c.medMult == null
  const vties = bm && r1(bm.med) > HEAT_BINS.normalHi ? flat.filter(x => x.c.n && !thin.has(x.d + '|' + x.b) && x.c.medMult != null && r1(x.c.medMult) === r1(bm.med)) : []
  const nThin = HM.thin.filter(t => cells[t.dow]![t.block]!.n > 0).length
  const thinTail = ' ' + nThin + ' blocos com uploads têm menos de ' + R.weakBase + ' vídeos com base e ficam hachurados.'
  let mNote: Rich, mAria: string
  if (bm && r1(bm.med) <= HEAT_BINS.normalHi) {
    mNote = ['Nenhum bloco sai do normal (' + F.dec1(HEAT_BINS.low1) + '–' + F.dec1(HEAT_BINS.normalHi) + '×); o maior é ', { b: day(bm.dow) + ' ' + blk(bm.block) + ', ' + F.mult(bm.med) }, ' (n = ' + bm.n + ' com base de comparação).' + thinTail]
    mAria = 'Multiplicador mediano por bloco; nenhum bloco sai do normal.'
  } else if (bm && vties.length > 1) {
    mNote = ['Maior mediana, empate em ' + F.mult(bm.med) + ': ', { b: joinAnd(vties.map(x => x.lbl)) }, ' (n = ' + vties.map(x => x.c.nMult).join(', ') + ' com base de comparação)' + (vties.some(x => x.c.nMult <= 3) ? '; pouco para concluir' : '') + '.' + tieNotes(vties) + thinTail]
    mAria = 'Multiplicador mediano por bloco; empate no maior, ' + F.mult(bm.med) + '.'
  } else if (bm) {
    const slight = r1(bm.med) > HEAT_BINS.normalHi && r1(bm.med) < HEAT_BINS.slightHi
    mNote = ['Maior mediana entre os blocos com dado suficiente: ', { b: day(bm.dow) + ' ' + blk(bm.block) + ', ' + F.mult(bm.med) }, ' (n = ' + bm.n + ' com base de comparação' + (bm.n <= 3 ? ', pouco para concluir' : '') + ')' + (slight ? ', pouco acima do normal' : '') + '.' + domNote(bm.dominantChannel, bm.n) + thinTail]
    mAria = 'Multiplicador mediano por bloco; 1,0× é o normal. Maior: ' + day(bm.dow) + ' ' + blk(bm.block) + ', ' + F.mult(bm.med) + ', n = ' + bm.n + '.'
  } else {
    const t = 'Nenhum bloco tem vídeos suficientes com base de comparação, então não dá para apontar um horário melhor.'
    mNote = [t]; mAria = t
  }
  const B = HEAT_BINS, dd = (x: number) => F.dec1(r1(x)), st = 0.1
  const lab: Record<string, string> = { c2: '≤' + dd(B.low2 - st) + '×', c1: dd(B.low2) + '–' + dd(B.low1 - st) + '×', nz: dd(B.low1) + '–' + dd(B.normalHi) + '× normal', l1: dd(B.normalHi + st) + '–' + dd(B.high1 - st) + '×', l2: dd(B.high1) + '–' + dd(B.high2 - st) + '×', l4: '≥' + dd(B.high2) + '×' }
  const mult: HeatMode = {
    intro: 'Mediana do multiplicador dos vídeos de cada bloco. Escala centrada no normal do canal (1,0×): azul abaixo, cores quentes acima. Menos de ' + R.weakBase + ' vídeos com base = hachurado; sem uploads = vazio.',
    aria: mAria, note: mNote,
    cells: cells.map((r, d) => r.map((c, b) => {
      if (!c.n) return { cls: 'z', bg: null, text: '', title: day(d) + ' ' + blk(b) + ': sem uploads', peak: false }
      if (isThin(d, b, c)) return { cls: 'thin', bg: null, text: '', title: day(d) + ' ' + blk(b) + ': ' + F.plural(c.nMult, 'vídeo', 'vídeos') + ' com base, pouco para mediana', peak: false }
      const lv = viewsLevel(c.medMult!)
      return { cls: lv, bg: LV_BG[lv]!, text: F.dec1(c.medMult!), title: day(d) + ' ' + blk(b) + ': mediana ' + F.mult(c.medMult) + ' (n = ' + c.nMult + ')', peak: vties.some(x => x.d === d && x.b === b) }
    })),
    table: cells.map((r, d) => r.map((c, b) => !c.n ? 'sem uploads' : isThin(d, b, c) ? 'pouco dado' : F.mult(c.medMult))), caption: caption('Multiplicador mediano'),
    scale: [
      ...['c2', 'c1', 'nz', 'l1', 'l2', 'l4'].map(l => ({ cls: '', bg: LV_BG[l]!, text: lab[l]!, mono: true })),
      { cls: 'thin', bg: null, text: 'menos de ' + R.weakBase + ' com base' }, { cls: 'z', bg: null, text: 'sem uploads' },
      ...(bm && r1(bm.med) > HEAT_BINS.normalHi ? [{ cls: 'pk', bg: 'var(--heat-nz)', text: 'contorno = maior mediana' }] : []),
    ],
  }
  return {
    meta: FMT_LABEL[fmt] + ' dos últimos ' + (HM.window || '90 dias') + ', blocos de 2 h',
    days, blocks: HM.blocks.slice(), hourLabels: HM.blocks.map((b, i) => (i % 2 ? '' : b.slice(0, 2))),
    uploads, mult, excluded, empty,
  }
}

/* ------------------------------------------------------------------ temas */
function medRich(obs: Observatory, m: number | null, n: number): Rich {
  return n >= obs.RULES.medianMinN ? ['mediana ', { mono: obs.fmt.mult(m) }, ' (n = ' + n + ')'] : ['pouco para concluir (n = ' + n + ')']
}
function themesSection(obs: Observatory, niche: Niche, fmt: VideoFmt): ThemesSection {
  const F = obs.fmt, R = obs.RULES, NL = obs.NICHES[niche].label
  const meta = FMT_LABEL[fmt] + ' de ' + NL + ', 90 dias vs os 90 anteriores'
  const reading = obs.forja.latest('temas', niche)
  if (!reading) {
    return { meta, seal: null, coverageNote: null, rows: [], foot: null, empty: {
      title: 'Ainda não há temas de ' + NL,
      text: 'Os temas saem da leitura de temas da forja, que dá nome aos grupos de vídeos parecidos. Sem essa leitura não há tema para contar; a tendência aparece aqui depois da primeira.',
    } }
  }
  // the model comes from the reading itself (DB column `model`, or the reading's own seal); never assumed
  const fromSeal = reading.seal.startsWith('forja · ') ? reading.seal.split(' · ')[1] : undefined
  const model = reading.model || fromSeal || 'modelo não registrado'
  const when = obs.date.dm(reading.generatedAt) + ' ' + obs.date.hm(reading.generatedAt) + ' (SP)'
  const seal = 'forja · ' + model + ' · gerada ' + when
  const TT = obs.themeTrend(niche, fmt), cv = TT.coverage, trendable = cv.trendable
  const list = TT.filter(t => t.now + t.prev > 0).sort((a, b) => (b.now - b.prev) - (a.now - a.prev))
  const mx = Math.max(1, ...list.flatMap(x => [x.now, x.prev]))
  const rows: ThemeRow[] = list.map(x => {
    const nc = x.channels.length
    const trendText: Rich | null = !trendable ? null : x.trend === '▲' ? ['▲ ' + x.trendText + ' · +' + x.delta] : x.trend === '▼' ? ['▼ ' + x.trendText + ' · ' + F.int(x.delta).replace('-', '−')] : ['≈ ' + (x.trendText || 'estável')]
    const q = { niche, fmt, ages: AGES_90, topic: x.theme }
    return {
      theme: x.theme, label: x.label, trend: trendable ? x.trend : null, trendText, trendCls: !trendable ? 'flat' : x.trend === '▲' ? 'up' : x.trend === '▼' ? 'down' : 'flat',
      channels: nc <= 2 && x.now > 0 ? { text: '◌ só ' + F.plural(nc, 'canal', 'canais'), weak: true } : { text: F.plural(nc, 'canal', 'canais'), weak: false },
      median: x.nMult ? medRich(obs, x.medMult, x.nMult) : null,
      outLink: x.outliers ? { href: obs.link.outliers(q), text: (x.outliers === 1 ? 'Ver o outlier' : 'Ver os ' + x.outliers + ' outliers') + ' de hoje', n: x.outliers } : { href: null, text: 'nenhum outlier hoje', n: 0 },
      spark: !trendable ? null : { prev: Math.max(3, x.prev / mx * 28), now: Math.max(3, x.now / mx * 28), aria: x.prev + ' vídeos nos 90 dias anteriores, ' + x.now + ' agora', text: x.prev + ' → ' + x.now },
    }
  })
  const exc = TT.excluded
  return {
    meta, seal, rows,
    // ruling R49: the forja named too few videos (or none in the previous 90 days) for ▲/▼ to mean anything
    coverageNote: trendable ? null : 'A forja ainda não deu tema a vídeos suficientes para comparar com os 90 dias anteriores: tem tema em ' + cv.now.themed + ' de ' + cv.now.total + ' ' + FMT_LABEL[fmt] + ' dos últimos 90 dias e em ' + cv.prev.themed + ' de ' + cv.prev.total + ' dos 90 anteriores (a tendência pede ' + F.int(cv.minShare * 100) + '% em cada janela).',
    empty: rows.length ? null : { title: 'Nenhum tema no recorte', text: 'Nenhum ' + FMT_ONE[fmt] + ' dos concorrentes de ' + NL + ' com tema nos últimos 180 dias.' },
    foot: 'Compara ' + F.plural(TT.channelsCompared.length, 'canal', 'canais') + ' com vídeos nas duas janelas.' + (exc.length ? ' Fora da comparação: ' + exc.map(e => e.reason).join('; ') + '.' : '') + (trendable ? ' Tendência: ' + R.theme.trend.text + '.' : '') + ' Os nomes dos grupos vêm da leitura de temas da forja de ' + when + '; contagens, canais, medianas e outliers vêm dos dados de hoje.' + (trendable ? ' Barra forte = agora, apagada = 90 dias anteriores.' : ''),
  }
}

/* ------------------------------------------------------------------ você no nicho */
/** The own channel compared with this niche: derived by the engine; a channel with a niche set elsewhere is not compared. */
function ownFor(obs: Observatory, niche: Niche) {
  const NS = obs.nicheStats(niche, 'long')
  const own = NS.own ? obs.channel(NS.own.channel) : undefined
  return own && (own.niche == null || own.niche === niche) ? own : null
}
function youSection(obs: Observatory, niche: Niche, fmt: VideoFmt): YouSection {
  const F = obs.fmt, R = obs.RULES, W = R.habit.weeks, NL = obs.NICHES[niche].label
  const anyOwn = obs.channels.find(c => c.own)
  const own = ownFor(obs, niche)
  const meta = (own ?? anyOwn)?.name ? (own ?? anyOwn)!.name + ', mesmo formato' : 'mesmo formato'
  const emptyText = 'Sem vídeos seus no recorte não há o que comparar. A comparação aparece a partir do primeiro vídeo; com menos de ' + R.pattern.minN + ', ela vem marcada “pouco para concluir”.'
  if (!anyOwn) return { meta, head: null, rows: [], foot: null, empty: { title: 'Nenhum canal seu conectado', text: 'Sem um canal seu no Observatório não há o que comparar com o nicho.' } }
  const cad = own ? obs.cadence(own.id, fmt) : null
  // No vsYou against a channel with 0 videos (spec D6): the honest empty state.
  if (!own || !cad || !cad.n) {
    const what = !own ? 'vídeos de ' + NL : FMT_LABEL[fmt] + ' nas últimas ' + W + ' semanas'
    return { meta, head: null, rows: [], foot: null, empty: { title: 'Seu canal ainda não tem ' + what, text: emptyText, link: { href: obs.link.canais({ channel: (own ?? anyOwn).id }), text: 'Ver seu canal' } } }
  }
  const NS = obs.nicheStats(niche, fmt, own.id), o = NS.own
  if (!o) return { meta, head: null, rows: [], foot: null, empty: { title: 'Seu canal ainda não tem vídeos de ' + NL, text: emptyText } }
  // channelStats is typed loosely by the engine: read the one field needed, narrowly
  const eng = obs.channelStats(own.id, fmt).engagement
  const engWindow = eng && typeof eng === 'object' && 'window' in eng && typeof eng.window === 'string' ? eng.window : null
  const pct = (x: number | null) => x == null ? '—' : F.dec1(x * 100) + '%'
  const row = (key: 'pw' | 'perMilSubs' | 'pctOutliers' | 'engagement', label: string, fmtV: (v: number | null) => string, labelOverride?: string): YouRow | null => {
    const me = o[key].value, agg = NS[key]
    if (me == null || agg.median == null || agg.min == null || agg.max == null) return null
    const lo = Math.min(agg.min, me), hi = Math.max(agg.max, me), span = hi - lo || 1
    const p = (v: number) => ((v - lo) / span * 100).toFixed(1) + '%'
    const ov = o[key], cls = ov.verdict === '▲' ? 'up' : ov.verdict === '▼' ? 'down' : 'flat'
    const vtxt = ov.verdict ? ov.verdict + ' ' + (labelOverride ?? ov.label ?? ov.verdictText) : '≈ ' + (ov.verdictText || 'igual à mediana do nicho')
    return {
      key, label, value: fmtV(me), few: ov.few, fewText: ov.few ? 'n = ' + ov.n + ', pouco para concluir' : null,
      scale: { aria: 'Você ' + fmtV(me) + '; mediana do nicho ' + fmtV(agg.median) + '; de ' + fmtV(lo) + ' a ' + fmtV(hi) + '. ' + ov.verdictText, niche: p(agg.median), me: p(me), lo: fmtV(lo), hi: fmtV(hi) },
      median: fmtV(agg.median), verdict: { cls, text: vtxt },
    }
  }
  const dec = (v: number | null) => v == null ? '—' : F.dec1(v)
  const rows = [
    row('pw', 'Ritmo (vídeos por semana)', dec),
    row('perMilSubs', 'Views/dia por mil inscritos (mediana desde ' + obs.SERIES_START_LABEL + ')', dec),
    row('pctOutliers', 'Vídeos com ' + R.outlierMin + '× ou mais (90 d)', pct, pct(o.pctOutliers.value) + ' vs ' + pct(NS.pctOutliers.median) + ' da mediana do nicho'),
    row('engagement', 'Curtidas + comentários / views' + (engWindow ? ' (' + engWindow + ')' : ''), pct),
  ].filter((r): r is YouRow => r != null)
  const biggest = obs.channels.filter(c => !c.own && c.niche === niche).sort((a, b) => b.subs - a.subs)[0]
  return {
    meta, empty: null, rows,
    head: { ini: own.ini, title: F.plural(cad.n, 'vídeo seu', 'vídeos seus') + ' (' + FMT_LABEL[fmt] + ', ' + W + ' semanas)', sub: F.subs(own.subs) + ' inscritos · ' + obs.syncText(own.id) },
    foot: 'Ponto laranja = você; traço = mediana dos ' + NS.channels.length + ' canais concorrentes do nicho; extremos rotulados; ▲/▼ só fora de ±' + F.int(o.threshold * 100) + '%; com menos de ' + o.fewN + ' vídeos, “pouco para concluir”. Só métricas relativas' + (biggest ? ': ' + biggest.name + ' tem ' + F.subs(biggest.subs) + ' inscritos; você, ' + F.subs(own.subs) + '.' : '.'),
  }
}

/* ------------------------------------------------------------------ lacunas */
function gapsSection(obs: Observatory, niche: Niche, fmt: VideoFmt): GapsSection {
  const F = obs.fmt, NL = obs.NICHES[niche].label
  const meta = 'temas dos concorrentes sem vídeo seu'
  const own = ownFor(obs, niche)
  const cov = own ? obs.ownCoverage(fmt, own.id) : null
  if (!cov || !cov.n) {
    return { meta, rows: [], none: null, foot: null, empty: { title: 'Sem ' + FMT_LABEL[fmt] + ' seus de ' + NL + ' para comparar', text: 'Lacunas cruzam os temas dos seus vídeos com os dos concorrentes. Sem vídeo seu no recorte, todo tema deles viraria lacuna, e a lista não diria nada.' } }
  }
  if (!obs.forja.latest('temas', niche)) {
    return { meta, rows: [], none: null, foot: null, empty: { title: 'Ainda não há temas de ' + NL, text: 'Lacunas cruzam os temas dos seus vídeos com os dos concorrentes, e os temas saem da leitura de temas da forja. Sem essa leitura não há lacuna para mostrar.' } }
  }
  // ruling R49: with no theme on the own videos, every competitor theme would look like a gap
  if (!cov.themed) {
    return { meta, rows: [], none: null, foot: null, empty: { title: 'A forja ainda não deu tema aos seus vídeos', text: 'Lacunas cruzam os temas dos seus vídeos com os dos concorrentes. Nenhum dos seus ' + F.plural(cov.n, FMT_ONE[fmt], FMT_LABEL[fmt]) + ' dos últimos ' + cov.window + ' tem tema, então não dá para dizer qual tema falta.' } }
  }
  const trend = obs.themeTrend(niche, fmt), ccv = trend.coverage.now
  if (!ccv.total || ccv.themed / ccv.total < obs.RULES.theme.coverage.minShare) {
    return { meta, rows: [], none: null, foot: null, empty: { title: 'A forja ainda não deu tema a vídeos suficientes dos concorrentes', text: 'Tem tema em ' + ccv.themed + ' de ' + ccv.total + ' ' + FMT_LABEL[fmt] + ' dos concorrentes de ' + NL + ' nos últimos 90 dias; com tão poucos, um tema ausente na lista não quer dizer que ninguém fala dele.' } }
  }
  const qualifying = trend.filter(t => t.channels.length >= 2)
  const gaps = trend.filter(t => !cov.byTheme[t.theme] && t.channels.length >= 2).sort((a, b) => b.now - a.now)
  const single = trend.filter(t => !cov.byTheme[t.theme] && t.now > 0 && t.channels.length < 2).length
  const one = FMT_LABEL[fmt].replace(/s$/, '')
  return {
    meta, empty: null,
    rows: gaps.map(t => ({ theme: t.theme, label: t.label, sub: [{ mono: String(t.channels.length) }, ' canais, ', { mono: String(t.now) }, ' vídeos', ...(t.nMult ? [', ' as RichPart, ...medRich(obs, t.medMult, t.nMult)] : []), ' · você: nenhum'] })),
    none: gaps.length ? null : qualifying.length ? 'Você já tem vídeo em todos os ' + F.plural(qualifying.length, 'tema', 'temas') + ' que aparecem em 2 canais ou mais.' : 'Nenhum tema aparece em 2 canais ou mais nos últimos 90 dias.',
    foot: 'Por tema, não por tag: as tags ficam no idioma de cada canal, e “street food” não casaria com “comida de rua”. Seus ' + F.plural(cov.n, one, FMT_LABEL[fmt]) + ' dos últimos ' + cov.window + ' cobrem ' + F.plural(Object.keys(cov.byTheme).length, 'tema', 'temas') + '.' + (single ? ' Temas de um canal só ficam de fora (' + single + ').' : ''),
  }
}
