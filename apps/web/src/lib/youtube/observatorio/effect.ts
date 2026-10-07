// Port of dados.js:656-735
import { RULES, bandOf } from './rules'
import { median, quant } from './stats'
import { rate, pointTime, earliestIdx, fromDayZero } from './series'
import type { EngineCtx } from './series'
import type { ObsVideo } from './types'
import type { ObsChange } from './changes'
import { DAY } from './time'
import { isObserved } from './observed'

export type EffectStatus = 'ganhou' | 'perdeu' | 'neutro' | 'inconclusivo' | 'aguardando' | 'sem-serie' | 'sem-antes'
export interface EffectResult {
  id: string; type: string; status: EffectStatus; label: string; reason: string
  k?: number; beforeDays?: number; afterDays?: number; readyOn?: number; readyText?: string | null; readyTextIfPending?: string; firstPointAfter?: number
  daily?: { before: DailyRow[]; changeDay: DailyRow | null; after: DailyRow[] }
  collected?: number; willBeInconclusive?: string | null; willBeInconclusiveShort?: string | null; waitText?: string
  observed?: number; beforeAvg?: number; afterAvg?: number; expected?: number | null; iqr?: [number | null, number | null]; n?: number; effectPp?: number | null
  band?: string; method?: 'mesmo dia de vida' | 'aproximação por faixa'; methodLabel?: string; methodFallback?: boolean; sameDayN?: number | null; fallbackText?: string | null
  numbers?: string; numbersFlat?: string; noBaseText?: string | null; inconclusiveKind?: 'janela-dupla' | 'troca-seguinte' | 'versao-curta' | 'antes-curto' | 'outro'; beforeCutBy?: 'troca-anterior'; neutralWhy?: 'ambos' | 'menor-que-10pp' | 'dentro-da-faixa'
}
export interface DailyRow { idx: number; from: number; to: number; vpd: number | null }


