/**
 * TEST fixture — port of the mockup's request generator (REQ_SCENARIOS + requestScenario's request building,
 * dados.js:1450-1621). It only BUILDS raw requests (the rows a DB would hold, plus the queue relationship the
 * generator knows). Everything shown — labels, lines, texts, quota, order, terminal — is computed by PRODUCTION code
 * (forja/states.ts summarize). Production requests come from the DB (Task 30); this generator never ships.
 */
import type { ForjaRequest, Niche, RequestState } from '@/lib/youtube/observatorio/types'
import type { ScenarioEnv, ScenarioTarget, TestScenarios } from '@/lib/youtube/observatorio'
import { NICHES } from '@/lib/youtube/observatorio/rules'
import { machineOf, ACTIVE_STATES, FORJA_QUEUE } from '@/lib/youtube/observatorio/forja/states'
import { scenarioReadings } from './forja-scenario-readings'

export const SHOWCASE = 'matt-opus55'
type Attempt = NonNullable<ForjaRequest['attempts']>[number]
interface Sc {
  createdAt: number; claimedAt?: number | null; publishedAt?: number | null; releasedAt?: number | null; failedAt?: number | null; refusedAt?: number | null
  busySince?: number | null; busyWith?: string | null; lastPollAt?: number; attempt?: number; status: string; quota: number; releasedBy?: string
  retryReason?: string; failReason?: string; refusedReason?: string; refusedDataAsOf?: number; attempts?: Attempt[] | null
}
const TIME_KEYS = ['claimedAt', 'startedAt', 'publishedAt', 'releasedAt', 'failedAt', 'refusedAt', 'busySince'] as const

