// Port of dados.js:787-857 (phases, outliers, tab counts)
import { RULES, OUT_WINDOWS, DEFAULT_AGES, winOf } from './rules'
import { median } from './stats'
import { inNiche, type NicheScope } from './niche'
import { changesIn } from './changes'
import { assertSiteScope, type EngineCtx, type Derived } from './series'
import type { ObsVideo, Fmt } from './types'
import type { MultiplierResult } from './multiplier'
import type { FrozenReading } from './types'
import { readingScope, type ReadingScope } from './forja/scope'

export interface Phase { id: 'estourando' | 'recente' | 'perene' | 'antigo' | 'novos' | 'sem-ritmo'; label: string; why: string; noMedian?: boolean }
type V = ObsVideo & Derived

export const median7 = (ctx: EngineCtx, chId: string, fmtId: Fmt): number | null =>
  median(ctx.CH.get(chId)!.videos.map(v => ctx.V.get(v.id)!).filter(v => v.tracked && v.fmt === fmtId && v.vpd7 != null).map(v => v.vpd7 as number))

export function phaseOf(ctx: EngineCtx, v: ObsVideo, o?: { m7?: number | null }): Phase {
  const { clock, fmt } = ctx
  const ch = ctx.CH.get(v.ch)!, vv = ctx.V.get(v.id) ?? (v as V)
  const m7 = o && 'm7' in o ? o.m7 ?? null : median7(ctx, v.ch, v.fmt)
  if ((ch.sync.state === 'atrasado' || ch.sync.state === 'erro') && ch.sync.last == null) return { id: 'sem-ritmo', label: 'sem ritmo medido', why: 'sincronização ' + (ch.sync.state === 'erro' ? 'com erro' : 'atrasada') + ' e nenhuma sincronização boa: o ritmo não está medido' }
  if (ch.sync.last != null && (ch.sync.state === 'atrasado' || ch.sync.state === 'erro')) return { id: 'sem-ritmo', label: 'sem ritmo medido', why: 'sincronização ' + (ch.sync.state === 'erro' ? 'com erro' : 'atrasada') + ' desde ' + clock.dm(ch.sync.last) + ' ' + clock.hm(ch.sync.last) + ': o ritmo dos últimos 7 dias não está medido' }
  if (ch.sync.state === 'backfill') return { id: 'sem-ritmo', label: 'sem ritmo medido', why: 'canal ainda buscando vídeos: sem série diária' }
  if (vv.vpd7 == null) return { id: 'novos', label: 'Novos', why: 'menos de 7 dias de série' }
  if (m7 == null) {
    if (v.ageDays <= 90) return { id: 'recente', label: 'recentes', why: (v.ageDays <= 30 ? 'até 30 dias' : 'de 31 a 90 dias') + '; sem mediana de views/dia (7 d) no canal para comparar o ritmo', noMedian: true }
    return { id: 'antigo', label: 'antigos', why: 'mais de 90 dias; sem mediana de views/dia (7 d) no canal para comparar o ritmo', noMedian: true }
  }
  if (v.ageDays <= 30 && vv.vpd7 >= 2 * m7) return { id: 'estourando', label: 'estourando agora', why: 'views/dia (7 d) ' + fmt.mult(RULES.outlierMin) + ' ou mais a mediana do canal' }
  if (v.ageDays <= 90) return { id: 'recente', label: 'recentes', why: v.ageDays <= 30 ? 'até 30 dias, mas views/dia (7 d) abaixo de 2× a mediana do canal' : 'de 31 a 90 dias; "estourando agora" só até 30 dias' }
  if (vv.vpd7 >= m7) return { id: 'perene', label: 'perenes', why: 'mais de 90 dias e views/dia (7 d) ainda acima da mediana do canal' }
  return { id: 'antigo', label: 'antigos', why: 'mais de 90 dias e views/dia (7 d) abaixo da mediana do canal' }
}

