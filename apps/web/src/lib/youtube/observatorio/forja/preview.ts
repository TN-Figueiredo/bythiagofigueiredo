// Port of dados.js:1864-1874 (preview of the request that would be sent now).
import { baseAt } from '../insights'
import { RULES } from '../rules'
import { changesIn } from '../changes'
import type { NicheScope } from '../niche'
import type { Fmt } from '../types'
import { eligibleChannels, type ForjaCtx } from './scope'

export interface Preview {
  type: string; niche: NicheScope; text: string; channelsIn: string[]; channelsOut: Array<{ id: string; reason: string }>
  fmt?: Fmt; nVideos?: number; nOutliers?: number; videos?: number; outliers?: number; nChanges?: number; changes?: number
  channels?: number; window?: string; windowDays?: number
}

/** What a request would read if sent now ("Lê 367 vídeos longos (9 outliers)"), with the channels in and out. */
export function preview(ctx: ForjaCtx, type: string, niche: NicheScope, fmtId?: Fmt | null): Preview {
  const el = eligibleChannels(ctx, niche), fmt = ctx.fmt
  if (type === 'resumo-trocas') {
    const n = changesIn(ctx, { days: 30, niche }).filter(c => el.in.includes(c.ch)).length
    return { type, niche, nChanges: n, changes: n, channels: el.in.length, window: '30 dias', windowDays: 30, channelsIn: el.in, channelsOut: el.out, text: 'Lê ' + fmt.plural(n, 'troca', 'trocas') + ' dos últimos 30 dias' }
  }
  if (type === 'leitura-video') return { type, niche, channelsIn: el.in, channelsOut: el.out, text: 'Lê o histórico completo do vídeo' }
  const f: Fmt = fmtId || (type === 'padroes-titulo-shorts' ? 'short' : 'long'), win = type === 'temas' ? 90 : 182
  const base = baseAt(ctx, niche, ctx.lastIdx, win, null, f)
  const nOut = base.videos.filter(v => !v.weak && v.mult >= RULES.outlierMin).length, nv = base.videos.length
  return { type, niche, fmt: f, nVideos: nv, nOutliers: nOut, videos: nv, outliers: nOut, channels: base.channels.length, window: win === 182 ? '6 meses' : win + ' dias', windowDays: win,
    channelsIn: base.channels, channelsOut: el.out,
    text: 'Lê ' + nv + ' ' + (f === 'short' ? (nv === 1 ? 'Short' : 'Shorts') : (nv === 1 ? 'vídeo longo' : 'vídeos longos')) + ' (' + nOut + ' outlier' + (nOut === 1 ? '' : 's') + ')' }
}
