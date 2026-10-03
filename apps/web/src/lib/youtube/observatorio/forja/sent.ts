// The data the site sends to the forja for one request ("dados enviados à forja"), frozen by the readings endpoint.
// Production-only (the mockup's readings were generated in place). Shapes follow the mockup's frozen `sent` texts
// (dados.js:1007, 1243, 1344) so a reading's text and its "dados enviados" line read the same.
//
// Citation rule (R26/R30, shared by the site validator and the forja worker): every item cell is a PREFORMATTED string,
// exactly as the forja may cite it (fmt.num, fmt.mult, fmt.pct/fmt.pp with U+2212, integers as plain strings), and
// `numbers` holds every canonical number token (forja/numbers.ts, the worker's own canonicaliser, R38) of `text`, of
// every item cell (ids excepted) and of the counts, in the display canonical form ("1,5 mil", "12 pp", "3 h", "1.230",
// "2º", "60s", "8,2×", "−41%"). The forja may cite only those.
import { RULES } from '../rules'
import { inNiche } from '../niche'
import { baseAt, analyzePatterns, type BaseVideo } from '../insights'
import { effectAt } from '../effect'
import { viewsAtIdx } from '../series'
import { THEME, FORMULA } from '../catalog'
import { DAY } from '../time'
import type { ObsChange } from '../changes'
import type { Fmt, Niche, ReadingBase, ReadingEffect } from '../types'
import type { Observatory } from '../index'
import { eligibleChannels, type ForjaCtx } from './scope'
import { canonicalNumberTokens } from './numbers'

export type SentCell = string | null
export interface SentPack {
  text: string; asOf: number; ids: string[]; numbers: string[]; nVideos: number; nOutliers: number
  channels: string[]; channelsOut: Array<{ id: string; reason: string }>; items: Array<Record<string, SentCell>>; capped: boolean
  /*
   * What "Desde então" (forja.since) compares today's data with, frozen with the reading (the loader maps it back onto
   * the FrozenReading). Raw values, never cited: they stay out of `numbers`. Without them a published reading could
   * only ever say "sem os dados enviados à forja para comparar" (Task 35b).
   */
  /** padroes-titulo / temas: the videos and channels read, with their multipliers then. */
  base?: ReadingBase
  /** resumo-trocas: the changes read and the window (30 days). */
  changeIds?: string[]; windowDays?: number
  /** leitura-video: each change's verdict and the video's views then. */
  effects?: ReadingEffect[]; viewsThen?: number | null
}
export interface SentTarget { niche?: Niche | null; videoId?: string | null; fmt?: Fmt | null }
/**
 * The request's target no longer exists in the dataset (the video of a leitura-video is gone). The ONLY buildSent
 * failure that is about the data and not the code: the readings GET answers it with a non-retryable 422. Every other
 * throw (a bad row shape, a bug) is a 500 that goes to Sentry and is retried.
 */
export class TargetUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = 'TargetUnavailableError' }
}

export { canonicalNumberTokens, normalizeNumberToken } from './numbers'
/** Cells that are identifiers, never cited as numbers. */
const ID_KEYS = new Set(['id', 'video', 'change'])

function pack(p: Omit<SentPack, 'numbers'>, counts: number[]): SentPack {
  const seen = new Set<string>()
  const add = (t: string) => { if (!seen.has(t)) seen.add(t) }
  canonicalNumberTokens(p.text).forEach(add)
  for (const it of p.items) for (const [k, v] of Object.entries(it)) if (!ID_KEYS.has(k)) canonicalNumberTokens(v).forEach(add)
  for (const n of counts) canonicalNumberTokens(String(n)).forEach(add)
  return { ...p, numbers: [...seen] }
}

const winText = (w: number) => w === 182 ? '6 meses' : w + ' dias'