export function phases(ctx: EngineCtx): Phase[] {
  const mult = ctx.fmt.mult(RULES.outlierMin)
  return [
    { id: 'estourando', label: 'estourando agora', why: 'até 30 dias e views/dia (7 d) ' + mult + ' ou mais a mediana do canal' },
    { id: 'recente', label: 'recentes', why: 'até 90 dias' },
    { id: 'perene', label: 'perenes', why: 'mais de 90 dias e views/dia (7 d) ainda acima da mediana do canal' },
    { id: 'antigo', label: 'antigos', why: 'mais de 90 dias e views/dia (7 d) abaixo da mediana do canal' },
    { id: 'novos', label: 'Novos', why: 'menos de 7 dias de série' },
    { id: 'sem-ritmo', label: 'sem ritmo medido', why: 'canal com sincronização atrasada, com erro ou ainda buscando vídeos' },
  ]
}

export interface OutlierQuery { niche?: NicheScope; fmt?: Fmt; ages?: string[] | 'all'; agesExplicit?: boolean; min?: number; theme?: string | null; topic?: string | null; formula?: string | null; channel?: string | null; channels?: string[] | null; maxAge?: number | null; includeWeak?: boolean; includeOwn?: boolean; reading?: string | null }
export interface OutlierItem { id: string; video: V; mult: MultiplierResult; weak: boolean; phase: Phase; window: string; ageDays: number }
export type OutlierSort = 'mult' | 'vpd' | 'recent'
export interface OutliersResult {
  items: OutlierItem[]; count: number; countWithWeak: number; byAge: Record<string, number>; byPhase: Record<string, number>
  analyzed: number; untracked: number; weakExcluded: number; scope: ReadingScope | null; readingInvalid: boolean
  /** Weak-base videos that pass every filter of the query (theme, formula, channel, min): the dashed cards with includeWeak. */
  weakShown: number
  /** Tracked videos in the window that pass the theme/formula/channel filters but have no base at all (multiplier null). */
  noBase: number
  orderedIds(sort?: OutlierSort): string[]; orderedGroups(sort?: OutlierSort): Array<{ k: string; ids: string[] }>
}