const changedSince = (ctx: EngineCtx, v: ObsVideo) => [v.titles, v.thumbs, v.descs].some(arr => arr.some((x, j) => j > 0 && x.first_seen >= ctx.ds.seriesStart))
const firstRealIdx = (v: ObsVideo) => v.firstIdx!
function ratioAt(ctx: EngineCtx, u: ObsVideo, k: number, b: number, Lcap: number | null) {
  const end = k - 1, start = end - b
  if (start < firstRealIdx(u) || k + 7 > Math.min(u.series[u.series.length - 1]!.idx, Lcap == null ? 1e9 : Lcap)) return null
  const rb = rate(ctx, u, start, end), ra = rate(ctx, u, k, k + 7)
  if (rb == null || ra == null || rb <= 0) return null
  return { r: ra / rb - 1, rb, ra }
}
const cache = new WeakMap<EngineCtx, Map<string, EffectResult>>()
export function effect(ctx: EngineCtx, changeId: string) { return effectAt(ctx, changeId, null) }
export function effectAt(ctx: EngineCtx, changeId: string, Lcap: number | null): EffectResult | null {
  const memo = cache.get(ctx) ?? new Map<string, EffectResult>(); cache.set(ctx, memo)
  const key = changeId + '@' + (Lcap ?? ''); const hit = memo.get(key); if (hit) return hit
  const c = ctx.CHG.get(changeId); if (!c) return null
  const v = ctx.V.get(c.video)!, ch = ctx.CH.get(v.ch)!, { clock, fmt } = ctx, S0 = clock.dm(ctx.ds.seriesStart)
  const res = { id: c.id, type: c.type } as EffectResult
  const done = (x: Partial<EffectResult>) => { Object.assign(res, x); memo.set(key, res); return res }
  if (c.preSeries) return done({ status: 'sem-serie', label: 'sem série', reason: 'Sem série antes da troca (coleta por vídeo desde ' + S0 + ').' })
  // R37 + R119: the daily record is read only for observed videos (tracked ∪ pinned), so any other video (and its changes) has no series by design
  if (!isObserved(v)) return done({ status: 'sem-serie', label: 'sem série', reason: 'Fora dos vídeos acompanhados: sem série diária de views.' })
  if (!v.series.length || ch.lastIdx == null) return done({ status: 'sem-serie', label: 'sem série', reason: 'Vídeo sem série diária de views.' })
  const k = clock.snapIdxAtOrAfter(c.at), L = Lcap == null ? ch.lastIdx : Math.min(ch.lastIdx, Lcap)
  const seriesBefore = Math.max(0, Math.min(RULES.effect.maxBeforeDays, (k - 1) - firstRealIdx(v)))
  const afterDays = Math.max(0, Math.min(7, L - k))
  const wdR = clock.weekday(clock.snapTime(k + 7))
  const readyTextIfPending = 'leitura ' + (/^(segunda|terça|quarta|quinta|sexta)/.test(wdR) ? 'na ' : 'no ') + wdR + ', ' + clock.dm(clock.snapTime(k + 7))
  // R115: the 7 days after must belong to ONE version. Another change of any field on the same video inside them makes the
  // reading mix two versions. An imprecise neighbour counts from the start of its window (the conservative side). A frozen
  // reading (Lcap) only knows the neighbours already SEEN at its cap (o.at is when the change was first seen, so the window
  // start must not be used here); the live reading knows every detected one, including one after the last daily record.
  const kOfNext = (o: ObsChange) => clock.snapIdxAtOrAfter(o.window ? o.window[0] : o.at)
  const sibs = [...ctx.CHG.values()].filter(o => o.video === c.video && o !== c)
  const known = (o: ObsChange) => Lcap == null || o.at <= clock.snapTime(L)
  const nextCh = sibs.filter(o => o.at > c.at && known(o)).sort((a, b) => kOfNext(a) - kOfNext(b))[0] ?? null
  const nextTxt = nextCh && kOfNext(nextCh) <= k + 7
    ? 'O vídeo foi trocado de novo dentro dos 7 dias depois (' + nextCh.typeLabel + ' mudou ' + (nextCh.prec === 'min' ? 'em ' : '') + nextCh.whenText + '): a leitura mistura duas versões.'
    : null
  const nextShort = nextTxt ? 'o vídeo foi trocado de novo dentro dos 7 dias depois' : null
  // R116: the days before start at the previous change of the same video. With 3+ clean days the reading uses them (peers are
  // measured with the same number, as they already are); with 2 or fewer it is 'antes-curto'. 'sem-antes' stays a statement
  // about the video's own series, so cleanBefore never feeds it.
  const simul = c.sameWindow.length ? 'same' : c.within48h.length ? '48h' : null
  const verNow = (c.type === 'title' ? v.titles : c.type === 'thumb' ? v.thumbs : v.descs)[c.idx]
  const shortVer = (!!verNow && !verNow.current && verNow.last_seen - verNow.first_seen < DAY) || (c.prevLivedMs != null && c.prevLivedMs < DAY)
  const prevCh = sibs.filter(o => o.at < c.at).sort((a, b) => b.at - a.at)[0] ?? null
  const cleanBefore = prevCh ? Math.max(0, (k - 1) - clock.snapIdxAtOrAfter(prevCh.at)) : null
  const cutByPrev = cleanBefore != null && cleanBefore < seriesBefore
  // prevOnly: the previous change is the ONLY thing wrong. Then the reading reports the clean days and gives no numbers (a ratio
  // over 0-2 days is not a measure). When an older rule already makes it inconclusive (simultaneous, short version, next change),
  // that rule keeps its kind and its numbers as before.
  const prevOnly = !!prevCh && cutByPrev && cleanBefore < RULES.effect.minBeforeDays && !simul && !nextTxt && !shortVer
  const beforeDays = cutByPrev && (cleanBefore >= RULES.effect.minBeforeDays || prevOnly) ? cleanBefore : seriesBefore
  const prevTxt = prevOnly ? 'Dias entre a troca anterior do vídeo (' + prevCh.typeLabel + ') e esta: ' + cleanBefore + '. Pouco para comparar.' : null
  const prevShort = prevTxt ? 'outra troca do vídeo poucos dias antes desta' : null
  if (beforeDays !== seriesBefore) res.beforeCutBy = 'troca-anterior'
  Object.assign(res, { k, beforeDays, afterDays, readyOn: clock.snapTime(k + 7), readyText: null, readyTextIfPending, firstPointAfter: clock.snapTime(k) })
  const dRow = (i: number): DailyRow => ({ idx: i + 1, from: pointTime(ctx, v, i), to: pointTime(ctx, v, i + 1), vpd: rate(ctx, v, i, i + 1) })
  res.daily = {
    before: Array.from({ length: beforeDays }, (_, j) => dRow(k - 1 - beforeDays + j)),
    changeDay: k >= 1 && k - 1 >= earliestIdx(v, ctx.ds.seriesStart) ? dRow(k - 1) : null,
    after: Array.from({ length: afterDays }, (_, j) => dRow(k + j)),
  }
  const simulTxt = simul === 'same' ? 'Dois campos do mesmo vídeo mudaram na mesma janela de sincronização: o efeito é dos dois e não dá para separar.'
    : simul === '48h' ? 'Outro campo do mesmo vídeo mudou a menos de 48 h: não dá para separar o efeito de cada um.' : null
  if (seriesBefore === 0) return done({ status: 'sem-antes', label: 'sem base', reason: 'A versão anterior durou menos de 1 dia, antes do primeiro registro diário: sem dias antes para comparar.' })
  if (afterDays < 7) {
    const shortWhy = simul === 'same' ? 'dois campos do vídeo mudaram na mesma janela de sincronização' : simul === '48h' ? 'outro campo do vídeo mudou a menos de 48 h' : nextShort ?? prevShort ?? (beforeDays <= 2 ? 'só ' + fmt.plural(beforeDays, 'dia', 'dias') + ' antes da troca' : null)
    return done({ readyText: readyTextIfPending, status: 'aguardando', label: 'aguardando', collected: afterDays,
      reason: 'aguardando — ' + afterDays + ' de 7 dias coletados, leitura em ' + clock.dm(clock.snapTime(k + 7)),
      willBeInconclusive: simulTxt || nextTxt || prevTxt || (beforeDays <= 2 ? 'Antes: ' + beforeDays + (beforeDays === 1 ? ' dia' : ' dias') + ' — pouco para comparar.' : null),
      willBeInconclusiveShort: shortWhy,
      waitText: 'Aguardando: ' + afterDays + ' de 7 dias coletados, ' + readyTextIfPending + '.' + (shortWhy ? ' Vai sair inconclusivo: ' + shortWhy + '.' : '') })
  }
  if (prevTxt) return done({ inconclusiveKind: 'antes-curto', status: 'inconclusivo', label: 'inconclusivo', reason: prevTxt })
  const ob = ratioAt(ctx, v, k, beforeDays, L)
  // PRODUCTION GUARD (not in dados.js, whose fixture has no holes): a day without a daily record
  // around the change makes the ratio uncomputable. Say so; never crash, never invent.
  if (!ob) return done({ status: 'inconclusivo', inconclusiveKind: 'outro', label: 'inconclusivo', reason: 'Faltam registros diários em volta da troca: não dá para medir.' })
  const ageAtK = (clock.snapTime(k) - v.pub) / DAY, band = bandOf(Math.floor(ageAtK))
  const sameDay = fromDayZero(ctx, v)
  const peers = ctx.CH.get(v.ch)!.videos.filter(u => u !== v && u.tracked && u.fmt === v.fmt && u.series.length > 0 && !changedSince(ctx, u))
  const byBand = (): number[] => {
    const out: number[] = []
    for (const u of peers) {
      let best: number | null = null
      for (let ku = firstRealIdx(u) + beforeDays + 1; ku + 7 <= L; ku++) {
        const a = Math.floor((clock.snapTime(ku) - u.pub) / DAY); if (bandOf(a) !== band) continue
        if (best == null || Math.abs(a - ageAtK) < Math.abs(Math.floor((clock.snapTime(best) - u.pub) / DAY) - ageAtK)) best = ku
      }
      if (best != null) { const x = ratioAt(ctx, u, best, beforeDays, L); if (x) out.push(x.r) }
    }
    return out
  }
  let rs: number[] = [], methodUsed: 'mesmo dia de vida' | 'aproximação por faixa' = 'aproximação por faixa', sameDayN: number | null = null
  if (sameDay) {
    for (const u of peers) { if (!fromDayZero(ctx, u)) continue; const x = ratioAt(ctx, u, u.firstIdx! + (k - v.firstIdx!), beforeDays, L); if (x) rs.push(x.r) }
    sameDayN = rs.length
    if (rs.length >= RULES.weakBase) methodUsed = 'mesmo dia de vida'; else rs = byBand()
  } else rs = byBand()
  const n = rs.length, exp = median(rs), q1 = quant(rs, 0.25), q3 = quant(rs, 0.75)
  res.noBaseText = n === 0 ? 'sem base de comparação: nenhum outro vídeo do canal na faixa ' + band.label + ' (n = 0)' : null
  const eff = exp == null ? null : (ob.r - exp) * 100
  const fallback = sameDay && methodUsed !== 'mesmo dia de vida'
  Object.assign(res, { observed: ob.r, beforeAvg: ob.rb, afterAvg: ob.ra, expected: exp, iqr: [q1, q3], n, effectPp: eff, band: band.label,
    method: methodUsed, methodLabel: 'método: ' + methodUsed, methodFallback: fallback, sameDayN,
    fallbackText: fallback ? 'método: aproximação por faixa — menos de 3 vídeos do canal com série desde o dia 0' : null,
    numbers: 'observado ' + fmt.pct(ob.r) + ' · esperado ' + fmt.pct(exp) + ' (n = ' + n + ')',
    numbersFlat: 'observado ' + fmt.pct(ob.r) + ' · esperado ' + fmt.pct(exp) + ' · n = ' + n })
  const arr = c.type === 'title' ? v.titles : c.type === 'thumb' ? v.thumbs : v.descs
  const nextVer = arr[c.idx]!
  if (!nextVer.current && nextVer.last_seen - nextVer.first_seen < DAY) return done({ inconclusiveKind: 'versao-curta', status: 'inconclusivo', label: 'inconclusivo', reason: 'A nova versão ficou menos de 1 dia no ar (' + clock.dur(nextVer.last_seen - nextVer.first_seen) + '): com um registro de views por dia não dá para isolar.' })
  if (c.prevLivedMs != null && c.prevLivedMs < DAY) return done({ inconclusiveKind: 'versao-curta', status: 'inconclusivo', label: 'inconclusivo', reason: 'A versão anterior ficou menos de 1 dia no ar (' + clock.dur(c.prevLivedMs) + '): pouco para comparar.' })
  if (simulTxt) return done({ inconclusiveKind: 'janela-dupla', status: 'inconclusivo', label: 'inconclusivo', reason: simulTxt })
  if (nextTxt) return done({ inconclusiveKind: 'troca-seguinte', status: 'inconclusivo', label: 'inconclusivo', reason: nextTxt })
  if (beforeDays <= 2) return done({ inconclusiveKind: 'antes-curto', status: 'inconclusivo', label: 'inconclusivo', reason: 'Antes: ' + beforeDays + (beforeDays === 1 ? ' dia' : ' dias') + ' — pouco para comparar.' })
  if (n < RULES.effect.minN || eff == null) return done({ inconclusiveKind: 'outro', status: 'inconclusivo', label: 'inconclusivo', reason: 'Poucos vídeos do canal para comparar (n = ' + n + ', mínimo ' + RULES.effect.minN + ').' })
  const out = ob.r < q1! || ob.r > q3!, band_ = '(' + fmt.pct(q1) + ' a ' + fmt.pct(q3) + ')'
  if (eff > RULES.effect.pp && out) return done({ status: 'ganhou', label: 'ganhou', reason: 'Efeito ' + fmt.pp(eff) + ': acima de +10 pp e fora da faixa normal ' + band_ + '.' })
  if (eff < -RULES.effect.pp && out) return done({ status: 'perdeu', label: 'perdeu', reason: 'Efeito ' + fmt.pp(eff) + ': abaixo de −10 pp e fora da faixa normal ' + band_ + '.' })
  const small = Math.abs(eff) < RULES.effect.pp
  return done({ status: 'neutro', label: 'neutro', neutralWhy: small && !out ? 'ambos' : small ? 'menor-que-10pp' : 'dentro-da-faixa',
    reason: 'Efeito ' + fmt.pp(eff) + ': ' + (small && !out ? 'abaixo de 10 pp e dentro da faixa normal ' + band_
      : small ? 'fora da faixa normal ' + band_ + ', mas abaixo de 10 pp'
      : 'acima de 10 pp, mas dentro da faixa normal ' + band_) + '.' })
}
