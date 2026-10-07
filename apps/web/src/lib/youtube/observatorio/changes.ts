import type { Fmt as VideoFmt, Niche, Precision } from './types'
import { inNiche, type NicheScope } from './niche'
import { DAY, H } from './time'
import { RULES } from './rules'
import { FORMULA } from './catalog'
import { diffLines, titleDiff, type LineDiff, type TitleDiff } from './text-diff'
import type { EngineCtx } from './series'

export interface ObsChange {
  id: string; video: string; ch: string; niche: Niche | null; fmt: VideoFmt; type: 'title' | 'thumb' | 'desc'; typeLabel: string; idx: number; at: number
  prec: Precision; window: [number, number] | null; preSeries: boolean; before: unknown; after: unknown; fromId: string; toId: string; mid: number
  whenText: string; agoMidText: string; agoShort: string; agoText: string; prevLivedMs?: number; nextLivedMs?: number; revertTo: string | null
  revertedBy?: string; testCompare?: boolean; cycleMs?: number | null; diff?: LineDiff | null; hasText?: boolean; noTextReason?: string
  titleDiff?: TitleDiff; rewriteGroup?: string; sameWindow: string[]; within48h: string[]
  /**
   * R121, "trocas em sequência". An object = this change is one of a run of 2+ changes of the same field (thumbnail or
   * title) at most RULES.testRunGapDays apart. null = checked, not in a run (and every description change).
   * undefined = unknown (an object not produced by deriveChanges): the screens then say nothing about runs.
   */
  testRun?: TestRun | null
  /** Thumbnail that came back (revertTo): true only when it came back right after ONE other image (A → B → A). */
  revertImmediate?: boolean
  /** Thumbnail that came back: how many distinct other images were on air between its two periods. */
  revertBetween?: number
  /** The leg before a return (revertedBy): the return was immediate, so "this version was reverted" is true. */
  revertedImmediate?: boolean
}
/** `n` counts CHANGES (not versions); `pos` is 1-based; `from`/`to` are the first and the last change; `open` = the last one is at most testRunGapDays old. */
export interface TestRun { id: string; n: number; pos: number; from: number; to: number; open: boolean }

const TYPE_LABEL = { title: 'Título', thumb: 'Thumbnail', desc: 'Descrição' } as const
type ChangeType = keyof typeof TYPE_LABEL

