// Port of dados.js:1252-1272 (sinceVideo), 1353-1365 (sinceChanges), 1382-1421 (since), 1904 (textNoAsk).
// "Desde então" compares a frozen reading with what the observatory knows NOW. Texts are canonical (CONVENCOES).
import { inNiche } from '../niche'
import { baseAt } from '../insights'
import { RULES } from '../rules'
import { multiplierAt } from '../multiplier'
import { effect } from '../effect'
import { DAY } from '../time'
import type { ObsChange } from '../changes'
import type { FrozenReading, ReadingBaseVideo } from '../types'
import { eligibleChannels, type ForjaCtx } from './scope'

type Stale = { id: string; reason: string }
export interface SinceResult {
  readingId: string; text: string; textNoAsk: string; shortText: string
  newVideos: string[]; leftWindow: string[]; nowVideos: number; sentVideos: number
  staleNow?: Stale[]; becameOutlier?: string[]; stoppedOutlier?: string[]; titleChanged?: string[]; nowOutliers?: number; sentOutliers?: number
  freshVideos?: string[]; noBaseThenVideos?: string[]; foundOldVideos?: string[]; countsText?: string
  leftWindowChanges?: string[]; newChanges?: string[]
  items?: string[]; flipped?: number; newPoints?: number
  moved?: Array<{ change: string; then: string; now: string; thenCollected: number | null; nowCollected: number | null }>
  viewsThen?: number | null; viewsNow?: number | null
}
type Raw = Omit<SinceResult, 'textNoAsk'>

const ASK = /\s*Peça nova leitura à forja para atualizar\.$/
/** The text to show while a request is active: same sentence, without "Peça nova leitura à forja para atualizar." */
export const noAskText = (text: string): string => text.replace(ASK, '.').replace(/\.\.$/, '.')

const changesOf = (ctx: ForjaCtx): ObsChange[] => [...ctx.CHG.values()]
const plural = (ctx: ForjaCtx, n: number, one: string, many: string) => ctx.fmt.plural(n, one, many)

function sinceVideo(ctx: ForjaCtx, r: FrozenReading): Raw {
  const v = ctx.V.get(r.target!.video!)!, ch = ctx.CH.get(v.ch)!
  const newPts = Math.max(0, (ch.lastIdx ?? 0) - (r.sent.asOfIdx ?? 0))
  const newChanges = changesOf(ctx).filter(c => c.video === v.id && c.at > r.generatedAt).map(c => c.id)
  const moved = (r.effects || []).map(e => { const now = effect(ctx, e.change)!; return { change: e.change, then: e.status, now: now.status as string, thenCollected: e.collected, nowCollected: now.collected != null ? now.collected : null } })
    .filter(x => x.then !== x.now || x.thenCollected !== x.nowCollected)
  const lbl = (st: string) => ({ 'sem-serie': 'sem série', 'sem-antes': 'sem base' } as Record<string, string>)[st] || st
  const flipped = moved.filter(x => x.then !== x.now), waiting = moved.filter(x => x.then === x.now)
  const parts: string[] = []
  if (newPts) parts.push('+' + plural(ctx, newPts, 'registro diário', 'registros diários'))
  if (flipped.length) parts.push(plural(ctx, flipped.length, 'troca mudou', 'trocas mudaram') + ' de veredito')
  if (waiting.length) parts.push(plural(ctx, waiting.length, 'troca ganhou', 'trocas ganharam') + ' dias de coleta')
  if (newChanges.length) parts.push(plural(ctx, newChanges.length, 'troca nova', 'trocas novas'))
  const items = moved.map(x => {
    const c = ctx.CHG.get(x.change)!
    const idxTxt = c.type === 'thumb' ? (c.before as { key: string }).key + ' → ' + (c.after as { key: string }).key : c.idx + ' → ' + (c.idx + 1)
    return c.typeLabel + ' ' + idxTxt + ' (' + c.whenText + '): ' + (x.then === x.now ? 'aguardando, ' + x.thenCollected + ' → ' + x.nowCollected + ' de 7 dias' : lbl(x.then) + ' → ' + lbl(x.now))
  })
  const sp: string[] = []
  if (newPts) sp.push('+' + plural(ctx, newPts, 'registro diário', 'registros diários'))
  if (flipped.length) sp.push(plural(ctx, flipped.length, 'veredito mudou', 'vereditos mudaram'))
  if (waiting.length) sp.push(waiting.length + (waiting.length === 1 ? ' ganhou dias de coleta' : ' ganharam dias de coleta'))
  if (newChanges.length) sp.push('+' + plural(ctx, newChanges.length, 'troca nova', 'trocas novas'))
  return { shortText: 'desde então: ' + (sp.length ? sp.join(' · ') : 'nada mudou'), items, flipped: flipped.length, newVideos: [], leftWindow: [], nowVideos: 0, sentVideos: 0, readingId: r.id,
    newPoints: newPts, newChanges, moved, viewsThen: r.viewsThen, viewsNow: v.views,
    text: parts.length ? 'Desde então: ' + parts.join('; ') + '. Peça nova leitura à forja para atualizar.' : 'Nada mudou desde a leitura.' }
}

