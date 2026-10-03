/**
 * The forja quota: 1 request per niche + type per São Paulo day (CONVENCOES; FORJA_QUEUE.quotaScope).
 * A failure or a refusal does not count — the niche can be asked again the same day. An active request blocks the niche
 * whatever day it was asked (the planner refuses a second one), so the quota agrees with the button.
 */
import type { Clock } from '../time'
import type { ForjaRequest, Niche } from '../types'
import { FORJA_QUEUE, isActive, nextSpMidnight } from './states'

const isVid = (t: string) => t === 'leitura-video'
const vidOf = (q: ForjaRequest) => q.video ?? q.target.video ?? null

/**
 * The planner's view of what exists: active requests (any day) plus today's (SP) finished ones, the latest per
 * (type, niche, video). History of past days never counts; an active request never stops counting.
 */
export function liveRequests(requests: ForjaRequest[], now: number, clock: Clock): ForjaRequest[] {
  const dayStart = nextSpMidnight(now, clock) - 864e5
  const latest = new Map<string, ForjaRequest>()
  for (const q of [...requests].sort((a, b) => a.createdAt - b.createdAt))
    if (isActive(q) || q.createdAt >= dayStart) latest.set(q.type + '|' + q.niche + '|' + (isVid(q.type) ? vidOf(q) : ''), q)
  return [...latest.values()]
}

export interface QuotaStatus { free: boolean; usedToday: number; releasesAt: number | null; text: string }

export function quotaFor(requests: ForjaRequest[], type: string, niche: Niche, now: number, clock: Clock): QuotaStatus {
  const midnight = nextSpMidnight(now, clock), dayStart = midnight - 864e5
  const mine = liveRequests(requests, now, clock).filter(q => q.type === type && q.niche === niche)
  // an active request asked on an earlier day: the niche is busy until it ends, not until midnight
  const older = mine.find(q => isActive(q) && q.createdAt < dayStart)
  if (older) return { free: false, usedToday: 0, releasesAt: null, text: 'cota usada pelo pedido de ' + clock.dm(older.createdAt) + ' ' + clock.hm(older.createdAt) + ', ainda em andamento' }
  const today = requests.filter(q => q.type === type && q.niche === niche && q.createdAt >= dayStart && q.createdAt < midnight)
  const used = mine.filter(q => q.state !== 'falhou' && q.state !== 'recusado (dado velho)')
  const free = used.length < FORJA_QUEUE.quotaPerDayPerType
  const failed = today.some(q => q.state === 'falhou'), refused = today.some(q => q.state === 'recusado (dado velho)')
  const why = failed && refused ? FORJA_QUEUE.quotaNote : failed ? 'falha não conta na cota' : refused ? 'recusa não conta na cota' : FORJA_QUEUE.quotaNote
  return {
    free, usedToday: used.length, releasesAt: midnight,
    text: free ? 'cota de hoje livre (' + why + ')' : 'cota de hoje usada; libera ' + clock.weekday(midnight) + ', ' + clock.dm(midnight) + ' às 00:00',
  }
}
