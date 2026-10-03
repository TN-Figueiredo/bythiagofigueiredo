/**
 * The forja quota: 1 request per niche + type per São Paulo day (CONVENCOES; FORJA_QUEUE.quotaScope).
 * A failure or a refusal does not count — the niche can be asked again the same day.
 */
import type { Clock } from '../time'
import type { ForjaRequest, Niche } from '../types'
import { FORJA_QUEUE, nextSpMidnight } from './states'

export interface QuotaStatus { free: boolean; usedToday: number; releasesAt: number; text: string }

export function quotaFor(requests: ForjaRequest[], type: string, niche: Niche, now: number, clock: Clock): QuotaStatus {
  const releasesAt = nextSpMidnight(now, clock), dayStart = releasesAt - 864e5
  const today = requests.filter(q => q.type === type && q.niche === niche && q.createdAt >= dayStart && q.createdAt < releasesAt)
  const used = today.filter(q => q.state !== 'falhou' && q.state !== 'recusado (dado velho)')
  const free = used.length < FORJA_QUEUE.quotaPerDayPerType
  const failed = today.some(q => q.state === 'falhou'), refused = today.some(q => q.state === 'recusado (dado velho)')
  const why = failed && refused ? FORJA_QUEUE.quotaNote : failed ? 'falha não conta na cota' : refused ? 'recusa não conta na cota' : FORJA_QUEUE.quotaNote
  return {
    free, usedToday: used.length, releasesAt,
    text: free ? 'cota de hoje livre (' + why + ')' : 'cota de hoje usada; libera ' + clock.weekday(releasesAt) + ', ' + clock.dm(releasesAt) + ' às 00:00',
  }
}