function sinceChanges(ctx: ForjaCtx, r: FrozenReading): Raw {
  const now = changesOf(ctx).filter(c => inNiche(r.niche, c) && !ctx.CH.get(c.ch)!.own && c.at > r.generatedAt)
  const sentIds = r.sent.changeIds || []
  const left = sentIds.filter(id => ctx.CHG.get(id)!.at <= ctx.clock.now - (r.sent.windowDays ?? 30) * DAY)
  const parts: string[] = []
  if (now.length) parts.push('+' + now.length + (now.length === 1 ? ' troca nova' : ' trocas novas'))
  if (left.length) parts.push(left.length + (left.length === 1 ? ' saiu' : ' saíram') + ' da janela de 30 dias')
  const staleNow = eligibleChannels(ctx, r.niche).out.filter(o => sentIds.some(id => ctx.CHG.get(id)!.ch === o.id) || now.some(c => c.ch === o.id))
  if (staleNow.length) parts.push(staleNow.map(o => o.reason.replace(' fica fora', '')).join('; ') + ' — uma nova leitura deixaria ' + (staleNow.length === 1 ? 'esse canal' : 'esses canais') + ' de fora')
  const sp: string[] = []
  if (now.length) sp.push('+' + plural(ctx, now.length, 'troca nova', 'trocas novas'))
  if (left.length) sp.push(left.length + (left.length === 1 ? ' saiu da janela' : ' saíram da janela'))
  if (staleNow.length) sp.push(plural(ctx, staleNow.length, 'canal fora', 'canais fora'))
  return { shortText: 'desde então: ' + (sp.length ? sp.join(' · ') : 'nada mudou'), staleNow, newVideos: [], nowVideos: 0, sentVideos: 0, leftWindowChanges: left, readingId: r.id,
    newChanges: now.map(c => c.id), leftWindow: [],
    text: parts.length ? 'Desde então: ' + parts.join(', ') + '. Peça nova leitura à forja para atualizar.' : 'Nada mudou desde a leitura.' }
}