function outlierPack(ctx: ForjaCtx, type: string, niche: Niche, fmtId: Fmt): SentPack {
  const { clock, fmt } = ctx, short = fmtId === 'short', win = type === 'temas' ? 90 : 182, max = RULES.forja.maxVideos
  const el = eligibleChannels(ctx, niche)
  const base = baseAt(ctx, niche, ctx.lastIdx, win, null, fmtId)
  const channels = base.channels.filter(c => el.in.includes(c))
  const pub = (v: BaseVideo) => ctx.V.get(v.id)!.pub
  const all = base.videos.filter(v => channels.includes(v.ch)).sort((a, b) => pub(b) - pub(a))   // most recent first
  const capped = all.length > max, vids = capped ? all.slice(0, max) : all
  const isOut = (v: BaseVideo) => !v.weak && v.mult >= RULES.outlierMin
  const nOut = vids.filter(isOut).length, withV = new Set(vids.map(v => v.ch)).size
  const unit = (n: number) => short ? (n === 1 ? 'Short' : 'Shorts') : (n === 1 ? 'longo' : 'longos')
  const items: Array<Record<string, SentCell>> = vids.map(v => {
    const vv = ctx.V.get(v.id)!, ch = ctx.CH.get(v.ch)!, views = viewsAtIdx(vv, Math.min(ctx.lastIdx, ch.lastIdx ?? ctx.lastIdx))
    return { kind: 'vídeo', id: v.id, channel: ch.name, title: v.title, published: clock.dmy(vv.pub), age: fmt.age(vv), views: views == null ? null : fmt.num(views),
      mult: fmt.mult(v.mult), base: v.weak ? 'base fraca (n = ' + (v.n ?? 0) + ')' : 'n = ' + (v.n ?? 0), theme: v.theme ? THEME[v.theme]?.label ?? v.theme : null,
      formulas: v.formulas.length ? v.formulas.map(f => FORMULA[f]?.label ?? f).join(', ') : null }
  })
  if (vids.length && type !== 'temas') {
    // the site's own pattern verdicts over the videos sent (rule: n ≥ 10 and difference ≥ 0,3×)
    for (const p of analyzePatterns(ctx, { niche, videos: vids }).patterns) items.push({ kind: 'fórmula', formula: p.label, verdict: p.verdict.text, withFormula: String(p.nUse), withoutFormula: String(p.nNot), medianWith: p.medUse == null ? null : fmt.mult(p.medUse), medianWithout: p.medNot == null ? null : fmt.mult(p.medNot) })
  }
  let text: string
  if (!vids.length) {
    text = 'nenhum vídeo para enviar à forja: ' + (channels.length
      ? (channels.length === 1 ? 'o canal do nicho não tem ' : 'os ' + channels.length + ' canais do nicho não têm ') + (short ? 'Shorts' : 'vídeos longos') + ' com base de comparação nos últimos ' + winText(win)
      : 'nenhum canal do nicho entra no pedido')
  } else {
    const word = short ? fmt.plural(withV, 'canal', 'canais') + ' com Shorts' : withV === channels.length ? fmt.plural(withV, 'canal', 'canais') : fmt.plural(withV, 'canal', 'canais') + ' com vídeos longos'
    text = 'dados enviados à forja: ' + (capped ? 'os ' + max + ' ' + (short ? 'Shorts' : 'longos') + ' mais recentes de ' + fmt.int(all.length) : vids.length + ' ' + unit(vids.length)) +
      ' até ' + clock.dm(base.asOf) + ' ' + clock.hm(base.asOf) + ' (' + word + ', ' + winText(win) + '; ' + fmt.plural(nOut, 'outlier', 'outliers') + ' de ' + fmt.mult(RULES.outlierMin) + ' ou mais)'
  }
  const frozen: ReadingBase = { fmt: fmtId, t: base.t, asOf: base.asOf, niche, windowDays: win, channels, excluded: base.excluded,
    videos: vids.map(v => ({ id: v.id, ch: v.ch, title: v.title, theme: v.theme, formulas: v.formulas, mult: v.mult, weak: v.weak, method: v.method ?? null, n: v.n })) }
  return pack({ text, asOf: base.asOf, ids: vids.map(v => v.id), nVideos: vids.length, nOutliers: nOut, channels, channelsOut: el.out, items, capped, base: frozen, windowDays: win },
    [vids.length, nOut, all.length, max, withV, channels.length, RULES.outlierMin, RULES.pattern.minN])
}

const beforeAfter = (c: ObsChange, x: unknown): SentCell => c.type === 'title' ? String(x) : c.type === 'thumb' ? (x as { key: string }).key : null
function changeItem(ctx: ForjaCtx, c: ObsChange, Lcap: number | null): Record<string, SentCell> {
  const e = effectAt(ctx, c.id, Lcap), v = ctx.V.get(c.video)!
  return { kind: 'troca', change: c.id, video: c.video, channel: ctx.CH.get(c.ch)!.name, videoTitle: v.title, type: c.typeLabel, when: c.whenText,
    before: beforeAfter(c, c.before), after: beforeAfter(c, c.after), verdict: e ? e.label : null,
    numbers: e && ['ganhou', 'perdeu', 'neutro'].includes(e.status) ? e.numbersFlat ?? null : null }
}

function changesPack(ctx: ForjaCtx, niche: Niche): SentPack {
  const { clock, fmt } = ctx, max = RULES.forja.maxVideos, asOf = clock.snapTime(ctx.lastIdx)
  const el = eligibleChannels(ctx, niche)
  const all = [...ctx.CHG.values()].filter(c => inNiche(niche, c) && !ctx.CH.get(c.ch)!.own && el.in.includes(c.ch) && c.at <= asOf && c.at > asOf - 30 * DAY).sort((a, b) => b.at - a.at)
  const capped = all.length > max, cs = capped ? all.slice(0, max) : all
  const by = (t: string) => cs.filter(c => c.type === t).length
  const videos = [...new Set(cs.map(c => c.video))], channels = el.in
  const text = !cs.length ? 'nenhuma troca para enviar à forja nos últimos 30 dias até ' + clock.dm(asOf) + ' ' + clock.hm(asOf)
    : 'dados enviados à forja: ' + (capped ? 'as ' + max + ' trocas mais recentes de ' + fmt.int(all.length) : fmt.plural(cs.length, 'troca', 'trocas')) +
      ' (' + by('title') + ' de título, ' + by('thumb') + ' de thumbnail, ' + by('desc') + ' de descrição) de ' + clock.dm(asOf - 30 * DAY) + ' a ' + clock.dm(asOf) + ' ' + clock.hm(asOf)
  return pack({ text, asOf, ids: [...cs.map(c => c.id), ...videos], nVideos: videos.length, nOutliers: 0, channels, channelsOut: el.out, items: cs.map(c => changeItem(ctx, c, null)), capped,
    changeIds: cs.map(c => c.id), windowDays: 30 },
    [cs.length, all.length, max, videos.length, 0, by('title'), by('thumb'), by('desc'), 30])
}