export function outliers(ctx: EngineCtx & { READ?: Record<string, FrozenReading> }, q: OutlierQuery = {}): OutliersResult {
  const defaults = { niche: 'todos' as NicheScope, fmt: 'long' as Fmt, ages: DEFAULT_AGES as string[] | 'all', min: RULES.outlierMin, theme: null as string | null, formula: null as string | null, channel: null as string | null, channels: null as string[] | null, maxAge: null as number | null, includeOwn: false }
  const opts = { ...defaults, ...q }
  if (opts.topic && !opts.theme) opts.theme = opts.topic
  // A reading (reading=<id>) applies its scope: its channels, format and window (dados.js:818).
  let scope: ReadingScope | null = null, readingInvalid = false
  if (opts.reading) {
    scope = ctx.READ ? readingScope({ ...ctx, READ: ctx.READ }, opts.reading, { formula: opts.formula, theme: opts.theme, min: opts.min, channel: opts.channel }) : null
    if (!scope) readingInvalid = true
    else {
      opts.channels = opts.channels || scope.channels; opts.fmt = scope.fmt ?? opts.fmt; opts.niche = scope.niche ?? opts.niche
      if (!opts.agesExplicit) { opts.ages = scope.ages ?? opts.ages; opts.maxAge = scope.windowDays }
    }
  }
  const ages = opts.ages === 'all' ? OUT_WINDOWS.map(w => w.id) : opts.ages
  const videos = ctx.ds.videos as V[]
  const own = (v: ObsVideo) => ctx.CH.get(v.ch)!.own
  const pool = videos.filter(v => v.tracked && v.fmt === opts.fmt && inNiche(opts.niche, v) && (opts.includeOwn || !own(v)) && (!opts.channel || v.ch === opts.channel) && (!opts.channels || opts.channels.includes(v.ch)) && (opts.maxAge == null || v.ageDays <= opts.maxAge))
  const win = (v: ObsVideo) => winOf(v.ageDays)!.id
  const passes = (v: V) => v.mult!.value != null && (!v.mult!.weak || opts.includeWeak) && v.mult!.value >= opts.min && (!opts.theme || v.theme === opts.theme) && (!opts.formula || v.formulas.includes(opts.formula))
  const byAge: Record<string, number> = {}
  OUT_WINDOWS.forEach(w => { byAge[w.id] = pool.filter(v => win(v) === w.id && passes(v) && !v.mult!.weak).length })
  const items: OutlierItem[] = pool.filter(v => ages.includes(win(v)) && passes(v)).map(v => ({ id: v.id, video: v, mult: v.mult!, weak: !!v.mult!.weak, phase: phaseOf(ctx, v), window: win(v), ageDays: v.ageDays }))
    .sort((a, b) => b.mult.value! - a.mult.value!)
  const byPhase: Record<string, number> = {}
  items.forEach(x => { if (!x.weak) byPhase[x.phase.id] = (byPhase[x.phase.id] || 0) + 1 })
  const analyzed = pool.filter(v => ages.includes(win(v))).length
  const untracked = videos.filter(v => !v.tracked && v.fmt === opts.fmt && inNiche(opts.niche, v) && !own(v) && (!opts.channel || v.ch === opts.channel) && ages.includes(win(v))).length
  const weak = pool.filter(v => ages.includes(win(v)) && v.mult!.weak && v.mult!.value != null && v.mult!.value >= opts.min).length
  const tf = (v: V) => (!opts.theme || v.theme === opts.theme) && (!opts.formula || v.formulas.includes(opts.formula))
  const weakShown = pool.filter(v => ages.includes(win(v)) && v.mult!.weak && v.mult!.value != null && v.mult!.value >= opts.min && tf(v)).length
  const noBase = pool.filter(v => ages.includes(win(v)) && v.mult!.value == null && tf(v)).length
  const PH = phases(ctx)
  const vpdKey = (it: OutlierItem) => (['atrasado', 'erro'].includes(ctx.CH.get(it.video.ch)!.sync.state)) ? -2 : ((it.video.vpd7 != null ? it.video.vpd7 : it.video.vpd) != null ? (it.video.vpd7 != null ? it.video.vpd7 : it.video.vpd)! : -1)
  const orderedGroups = (sort: OutlierSort = 'mult') => {
    const its = items.slice()
    if (sort === 'vpd') its.sort((a, b) => vpdKey(b) - vpdKey(a)); else if (sort === 'recent') its.sort((a, b) => b.video.pub - a.video.pub)
    const nm = opts.min != null && opts.min < RULES.outlierMin, flat = sort !== 'mult' || nm
    const g = nm ? [{ k: 'above', items: its.filter(it => it.mult.value! >= RULES.outlierMin) }, { k: 'below', items: its.filter(it => it.mult.value! < RULES.outlierMin) }]
      : flat ? [{ k: 'flat', items: its }] : PH.map(p => ({ k: p.id as string, items: its.filter(it => it.phase.id === p.id) }))
    return g.filter(x => x.items.length).map(x => ({ k: x.k, ids: x.items.map(it => it.id) }))
  }
  const orderedIds = (sort?: OutlierSort) => orderedGroups(sort).flatMap(g => g.ids)
  return { orderedIds, orderedGroups, scope, readingInvalid, items, count: items.filter(x => !x.weak).length, countWithWeak: items.length, byAge, byPhase, analyzed, untracked, weakExcluded: weak, weakShown, noBase }
}

export function tabCounts(ctx: EngineCtx, niche: NicheScope = 'todos'): { canais: number; mud: number; out: number } {
  // the tab strip counts the SITE (channels, trades and outliers of every channel): on one channel's set it would say "Canais 1" and count
  // the trades and outliers of that channel alone, with no error
  assertSiteScope(ctx, 'tabCounts')
  return {
    canais: ctx.ds.channels.filter(c => !c.own && inNiche(niche, c)).length,
    mud: changesIn(ctx, { days: 30, niche }).length,
    out: outliers(ctx, { niche, fmt: 'long', ages: DEFAULT_AGES }).count,
  }
}
export const TAB_TITLES = {
  canais: (n: number) => n + ' canais monitorados',
  mud: (n: number) => n + ' trocas nos últimos 30 dias (título, thumbnail e descrição; longos e Shorts; contadas por evento)',
  out: (n: number) => n + ' vídeos longos de até 90 dias com 2× ou mais a mediana do canal',
}