function sinceOutliers(ctx: ForjaCtx, r: FrozenReading): Raw {
  const base = r.base!, fmtId = r.fmt || base.fmt || 'long'
  // same channels and same format as the reading, read at the last daily record
  const now = baseAt(ctx, r.niche ?? undefined, ctx.lastIdx, base.windowDays!, base.channels, fmtId)
  const staleNow = eligibleChannels(ctx, r.niche).out.filter(o => base.channels.includes(o.id) && base.videos.some(x => x.ch === o.id))
  const sentIds = new Set(base.videos.map(v => v.id)), nowIds = new Set(now.videos.map(v => v.id))
  const newVideos = now.videos.filter(v => !sentIds.has(v.id))
  const leftWindow = base.videos.filter(v => !nowIds.has(v.id))
  const isOut = (v: ReadingBaseVideo) => !v.weak && v.mult >= RULES.outlierMin
  const outNow = new Set(now.videos.filter(isOut).map(v => v.id)), outThen = new Set(base.videos.filter(isOut).map(v => v.id))
  const becameOut = [...outNow].filter(id => !outThen.has(id)), stoppedOut = [...outThen].filter(id => !outNow.has(id))
  const titleChanged = base.videos.filter(v => nowIds.has(v.id) && ctx.V.get(v.id)!.title !== v.title).map(v => v.id)
  const pub = (v: ReadingBaseVideo) => ctx.V.get(v.id)!.pub
  const fresh = newVideos.filter(v => pub(v) >= r.sent.asOf), older = newVideos.filter(v => pub(v) < r.sent.asOf)
  const thenT = r.sent.asOfIdx ?? 0
  const noBaseThen = older.filter(v => { const vv = ctx.V.get(v.id)!, ch = ctx.CH.get(vv.ch)!; return multiplierAt(ctx, vv, Math.min(thenT, ch.lastIdx ?? 0)).value == null })
  const foundOld = older.filter(v => !noBaseThen.includes(v))
  const win = base.windowDays === 182 ? '6 meses' : base.windowDays + ' dias'
  const parts: string[] = []
  if (fresh.length) parts.push('+' + plural(ctx, fresh.length, 'vídeo novo', 'vídeos novos'))
  if (noBaseThen.length) parts.push(plural(ctx, noBaseThen.length, 'vídeo ganhou', 'vídeos ganharam') + ' base de comparação')
  if (foundOld.length) parts.push(plural(ctx, foundOld.length, 'vídeo antigo entrou', 'vídeos antigos entraram') + ' na base (achados depois, pela sincronização)')
  if (leftWindow.length) parts.push(leftWindow.length + (leftWindow.length === 1 ? ' saiu' : ' saíram') + ' da janela de ' + win)
  if (becameOut.length) parts.push('+' + becameOut.length + ' outlier' + (becameOut.length > 1 ? 's' : ''))
  if (stoppedOut.length) parts.push(plural(ctx, stoppedOut.length, 'deixou', 'deixaram') + ' de ser outlier')
  if (titleChanged.length) parts.push(titleChanged.length + ' com título trocado')
  if (staleNow.length) parts.push(staleNow.map(o => o.reason.replace(' fica fora', '')).join('; ') + ' — uma nova leitura deixaria ' + (staleNow.length === 1 ? 'esse canal' : 'esses canais') + ' de fora')
  const sp: string[] = []
  if (fresh.length) sp.push('+' + plural(ctx, fresh.length, 'vídeo novo', 'vídeos novos'))
  if (noBaseThen.length) sp.push(noBaseThen.length + (noBaseThen.length === 1 ? ' ganhou base' : ' ganharam base'))
  if (foundOld.length) sp.push(foundOld.length + (foundOld.length === 1 ? ' antigo entrou' : ' antigos entraram'))
  if (leftWindow.length) sp.push(leftWindow.length + (leftWindow.length === 1 ? ' saiu da janela' : ' saíram da janela'))
  if (becameOut.length) sp.push('+' + plural(ctx, becameOut.length, 'outlier', 'outliers'))
  if (stoppedOut.length) sp.push(stoppedOut.length + (stoppedOut.length === 1 ? ' deixou de ser outlier' : ' deixaram de ser outlier'))
  if (titleChanged.length) sp.push(plural(ctx, titleChanged.length, 'título trocado', 'títulos trocados'))
  if (staleNow.length) sp.push(plural(ctx, staleNow.length, 'canal fora', 'canais fora'))
  return { staleNow, readingId: r.id, newVideos: newVideos.map(v => v.id), leftWindow: leftWindow.map(v => v.id), becameOutlier: becameOut, stoppedOutlier: stoppedOut, titleChanged,
    nowVideos: now.videos.length, nowOutliers: outNow.size, sentVideos: base.videos.length, sentOutliers: outThen.size,
    freshVideos: fresh.map(v => v.id), noBaseThenVideos: noBaseThen.map(v => v.id), foundOldVideos: foundOld.map(v => v.id),
    countsText: 'vídeos: ' + base.videos.length + ' → ' + now.videos.length + ' · outliers: ' + outThen.size + ' → ' + outNow.size,
    shortText: 'desde então: ' + (sp.length ? sp.join(' · ') : 'nada mudou'),
    text: parts.length ? 'Desde então: ' + parts.join(', ') + '. Peça nova leitura à forja para atualizar.' : 'Nada mudou desde a leitura.' }
}

/**
 * What changed since a frozen reading. `text` starts "Desde então:" (or is "Nada mudou desde a leitura."), `shortText` is
 * the one-line "desde então: …" with the same numbers, `textNoAsk` is `text` without the call to ask again (shown
 * while a request is active). Null for an unknown reading.
 */
export function since(ctx: ForjaCtx, readingId: string): SinceResult | null {
  const r = Object.prototype.hasOwnProperty.call(ctx.READ, readingId) ? ctx.READ[readingId] : undefined
  if (!r) return null
  const x = r.type === 'leitura-video' ? sinceVideo(ctx, r) : r.type === 'resumo-trocas' ? sinceChanges(ctx, r) : sinceOutliers(ctx, r)
  return { ...x, textNoAsk: noAskText(x.text) }
}