function videoPack(ctx: ForjaCtx, videoId: string): SentPack {
  const { clock, fmt } = ctx, v = ctx.V.get(videoId)
  if (!v) throw new TargetUnavailableError('buildSent: unknown video ' + videoId)
  const ch = ctx.CH.get(v.ch)!, lastV = v.series.length ? v.series[v.series.length - 1]!.idx : 0
  const t = Math.min(ctx.lastIdx, lastV), asOf = clock.snapTime(t)   // stalled channel: up to the video's last point
  const cs = [...ctx.CHG.values()].filter(c => c.video === videoId && c.at <= clock.now).sort((a, b) => a.at - b.at)
  const allPts = v.series.filter(p => p.idx <= t), max = RULES.forja.maxVideos
  const capped = allPts.length > max, pts = capped ? allPts.slice(-max) : allPts   // the most recent daily records
  const nT = v.titles.filter(x => x.first_seen <= clock.now).length, nTh = v.thumbs.filter(x => x.first_seen <= clock.now).length, nD = v.descs.filter(x => x.first_seen <= clock.now).length
  const m = v.mult, isOut = !!m && m.value != null && !m.weak && m.value >= RULES.outlierMin
  const items: Array<Record<string, SentCell>> = [
    { kind: 'vídeo', id: v.id, channel: ch.name, title: v.title, published: clock.dmy(v.pub), age: fmt.age(v), views: v.views == null ? null : fmt.num(v.views), mult: m && m.value != null ? fmt.mult(m.value) : null },
    ...cs.map(c => changeItem(ctx, c, t)),
    ...pts.map(p => ({ kind: 'registro diário', at: clock.dmhm(p.t), views: fmt.num(p.views) })),
  ]
  const text = !pts.length ? 'nenhum registro diário de views para enviar à forja: o vídeo ainda não tem série'
    : 'dados enviados à forja: ' + fmt.plural(nT, 'título', 'títulos') + ', ' + fmt.plural(nTh, 'período', 'períodos') + ' de thumbnail, ' + fmt.plural(nD, 'descrição', 'descrições') + ' e ' +
      (capped ? 'os ' + max + ' registros diários de views mais recentes de ' + fmt.int(allPts.length) : fmt.plural(pts.length, 'registro diário', 'registros diários') + ' de views') + ', até ' + clock.dm(asOf) + ' ' + clock.hm(asOf)
  const el = eligibleChannels(ctx, v.niche)
  const effects: ReadingEffect[] = cs.map(c => effectAt(ctx, c.id, t)).filter((e): e is NonNullable<typeof e> => !!e)
    .map(e => ({ change: e.id, status: e.status, numbers: e.numbers ?? null, reason: e.reason, collected: e.collected ?? null }))
  return pack({ text, asOf, ids: [v.id, ...cs.map(c => c.id)], nVideos: 1, nOutliers: isOut ? 1 : 0, channels: [v.ch], channelsOut: el.out.filter(o => o.id === v.ch), items, capped,
    effects, viewsThen: viewsAtIdx(v, t) ?? null },
    [1, isOut ? 1 : 0, nT, nTh, nD, pts.length, allPts.length, max])
}

/** The frozen data for one request: one type × one target (a niche, or a video for leitura-video). */
export function buildSentCtx(ctx: ForjaCtx, type: string, target: SentTarget): SentPack {
  if (type === 'leitura-video') {
    if (!target.videoId) throw new Error('buildSent: leitura-video needs a videoId')
    return videoPack(ctx, target.videoId)
  }
  const niche = target.niche
  if (niche !== 'ia' && niche !== 'viagem') throw new Error('buildSent: ' + type + ' needs a niche (one request per niche)')
  if (type === 'resumo-trocas') return changesPack(ctx, niche)
  if (type === 'padroes-titulo' || type === 'padroes-titulo-shorts' || type === 'temas') return outlierPack(ctx, type, niche, target.fmt || (type === 'padroes-titulo-shorts' ? 'short' : 'long'))
  throw new Error('buildSent: unknown reading type ' + type)
}
/** buildSent over the public facade. */
export function buildSent(obs: Observatory, type: string, target: SentTarget): SentPack {
  return obs.forja.buildSent(type, target)
}