export const REWRITE_GROUPS: { id: string; label: string; test: (c: ObsChange) => boolean }[] = [
  { id: 'reverteu', label: 'Voltou ao título anterior', test: c => !!c.revertTo },
  { id: 'tirou-segunda-noticia', label: 'Tirou a 2ª notícia', test: c => { const b = c.before as string, a = c.after as string
    return /\b(and|&|e)\b.+|\(and /i.test(b) && (b.match(/\b(and|e)\b/gi) || []).length > (a.match(/\b(and|e)\b/gi) || []).length && a.length <= b.length + 5 } },
  { id: 'primeira-pessoa', label: 'Passou para primeira pessoa', test: c => FORMULA['primeira-pessoa']!.test(c.after as string) && (!FORMULA['primeira-pessoa']!.test(c.before as string) || /^how i\b/i.test(c.before as string)) },
  { id: 'reacao-no-lugar', label: 'Reação no lugar do nome do produto', test: c => FORMULA['reacao-hiperbole']!.test(c.after as string) && !FORMULA['reacao-hiperbole']!.test(c.before as string) },
  { id: 'encurtou', label: 'Encurtou e tirou o detalhe', test: c => (c.after as string).length <= (c.before as string).length * 0.85 },
  { id: 'sem-padrao', label: 'Sem padrão claro', test: () => true },
]
const classifyRewrite = (c: ObsChange) => REWRITE_GROUPS.find(g => g.test(c))!.id

interface Versioned { id: string; first_seen: number; last_seen: number; window: [number, number] | null; hasText?: boolean; lines?: string[] | null; text?: string; key?: string; art?: unknown }

/** Ports dados.js:614-655, 736-741 and the titleDiff/revertTo/rewriteGroup pass (1318-1325). Sorted newest first. */
export function deriveChanges(ctx: EngineCtx): ObsChange[] {
  const { clock: date, ds } = ctx, SS = ds.seriesStart
  const changes: ObsChange[] = []
  for (const v of ds.videos) {
    const groups: [ChangeType, Versioned[]][] = [['title', v.titles as Versioned[]], ['thumb', v.thumbs as Versioned[]], ['desc', v.descs as Versioned[]]]
    for (const [type, arr] of groups) {
      arr.forEach((ver, i) => {
        if (i === 0) return
        const prev = arr[i - 1]!, pre = ver.first_seen < SS
        if (type === 'thumb' && pre) return // thumbnails before the series start are not reliable changes
        const stored = (ver as { prec?: Precision | 'first' | null }).prec
        const prec: Precision = type === 'thumb' ? (stored === 'min' || stored === '6h' || stored === '1d' ? stored : 'min') : pre ? '1d' : '6h'
        const win = ver.window || null
        const c: ObsChange = { id: v.id + '/' + type + '/' + i, video: v.id, ch: v.ch, niche: v.niche, fmt: v.fmt, type, typeLabel: TYPE_LABEL[type], idx: i,
          at: ver.first_seen, prec, window: win, preSeries: pre, before: null, after: null, fromId: prev.id, toId: ver.id, mid: 0,
          whenText: '', agoMidText: '', agoShort: '', agoText: '', revertTo: null, sameWindow: [], within48h: [] }
        c.mid = win ? (win[0] + win[1]) / 2 : c.at
        c.whenText = prec === 'min' || !win ? date.dm(c.at) + ' ' + date.hm(c.at) : date.windowText(win[0], win[1])
        c.agoMidText = date.ago(c.mid)
        c.agoShort = date.ago(c.at)
        c.agoText = win ? 'vista pela 1ª vez ' + date.ago(c.at) : date.ago(c.at)
        if (type === 'title') { c.before = prev.text; c.after = ver.text }
        if (type === 'thumb') {
          c.before = { key: prev.key, art: prev.art }; c.after = { key: ver.key, art: ver.art }
          c.prevLivedMs = prev.last_seen - prev.first_seen; c.nextLivedMs = ver.last_seen - ver.first_seen
          const earlier = arr.slice(0, i - 1).map(x => x.key)
          c.revertTo = earlier.includes(ver.key) ? ver.key! : null
          if (c.revertTo) {
            const left = arr.slice(0, i).reverse().find(x => x.key === ver.key && x !== ver)
            const leftAt = left ? left.last_seen : null
            c.cycleMs = leftAt ? ver.first_seen - leftAt : null
            c.testCompare = c.cycleMs != null && c.cycleMs <= RULES.testCompareMaxDays * DAY
            // The production sentences about a return ("com a alternativa", "foi revertida", "A → B → A") are only true
            // when nothing else was on air in between. `left` is the previous period of the same image.
            const li = left ? arr.lastIndexOf(left) : -1
            c.revertImmediate = arr[i - 2]!.key === ver.key
            c.revertBetween = li < 0 ? 0 : new Set(arr.slice(li + 1, i).map(x => x.key)).size
          }
        }
        if (type === 'desc') {
          if (prev.hasText && ver.hasText && !pre) { c.diff = diffLines(prev.lines!, ver.lines!); c.hasText = true }
          else { c.diff = null; c.hasText = false; c.noTextReason = 'Antes de ' + date.dm(SS) + ' a sincronização só registrava que a descrição mudou, sem guardar o texto.' }
        }
        if (type !== 'thumb') c.prevLivedMs = prev.last_seen - prev.first_seen
        changes.push(c)
      })
    }
  }
  for (const c of changes) {
    if (c.type === 'thumb' && c.revertTo) {
      const leg = changes.find(o => o.video === c.video && o.type === 'thumb' && o.idx === c.idx - 1)
      if (leg) { leg.revertedBy = c.id; leg.testCompare = c.testCompare; leg.cycleMs = c.cycleMs; leg.revertedImmediate = c.revertImmediate === true }
    }
  }
  // R121: per video and field, maximal runs of 2+ consecutive changes at most testRunGapDays apart. Thumbnail and title
  // only; a description change is never part of a run (null = checked). Every change leaves here with testRun set.
  const gap = RULES.testRunGapDays * DAY
  const byField = new Map<string, ObsChange[]>()
  for (const c of changes) {
    if (c.type === 'desc') { c.testRun = null; continue }
    const key = c.video + '/' + c.type, list = byField.get(key)
    if (list) list.push(c); else byField.set(key, [c])
  }
  for (const [key, list] of byField) {
    list.sort((a, b) => a.at - b.at)
    let run: ObsChange[] = [], seq = 0
    const close = () => {
      if (run.length >= 2) {
        seq++
        const from = run[0]!.at, to = run[run.length - 1]!.at, n = run.length, id = key + '/seq' + seq
        run.forEach((c, j) => { c.testRun = { id, n, pos: j + 1, from, to, open: ds.now - to <= gap } })
      } else for (const c of run) c.testRun = null
      run = []
    }
    for (const c of list) { if (run.length && c.at - run[run.length - 1]!.at > gap) close(); run.push(c) }
    close()
  }
  changes.sort((a, b) => b.at - a.at)
  for (const c of changes) {
    const sib = changes.filter(o => o !== c && o.video === c.video && o.type !== c.type)
    c.sameWindow = sib.filter(o => {
      const a = c.window || [c.at, c.at], b = o.window || [o.at, o.at]
      return (c.prec === '6h' && o.prec === 'min' && o.at > a[0]! && o.at <= a[1]!) || (o.prec === '6h' && c.prec === 'min' && c.at > b[0]! && c.at <= b[1]!) || !!(c.window && o.window && c.window[1] === o.window[1])
    }).map(o => o.id)
    c.within48h = sib.filter(o => Math.abs(o.mid - c.mid) < RULES.effect.simultHours * H).map(o => o.id)
  }
  for (const c of changes) {
    if (c.type !== 'title') continue
    c.titleDiff = titleDiff(c.before as string, c.after as string)
    const v = ctx.V.get(c.video) ?? ds.videos.find(x => x.id === c.video)!
    const earlier = v.titles.slice(0, c.idx - 1).map(x => x.text)
    c.revertTo = earlier.includes(c.after as string) ? (c.after as string) : (c.revertTo || null)
  }
  for (const c of changes) if (c.type === 'title') c.rewriteGroup = classifyRewrite(c)
  ctx.CHG.clear()
  for (const c of changes) ctx.CHG.set(c.id, c)
  return changes
}

export function changesIn(ctx: EngineCtx, o: { days?: number | null; niche?: NicheScope; type?: string | null; channel?: string | null; video?: string | null; fmt?: VideoFmt | null } = {}): ObsChange[] {
  const q = { days: 30, niche: 'todos' as NicheScope, type: null, channel: null, video: null, fmt: null, ...o }
  const NOW = ctx.ds.now
  return [...ctx.CHG.values()].filter(c => (q.days == null || c.at > NOW - q.days * DAY) && inNiche(q.niche, c) && (!q.type || c.type === q.type) && (!q.channel || c.ch === q.channel)
    && (!q.video || c.video === q.video) && (!q.fmt || c.fmt === q.fmt) && !ctx.CH.get(c.ch)!.own)
}

/** Other changes to the same video within the 7 days after. Since R115 such a change is 'inconclusivo' (kind 'troca-seguinte'); the screens hide this list for that kind (the reason already names the next change). */
export function caveats(ctx: EngineCtx, changeId: string): string[] {
  const c = ctx.CHG.get(changeId)
  if (!c) return []
  const k = ctx.clock.snapIdxAtOrAfter(c.at)
  return [...ctx.CHG.values()].filter(o => o.video === c.video && o !== c && o.at > c.at && ctx.clock.snapIdxAtOrAfter(o.at) < k + 7 && !c.within48h.includes(o.id))
    .map(o => o.typeLabel + ' mudou ' + (o.prec === 'min' ? 'em ' : '') + o.whenText + ', dentro dos 7 dias depois.')
}