export function forjaScenarios(env: ScenarioEnv): TestScenarios {
  const { clock } = env
  const NOW = clock.now
  const T = (h: number, mi: number) => clock.sp(2026, 10, 24, h, mi)
  const REQ_SCENARIOS: Record<RequestState, Sc> = {
    'na fila': { createdAt: T(14, 58), status: 'pending', quota: 1 },
    'trabalhando': { createdAt: T(14, 41), claimedAt: T(14, 45), status: 'running', quota: 1 },
    'publicado': { createdAt: T(14, 31), claimedAt: T(14, 35), publishedAt: T(14, 50), status: 'completed', quota: 1 },
    'atrasado': { createdAt: T(14, 33), status: 'pending', quota: 1, busyWith: 'outro pedido em andamento desde 14:35', busySince: T(14, 35) },
    'sem máquina': { createdAt: T(14, 48), status: 'pending', quota: 1, lastPollAt: T(12, 55) },
    'nova tentativa': { createdAt: T(14, 42), claimedAt: T(14, 45), releasedAt: T(14, 57), attempt: 2, status: 'pending', quota: 1, releasedBy: 'validador',
      retryReason: 'o validador recusou a tentativa 1 às 14:57 porque o texto citava um número que não estava nos dados enviados', attempts: [{ claimedAt: T(14, 45), endedAt: T(14, 57), result: 'recusada pelo validador' }] },
    'liberado pelo vigia': { createdAt: T(14, 5), claimedAt: T(14, 25), releasedAt: T(14, 56), attempt: 2, status: 'pending', quota: 1, releasedBy: 'vigia',
      retryReason: 'o vigia liberou o pedido às 14:56 porque a tentativa 1 passou de 30 min rodando', attempts: [{ claimedAt: T(14, 25), endedAt: T(14, 56), result: 'liberada pelo vigia (travou > 30 min)' }] },
    'falhou': { createdAt: T(13, 50), claimedAt: T(13, 55), failedAt: T(14, 21), attempt: 3, status: 'failed', quota: 0, failReason: 'o validador recusou a saída da forja nas 3 tentativas',
      attempts: [{ claimedAt: T(13, 55), endedAt: T(14, 2) }, { claimedAt: T(14, 5), endedAt: T(14, 11) }, { claimedAt: T(14, 15), endedAt: T(14, 21) }] },
    'recusado (dado velho)': { createdAt: T(14, 50), claimedAt: T(14, 55), refusedAt: T(14, 56), status: 'refused', quota: 0,
      refusedReason: 'a máquina recebeu dados de 23/10 18:00, anteriores à sincronização das 12:00. Peça de novo.',
      refusedDataAsOf: clock.sp(2026, 10, 23, 18, 0) },
  }
  const states = Object.keys(REQ_SCENARIOS) as RequestState[]
  const tick = FORJA_QUEUE.tickMinutes * 6e4, phase = 5 * 6e4
  const gen = scenarioReadings(clock, env.registerReading)
  const idOf = (target: Required<Pick<ScenarioTarget, 'type'>> & ScenarioTarget, n: Niche, state: string) =>
    'req-' + target.type + '-' + n + (target.video ? '-' + target.video : '') + '-' + state.replace(/\W+/g, '-')

  function build(state: string, target0?: ScenarioTarget): { requests: ForjaRequest[]; scopeTodos: boolean; machine: ReturnType<typeof machineOf> } | null {
    const sc0 = (REQ_SCENARIOS as Record<string, Sc>)[state]
    if (!sc0) return null
    const st = state as RequestState
    const target = { type: 'padroes-titulo', niche: 'ia' as ScenarioTarget['niche'], ...(target0 || {}) }
    let sc: Sc = sc0
    if (target.createdAt != null) {
      const d = target.createdAt - sc0.createdAt, sh = (x: number | null | undefined) => x == null ? x : x + d
      sc = { ...sc0, createdAt: target.createdAt, publishedAt: sh(sc0.publishedAt), releasedAt: sh(sc0.releasedAt), failedAt: sh(sc0.failedAt), refusedAt: sh(sc0.refusedAt), busySince: sh(sc0.busySince),
        attempts: sc0.attempts ? sc0.attempts.map(a => ({ ...a, claimedAt: a.claimedAt + d, endedAt: a.endedAt == null ? null : a.endedAt + d })) : null }
      if (sc0.claimedAt != null) {
        let c = sc0.claimedAt + d
        c = Math.ceil((c - phase) / tick) * tick + phase
        const dc = c - (sc0.claimedAt + d)
        sc.claimedAt = c
        for (const k of ['publishedAt', 'releasedAt', 'failedAt', 'refusedAt'] as const) { const v = sc[k]; if (v != null) sc[k] = v + dc }
      }
      if (sc0.busySince != null) sc.busyWith = 'outro pedido em andamento desde ' + clock.hm(sc.busySince!)
      if (sc0.retryReason) sc.retryReason = sc0.retryReason.replace(/\d\d:\d\d/, clock.hm(sc.releasedAt!))
    }
    const video = target.video || SHOWCASE
    const niches: Niche[] = target.type === 'leitura-video' ? [env.videoNiche(video)!] : target.niche === 'todos' || target.niche === 'all' ? ['ia', 'viagem'] : [target.niche as Niche]
    const requests: ForjaRequest[] = []
    niches.forEach((n, i) => {
      const off = 0 // with Todos the two requests are born together
      const rq: ForjaRequest = {
        id: idOf(target, n, st), scenario: true, type: target.type, niche: n,
        target: target.type === 'leitura-video' ? { kind: 'video', video } : { kind: 'niche', niche: n, fmt: target.fmt || (target.type === 'padroes-titulo-shorts' ? 'short' : 'long') },
        state: st, status: sc.status, attempt: sc.attempt || 1, maxAttempts: FORJA_QUEUE.maxAttempts,
        createdAt: sc.createdAt + off, claimedAt: sc.claimedAt != null ? sc.claimedAt + off : null, startedAt: sc.claimedAt != null ? sc.claimedAt + off : null,
        publishedAt: sc.publishedAt != null ? sc.publishedAt + off : null, releasedAt: sc.releasedAt || null, releasedBy: sc.releasedBy || null,
        failedAt: sc.failedAt || null, failReason: sc.failReason || null, attempts: sc.attempts || null,
        refusedAt: sc.refusedAt || null, refusedReason: sc.refusedReason || null, refusedDataAsOf: sc.refusedDataAsOf || null, busyWith: sc.busyWith || null, busySince: sc.busySince || null, retryReason: sc.retryReason || null,
        waitingMinutes: sc.status === 'pending' ? Math.round((NOW - (sc.releasedAt || sc.createdAt + off)) / 6e4) : null, readingId: null,
      }
      if (i > 0 && ((ACTIVE_STATES as readonly string[]).includes(st) || st === 'publicado')) {
        // the machine takes one request per poll: the 2nd waits behind the 1st
        Object.assign(rq, { attempt: 1, releasedAt: null, releasedBy: null, retryReason: null, attempts: null, busyWith: null, busySince: null, behind: idOf(target, niches[0]!, st) })
        if (st === 'publicado') {
          const c = Math.ceil((sc.publishedAt! - phase) / tick) * tick + phase
          Object.assign(rq, { state: 'trabalhando', status: 'running', claimedAt: c, startedAt: c, publishedAt: null, waitingMinutes: null, behind: null, behindAfter: idOf(target, niches[0]!, st) })
        } else {
          const w = Math.round((NOW - rq.createdAt) / 6e4), dead = sc.lastPollAt && NOW - sc.lastPollAt > FORJA_QUEUE.HEARTBEAT_DEAD_MINUTES * 6e4
          Object.assign(rq, { state: dead ? 'sem máquina' : w > FORJA_QUEUE.LATE_AFTER_MINUTES ? 'atrasado' : 'na fila', stateNote: 'atrás do de ' + NICHES[niches[0]!].label, status: 'pending', claimedAt: null, startedAt: null, publishedAt: null, waitingMinutes: w })
        }
      } else if (i > 0 && (st === 'falhou' || st === 'recusado (dado velho)')) {
        // the 2nd is processed after the 1st: never in the same minute
        const sh = (st === 'falhou' ? 30 : 10) * 6e4, mv = (x: number | null | undefined) => x == null ? null : x + sh
        Object.assign(rq, { claimedAt: mv(rq.claimedAt), startedAt: mv(rq.startedAt), failedAt: mv(rq.failedAt), refusedAt: mv(rq.refusedAt),
          attempts: rq.attempts ? rq.attempts.map(a => ({ ...a, claimedAt: a.claimedAt + sh, endedAt: a.endedAt == null ? null : a.endedAt + sh })) : null })
        if ([rq.claimedAt, rq.failedAt, rq.refusedAt].some(x => x != null && x > NOW)) // its turn has not come yet: still queued behind the 1st
          Object.assign(rq, { state: 'na fila', status: 'pending', stateNote: 'atrás do de ' + NICHES[niches[0]!].label, behind: idOf(target, niches[0]!, st), claimedAt: null, startedAt: null, failedAt: null, refusedAt: null, refusedReason: null, refusedDataAsOf: null, failReason: null, attempts: null, attempt: 1, waitingMinutes: Math.round((NOW - rq.createdAt) / 6e4) })
      }
      // nothing after NOW: a derived instant in the future becomes an explicit forecast and the field stays null
      rq.forecast = null
      for (const k of TIME_KEYS) { const v = rq[k]; if (v != null && v > NOW) { (rq.forecast = rq.forecast || {})[k] = v; rq[k] = null } }
      if (rq.attempts) rq.attempts = rq.attempts.filter(a => a.claimedAt <= NOW).map(a => a.endedAt != null && a.endedAt > NOW ? { ...a, endedAt: null, endedAtForecast: a.endedAt } : a)
      if (rq.publishedAt == null) rq.readingId = null
      else if (rq.readingId == null && i === 0 && sc.publishedAt) rq.readingId = gen.readingFor(target.type, n, sc.publishedAt + off, target.video || (target.type === 'leitura-video' ? SHOWCASE : null)).id
      requests.push(rq)
    })
    return { requests, scopeTodos: !!(target0 && (target0.niche === 'todos' || target0.niche === 'all')), machine: machineOf(sc.lastPollAt || env.lastPollAt, clock) }
  }
  // scenario readings of 24/10 exist from load (dados.js:1630-1632)
  for (const n of ['ia', 'viagem'] as const) for (const t of ['padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas']) build('publicado', { type: t, niche: n })
  build('publicado', { type: 'leitura-video', video: SHOWCASE })
  return { requestStates: states, build, showcase: SHOWCASE, scenarioReadings: gen.readings }
}

