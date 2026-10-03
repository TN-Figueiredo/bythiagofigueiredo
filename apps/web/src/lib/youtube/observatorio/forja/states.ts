/**
 * Forja requests: states, canonical status texts, the single queue order and compose.
 * Port of dados.js:1433-1449 (queue rules), 1537-1620 (requestScenario's summarising half), 1633-1687 (againText,
 * queueOrder, compose, aheadNote) and 1826-1864 (withQuota, summarize). The request GENERATOR of the mockup
 * (REQ_SCENARIOS) is test fixture code; here every request comes in as data (DB rows mapped by requestStateOf).
 *
 * Two text systems exist in the mockup and both are canonical (CONVENCOES "statusLines/statusText"):
 *  - `summarize` — the texts of `requestScenario`: what the header says about requests as they stand;
 *  - `resummarize` — the texts of the mockup's `summarize`: what it says after the session edited the list
 *    (a new ask composed on top, a cancel, a queue suffix added). `compose` uses the same sentences.
 */
import { FORJA_TICK_MINUTES, LATE_AFTER_MINUTES, UNSERVED_AFTER_HOURS, MAX_ATTEMPTS, STALE_AFTER_MINUTES } from '../../analysis-progress'
import { DAY, type Clock } from '../time'
import { NICHES } from '../rules'
import type { ForjaRequest, Fmt, Niche, RequestState } from '../types'

const MIN = 6e4, HOUR = 36e5

/** The queue rules (CONVENCOES "Fila"). Timing constants come from analysis-progress.ts, never duplicated. */
export const FORJA_QUEUE = {
  LATE_AFTER_MINUTES, UNSERVED_AFTER_HOURS, STALE_RUNNING_MINUTES: STALE_AFTER_MINUTES,
  /** No poll for more than 3 ticks: the machine is gone. */
  HEARTBEAT_DEAD_MINUTES: 3 * FORJA_TICK_MINUTES,
  quotaPerDayPerType: 1, maxAttempts: MAX_ATTEMPTS, tickMinutes: FORJA_TICK_MINUTES,
  quotaNote: 'falha e recusa não contam na cota',
  quotaScope: { perType: true, perNiche: true, text: '1 pedido por dia por tipo e por nicho (Viagem e IA separados). Com nicho Todos, o pedido vira um por nicho. Falha e recusa não contam na cota.' },
} as const

/** Every state a request can be in, in the mockup's order (REQ_SCENARIOS keys). */
export const REQUEST_STATES: readonly RequestState[] = ['na fila', 'trabalhando', 'publicado', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia', 'falhou', 'recusado (dado velho)']
/** `forja.states` of the mockup (dados.js:1436): the eight states the screens list. */
export const STATES: readonly RequestState[] = ['na fila', 'trabalhando', 'publicado', 'atrasado', 'sem máquina', 'nova tentativa', 'falhou', 'recusado (dado velho)']
export const ACTIVE_STATES: readonly RequestState[] = ['na fila', 'trabalhando', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia']
export const TERMINAL_STATES: readonly RequestState[] = ['publicado', 'falhou', 'recusado (dado velho)']
const NO_QUOTA: readonly RequestState[] = ['falhou', 'recusado (dado velho)']
export const isActive = (q: { state: RequestState }): boolean => ACTIVE_STATES.includes(q.state)
const isTerm = (q: { state: RequestState }) => TERMINAL_STATES.includes(q.state)
const label = (n: Niche) => NICHES[n].label

export interface Machine { lastPollAt: number | null; alive: boolean; tickMinutes: number; nextPollAt: number | null; text: string }
export interface Quota {
  usedToday: number; perTypePerNiche: number; note: string; releasesAt: number | null; text: string
  byNiche?: Partial<Record<Niche, { free: boolean; text: string }>>
}
export interface BlockedBy { video: string; title: string; statusLabel: string; reason: string }
export interface MachineBusy { type: string; niche: Niche; video: string | null; since: number | null }
export interface Scenario {
  state: RequestState | 'sem pedido'
  requests: ForjaRequest[]; request: ForjaRequest | null; statusLines: string[] | null; statusLabel: string | null; statusText: string
  split: boolean; active: boolean; anyActive: boolean; terminal: boolean; future?: boolean; forecast?: Array<ForjaRequest['forecast']> | null
  empty?: boolean; composed?: boolean
  quota: Quota; machine: Machine
  /** Session views (session.ts). */
  niche?: Niche | 'todos' | 'all' | null; type?: string; video?: string | null; blockedBy?: BlockedBy | null; machineBusy?: MachineBusy | null
}

/** The machine as the header shows it (dados.js:1614-1615). With no heartbeat ever, it is dead. */
export function machineOf(lastPollAt: number | null, clock: Clock, tickMinutes: number = FORJA_TICK_MINUTES): Machine {
  if (lastPollAt == null) return { lastPollAt: null, alive: false, tickMinutes, nextPollAt: null, text: 'Nenhuma consulta da máquina registrada' }
  const alive = clock.now - lastPollAt <= FORJA_QUEUE.HEARTBEAT_DEAD_MINUTES * MIN
  return { lastPollAt, nextPollAt: lastPollAt + tickMinutes * MIN, alive, tickMinutes,
    text: (alive ? 'Máquina ativa (última consulta ' : 'Sem consulta da máquina desde ' + clock.hm(lastPollAt) + ' (') + clock.ago(lastPollAt) + ')' }
}

export interface TaskRow {
  status: string; retry_count: number; requested_at: string; started_at: string | null; completed_at: string | null
  failed_at: string | null; refused_at: string | null; released_at: string | null
}
/**
 * The state of a `youtube_intelligence_tasks` row. "sem máquina": no poll for > 3 ticks (or none ever), or waiting
 * for more than UNSERVED_AFTER_HOURS; "atrasado": the machine is alive but the request waited > LATE_AFTER_MINUTES.
 */
export function requestStateOf(task: TaskRow, machine: { lastPollAt: number | null }, now: number): RequestState {
  switch (task.status) {
    case 'completed': return 'publicado'
    case 'failed': case 'stale': return 'falhou'
    case 'refused': return 'recusado (dado velho)'
    case 'running': return 'trabalhando'
    case 'pending': {
      const requested = Date.parse(task.requested_at)
      const dead = machine.lastPollAt == null || now - machine.lastPollAt > FORJA_QUEUE.HEARTBEAT_DEAD_MINUTES * MIN
      if (dead || now - requested >= UNSERVED_AFTER_HOURS * HOUR) return 'sem máquina'
      if (task.retry_count > 0) {
        // Ruling R27: released_at is sticky — the vigia's release only names the state when it is newer than the
        // row's last failure (a validator retry after a release is a "nova tentativa").
        const released = task.released_at ? Date.parse(task.released_at) : null, failed = task.failed_at ? Date.parse(task.failed_at) : null
        return released != null && (failed == null || released > failed) ? 'liberado pelo vigia' : 'nova tentativa'
      }
      return now - requested >= LATE_AFTER_MINUTES * MIN ? 'atrasado' : 'na fila'
    }
    default: throw new Error('requestStateOf: unknown task status ' + JSON.stringify(task.status))
  }
}

/* The single queue (one machine): short type names and the "atrás de" phrase across types (dados.js:1680-1687). */
export const TYPE_SHORT: Record<string, string> = { 'padroes-titulo': 'padrões de título', 'padroes-titulo-shorts': 'padrões de título de Shorts', 'temas': 'temas', 'resumo-trocas': 'resumo das trocas', 'leitura-video': 'leitura de vídeo' }
export function aheadNote(ahead: Pick<ForjaRequest, 'type' | 'niche'>, me: Pick<ForjaRequest, 'type'> | null): string {
  const tA = ahead.type || 'padroes-titulo', tM = (me && me.type) || 'padroes-titulo'
  if (tA === tM && tA !== 'leitura-video') return 'atrás do de ' + label(ahead.niche)
  if (tA === 'leitura-video' && tM === 'leitura-video') return 'atrás do pedido de leitura de outro vídeo'
  return 'atrás do pedido de ' + TYPE_SHORT[tA] + ' de ' + label(ahead.niche)
}
/** "O pedido de Viagem segue na fila desde 14:50. A recusa de IA não conta na cota; você pode pedir de novo a de IA agora." (F10) */
export function againText(active: ForjaRequest, done: ForjaRequest, clock: Clock): string {
  const na = label(active.niche), nd = label(done.niche)
  return 'O pedido de ' + na + ' segue ' + (active.state === 'trabalhando' ? 'em andamento desde ' + hmLoose(clock, active.claimedAt) : 'na fila desde ' + clock.hm(active.createdAt))
    + '. A ' + (done.state === 'falhou' ? 'falha' : 'recusa') + ' de ' + nd + ' não conta na cota; você pode pedir de novo a de ' + nd + ' agora.'
}
/** The mockup formats a missing instant like JS formats `null` (epoch). Kept only where the mockup can reach it. */
const hmLoose = (clock: Clock, ms: number | null | undefined) => clock.hm(ms ?? 0)

type TimeKey = 'createdAt' | 'claimedAt' | 'publishedAt' | 'failedAt' | 'refusedAt'
const hmOr = (q: ForjaRequest, k: TimeKey, clock: Clock): string => {
  const v = q[k]
  if (v != null) return clock.hm(v)
  const f = k === 'createdAt' ? undefined : q.forecast?.[k]
  return f != null ? clock.hm(f) + ' (previsto)' : '—'
}
const WAITING_FOR_NOTE: readonly RequestState[] = ['na fila', 'atrasado', 'sem máquina']
/**
 * The header label, ONLY in the CONVENCOES line-218 format ("na fila · pedido 14:58", "trabalhando desde 14:45", …),
 * with the hour of the event it names. `ahead` derives the queue suffix; otherwise the request's own `stateNote` is used.
 */
export function statusLabel(q: ForjaRequest, clock: Clock, o: { machine: Pick<Machine, 'lastPollAt' | 'nextPollAt'>; prefixNiche?: boolean; ahead?: ForjaRequest | null }): string {
  const noteText = o.ahead && WAITING_FOR_NOTE.includes(q.state) ? aheadNote(o.ahead, q) : q.stateNote
  const note = noteText ? ' (' + noteText + ')' : ''
  const at = (ms: number | null) => ms == null ? '—' : clock.hm(ms)
  let s: string
  switch (q.state) {
    case 'na fila': s = 'na fila · pedido ' + clock.hm(q.createdAt) + note; break
    case 'trabalhando': s = 'trabalhando desde ' + hmOr(q, 'claimedAt', clock); break
    case 'atrasado': s = 'atrasado · pedido ' + clock.hm(q.createdAt) + note; break
    case 'sem máquina': s = 'sem máquina desde ' + at(o.machine.lastPollAt) + note; break
    case 'nova tentativa': s = 'nova tentativa · ' + at(o.machine.nextPollAt); break
    case 'liberado pelo vigia': s = 'liberado pelo vigia · ' + at(o.machine.nextPollAt); break
    case 'publicado': s = q.publishedAt ? 'publicado às ' + clock.hm(q.publishedAt) : 'publicação prevista às ' + hmOr(q, 'publishedAt', clock).replace(' (previsto)', ''); break
    case 'falhou': s = 'falhou às ' + hmOr(q, 'failedAt', clock); break
    case 'recusado (dado velho)': s = 'recusado às ' + hmOr(q, 'refusedAt', clock); break
    default: s = q.state
  }
  return (o.prefixNiche ? label(q.niche) + ': ' : '') + s
}

/** Queue order (stable): active requests by createdAt (the one in front first), then the finished ones (dados.js:1639). */
export function queueOrder(reqs: ForjaRequest[]): ForjaRequest[] {
  const idx = new Map(reqs.map((q, i) => [q, i]))
  const act = (q: ForjaRequest) => (isActive(q) ? 1 : 0)
  return [...reqs].sort((a, b) => (act(b) - act(a))
    || (act(a) ? (a.createdAt - b.createdAt) || ((a.seq != null && b.seq != null) ? a.seq - b.seq : 0) || ((a.behind ? 1 : 0) - (b.behind ? 1 : 0)) : 0)
    || (idx.get(a)! - idx.get(b)!))
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
/**
 * Refusal codes the forja sends (POST …/task/<id>/refuse stores the short code in `refused_reason`) → the canonical
 * sentence. Anything else is shown as written (the test scenarios carry full sentences).
 */
export const REFUSED_REASON_TEXT: Readonly<Record<string, string>> = {
  'dado-velho': 'a máquina recebeu dados anteriores à última sincronização. Peça de novo.',
}
export function refusedReasonText(reason: string | null | undefined): string | null {
  if (reason == null) return null
  return Object.prototype.hasOwnProperty.call(REFUSED_REASON_TEXT, reason) ? REFUSED_REASON_TEXT[reason]! : reason
}
/** What a failure was: the validator refused every attempt, the vigia released it every time ('travou-3x'), or another code. */
export type FailKind = 'validador' | 'travou' | 'outro'
export const failKindOf = (q: Pick<ForjaRequest, 'failReason'>): FailKind =>
  q.failReason && /validador/i.test(q.failReason) ? 'validador' : q.failReason && /^travou-3x\b/.test(q.failReason) ? 'travou' : 'outro'
/**
 * The canonical failure sentence, driven by the failure reason. `n` names the niche (Todos); without it, the one-niche form.
 * The validator text is the mockup's; 'travou-3x' and other codes are the DB-shaped branches (fix round 1).
 */
export function failText(q: ForjaRequest, clock: Clock, n?: string): string {
  switch (failKindOf(q)) {
    case 'validador': return (n ? 'O pedido de ' + n + ' falhou' : 'Falhou') + ' nas ' + q.attempt + ' tentativas. O validador recusou a saída em todas. Falha não conta na cota.'
    case 'travou': return 'O pedido' + (n ? ' de ' + n : '') + ' travou nas ' + q.attempt + ' tentativas: o vigia liberou e a máquina não terminou. Falha não conta na cota.'
    default: return 'O pedido' + (n ? ' de ' + n : '') + ' falhou às ' + hmOr(q, 'failedAt', clock) + ' (' + (q.failReason ? 'código ' + q.failReason : 'sem código') + '). Falha não conta na cota.'
  }
}
const waitingOf = (q: ForjaRequest, now: number) => q.waitingMinutes ?? Math.round((now - (q.releasedAt || q.createdAt)) / MIN)

/**
 * The canonical status text of requests as they stand (port of requestScenario's text branches, dados.js:1541-1589).
 * `reqs` in creation order: the first is the lead the sentence is about; the others follow it.
 */
export function statusText(reqs: ForjaRequest[], machine: Machine, clock: Clock): string {
  const r0 = reqs[0]!, state = r0.state, split = reqs.length > 1
  const tick = machine.tickMinutes, lastPollAt = machine.lastPollAt, ord = r0.attempt + ' de ' + (r0.maxAttempts ?? MAX_ATTEMPTS)
  const nextPoll = machine.nextPollAt
  const at_ = (k: TimeKey) => hmOr(r0, k, clock)
  const ago = lastPollAt == null ? 'nenhuma' : clock.ago(lastPollAt)
  const w0 = waitingOf(r0, clock.now)
  const retry = r0.retryReason ? cap(r0.retryReason) + '.' : ''
  if (!split) {
    switch (state) {
      case 'na fila': return 'Na fila desde ' + clock.hm(r0.createdAt) + '. A máquina consulta a cada ' + tick + ' min (próxima às ' + hmLoose(clock, nextPoll) + ').'
      case 'trabalhando': return 'Trabalhando desde ' + (r0.claimedAt ? clock.hm(r0.claimedAt) : at_('claimedAt')) + '.'
      case 'publicado': return r0.publishedAt ? 'Leitura publicada às ' + clock.hm(r0.publishedAt) + '.' : 'Publicação prevista às ' + at_('publishedAt').replace(' (previsto)', '') + '.'
      case 'atrasado': return 'Máquina ativa (última consulta ' + ago + '), mas o pedido está na fila há ' + w0 + ' min — o limite é ' + LATE_AFTER_MINUTES + ' min.'
      case 'sem máquina': return 'Seu pedido das ' + clock.hm(r0.createdAt) + ' está na fila e roda quando a máquina voltar.'
      case 'nova tentativa': return ('Voltou para a fila (tentativa ' + ord + '). ' + retry).trim()
      case 'liberado pelo vigia': return 'O vigia liberou o pedido (travou > 30 min) — volta para a fila (tentativa ' + ord + ').'
      case 'falhou': return failText(r0, clock)
      case 'recusado (dado velho)': return r0.refusedReason ? cap(refusedReasonText(r0.refusedReason)!) : 'O pedido foi recusado às ' + hmOr(r0, 'refusedAt', clock) + '.'
    }
  }
  // Todos: the text agrees with the lines — each niche is cited with the state of its own line
  const nm = (q: ForjaRequest) => label(q.niche), others = reqs.filter(q => q !== r0), names = reqs.map(nm).join(' e ')
  // the plural only when every request failed the same canonical way (validator)
  const allValidatorFail = others.every(q => q.state === 'falhou') && reqs.every(q => failKindOf(q) === 'validador')
  const first = ({
    'na fila': 'Pedido de ' + nm(r0) + ' na fila desde ' + clock.hm(r0.createdAt) + '. A máquina consulta a cada ' + tick + ' min (próxima às ' + hmLoose(clock, nextPoll) + ').',
    'trabalhando': 'Pedido de ' + nm(r0) + ' em andamento desde ' + (r0.claimedAt ? clock.hm(r0.claimedAt) : at_('claimedAt')) + '.',
    'atrasado': 'Máquina ativa (última consulta ' + ago + '), mas o pedido de ' + nm(r0) + ' está na fila há ' + w0 + ' min — o limite é ' + LATE_AFTER_MINUTES + ' min.',
    'sem máquina': 'Seus pedidos das ' + clock.hm(r0.createdAt) + ' (' + names + ') estão na fila e rodam quando a máquina voltar.',
    'nova tentativa': ('O pedido de ' + nm(r0) + ' voltou para a fila (tentativa ' + ord + '). ' + retry).trim(),
    'liberado pelo vigia': 'O vigia liberou o pedido de ' + nm(r0) + ' (travou > 30 min) — volta para a fila (tentativa ' + ord + ').',
    'publicado': 'Leitura de ' + nm(r0) + ' publicada às ' + hmLoose(clock, r0.publishedAt) + '.',
    'falhou': allValidatorFail ? 'Os ' + reqs.length + ' pedidos (' + names + ') falharam nas ' + r0.attempt + ' tentativas. O validador recusou a saída em todas. Falha não conta na cota.'
      : failText(r0, clock, nm(r0)),
    'recusado (dado velho)': r0.refusedReason ? 'O pedido de ' + nm(r0) + ' foi recusado. ' + cap(refusedReasonText(r0.refusedReason)!).replace(/\s*Peça de novo\.?$/, '')
      : 'O pedido de ' + nm(r0) + ' foi recusado às ' + hmOr(r0, 'refusedAt', clock) + '.',
  } as Record<RequestState, string>)[state]
  const other = others.find(isActive)
  if (other && (state === 'falhou' || state === 'recusado (dado velho)')) return [first, againText(other, r0, clock)].join(' ')
  const tail = others.filter(q => !(state === 'sem máquina' && q.state === 'sem máquina') && !(state === 'falhou' && q.state === 'falhou' && allValidatorFail)).map(q => {
    const behind = q.stateNote ? ', ' + q.stateNote : ''
    if (q.state === 'falhou' && state === 'falhou' && failKindOf(q) !== 'validador') return failText(q, clock, nm(q))
    switch (q.state) {
      case 'na fila': return 'O pedido de ' + nm(q) + ' espera na fila desde ' + clock.hm(q.createdAt) + behind + ' (a máquina pega um por consulta).'
      case 'atrasado': return 'O pedido de ' + nm(q) + ' está atrasado, na fila há ' + waitingOf(q, clock.now) + ' min' + behind + '.'
      case 'sem máquina': return 'O pedido de ' + nm(q) + ' também está na fila, sem máquina.'
      case 'trabalhando': return 'O pedido de ' + nm(q) + ' está em andamento desde ' + hmLoose(clock, q.claimedAt) + '.'
      case 'publicado': return 'A leitura de ' + nm(q) + ' foi publicada às ' + hmLoose(clock, q.publishedAt) + '.'
      case 'falhou': return 'O pedido de ' + nm(q) + ' falhou às ' + hmLoose(clock, q.failedAt) + '.'
      case 'recusado (dado velho)': return 'O pedido de ' + nm(q) + ' foi recusado às ' + hmLoose(clock, q.refusedAt) + '.'
      default: return 'O pedido de ' + nm(q) + ': ' + q.state + '.'
    }
  })
  return [first].concat(tail).join(' ')
}

/** Next São Paulo midnight after `now`: when today's quota frees up. */
export function nextSpMidnight(now: number, clock: Clock): number { const p = clock.parts(now); return clock.sp(p.y, p.mo, p.d, 0, 0) + DAY }
const quotaText = (used: number, rel: number | null, clock: Clock) =>
  used && rel != null ? 'cota de hoje usada; libera ' + clock.weekday(rel) + ', ' + clock.dm(rel) + ' às 00:00' : 'cota de hoje livre (' + FORJA_QUEUE.quotaNote + ')'
const quotaOf = (reqs: ForjaRequest[], clock: Clock): Quota => {
  const used = reqs.filter(q => !NO_QUOTA.includes(q.state)).length, rel = used ? nextSpMidnight(clock.now, clock) : null
  return { usedToday: used, perTypePerNiche: FORJA_QUEUE.quotaPerDayPerType, note: FORJA_QUEUE.quotaNote, releasesAt: rel, text: quotaText(used, rel, clock) }
}

/** Quota per niche (dados.js:1826-1838): an active or published request uses it; failure and refusal do not. */
export function withQuota<S extends Scenario | null>(sc: S, scopeTodos: boolean, clock: Clock): S {
  if (!sc || !sc.quota) return sc
  const reqs = sc.requests || [], niches: Niche[] = (sc.split || scopeTodos) ? ['ia', 'viagem'] : reqs.length ? [reqs[0]!.niche] : []
  const byNiche: Partial<Record<Niche, { free: boolean; text: string }>> = {}
  for (const n of niches) {
    const q = reqs.find(r => r.niche === n)
    byNiche[n] = !q ? { free: true, text: 'cota livre' }
      : q.state === 'falhou' ? { free: true, text: 'cota livre (falha não conta)' }
      : q.state === 'recusado (dado velho)' ? { free: true, text: 'cota livre (recusa não conta)' }
      : { free: false, text: 'cota usada pelo pedido das ' + clock.hm(q.createdAt) }
  }
  sc.quota = { ...sc.quota, byNiche }
  if (niches.length > 1) sc.quota.text = niches.map(n => label(n) + ': ' + byNiche[n]!.text).join(' · ')
  return sc
}

/** Lead first: creation order (createdAt, then seq), stable. */
const creationOrder = (reqs: ForjaRequest[]) => reqs.map((q, i) => [q, i] as const)
  .sort(([a, i], [b, j]) => (a.createdAt - b.createdAt) || ((a.seq != null && b.seq != null) ? a.seq - b.seq : 0) || (i - j)).map(([q]) => q)

/** requestScenario's summarising half, without the per-niche quota (the session decorates at its outer layer). */
export function describeRequests(requests: ForjaRequest[], machine: Machine, clock: Clock): Scenario {
  const reqs = creationOrder(requests).map(q => ({ ...q }))
  for (const q of reqs) if (q.waitingMinutes == null && isActive(q) && q.state !== 'trabalhando') q.waitingMinutes = waitingOf(q, clock.now)
  const r0 = reqs[0]!, state = r0.state, split = reqs.length > 1
  // The queue suffix (fix round 1): a waiting request behind an active lead is "atrás do …" the lead, derived here so
  // DB rows (which carry no stateNote) read exactly like the canonical scenario. Same rule as the mockup's generator.
  if (isActive(r0)) for (const q of reqs.slice(1)) if (q.stateNote == null && WAITING_FOR_NOTE.includes(q.state)) { q.stateNote = aheadNote(r0, q); q.behind = r0.id }
  const text = statusText(reqs, machine, clock)
  // "atrás do de X" only while the request in front is active
  reqs.forEach((q, i) => { if (i > 0 && q.stateNote && !isActive(r0)) { q.stateNote = null; q.behind = null } })
  for (const q of reqs) q.statusLabel = statusLabel(q, clock, { machine })
  const anyActive = reqs.some(q => !isTerm(q)), ordered = queueOrder(reqs)
  const future = ordered.some(q => q.forecast != null)
  return {
    state, requests: ordered, request: ordered[0]!, split, statusText: text,
    statusLabel: split && TERMINAL_STATES.includes(state) && anyActive ? 'pedido em andamento' : r0.statusLabel!,
    statusLines: split ? ordered.map(q => label(q.niche) + ': ' + q.statusLabel) : null,
    active: anyActive, anyActive, terminal: !anyActive && TERMINAL_STATES.includes(state) && !future,
    machine, quota: quotaOf(reqs, clock), future, forecast: future ? ordered.map(q => q.forecast) : null,
  }
}
/**
 * The canonical summary of requests as they stand (labels, lines, text, terminal, quota). `requests` in creation
 * order, one per niche of the same type and target; `scopeTodos` = the view is "Todos" (quota per niche).
 */
export function summarize(requests: ForjaRequest[], machine: Machine, scopeTodos: boolean, clock: Clock): Scenario {
  return withQuota(describeRequests(requests, machine, clock), scopeTodos, clock)
}

/** The mockup's `summarize` sentence for one request (dados.js:1845-1852); `compose` shares it. */
function sentence(q: ForjaRequest, clock: Clock, singular: boolean): string {
  const n = label(q.niche), note = q.stateNote ? ', ' + q.stateNote : '', ma = q.maxAttempts ?? MAX_ATTEMPTS
  switch (q.state) {
    case 'publicado': return 'Leitura de ' + n + ' publicada às ' + hmLoose(clock, q.publishedAt) + '.'
    case 'falhou': return 'O pedido de ' + n + ' falhou às ' + hmLoose(clock, q.failedAt) + '.'
    case 'recusado (dado velho)': return 'O pedido de ' + n + ' foi recusado às ' + hmLoose(clock, q.refusedAt) + '.'
    case 'trabalhando': return 'O pedido de ' + n + ' está em andamento desde ' + hmLoose(clock, q.claimedAt) + '.'
    case 'atrasado': return 'O pedido de ' + n + ' está atrasado, na fila desde ' + clock.hm(q.createdAt) + note + '.'
    case 'sem máquina': return singular ? 'Seu pedido das ' + clock.hm(q.createdAt) + ' está na fila e roda quando a máquina voltar.' : 'O pedido de ' + n + ' está na fila e roda quando a máquina voltar.'
    case 'nova tentativa': return 'O pedido de ' + n + ' voltou para a fila (tentativa ' + q.attempt + ' de ' + ma + ').'
    case 'liberado pelo vigia': return 'O vigia liberou o pedido de ' + n + ' (travou > 30 min); ele volta para a fila (tentativa ' + q.attempt + ' de ' + ma + ').'
    default: return 'O pedido de ' + n + ' está na fila desde ' + clock.hm(q.createdAt) + note + '.'
  }
}
const labelled = (q: ForjaRequest, machine: Machine, clock: Clock) => q.statusLabel ?? statusLabel(q, clock, { machine })

/**
 * Port of the mockup's `summarize` (dados.js:1841-1864): the summary of a list the session edited, already in queue
 * order and already labelled. Without the per-niche quota.
 */
export function resummarize(requests: ForjaRequest[], machine: Machine, scopeTodos: boolean, clock: Clock): Scenario {
  const split = requests.length > 1 || scopeTodos, anyActive = requests.some(q => !isTerm(q))
  const reqs = requests.map(q => ({ ...q, statusLabel: labelled(q, machine, clock) }))
  const capDot = (t: string) => t ? cap(t).replace(/\.$/, '') + '.' : ''
  const one = (q: ForjaRequest) => (!split && q.state === 'sem máquina') ? sentence(q, clock, true)
    : (!split && q.state === 'falhou') ? (failKindOf(q) === 'validador' ? sentence(q, clock, false) + ' ' + capDot(q.failReason!) + ' Falha não conta na cota.' : failText(q, clock, label(q.niche)))
    : (!split && q.state === 'recusado (dado velho)') ? sentence(q, clock, false) + (q.refusedReason ? ' ' + capDot(refusedReasonText(q.refusedReason)!) : '') : sentence(q, clock, false)
  const dead = reqs.find(q => NO_QUOTA.includes(q.state)), act = reqs.find(isActive)
  return {
    state: anyActive ? reqs.find(q => !isTerm(q))!.state : reqs[0]!.state, requests: reqs, request: reqs[0]!, split, active: anyActive, anyActive, terminal: !anyActive, machine,
    statusLines: split ? reqs.map(q => label(q.niche) + ': ' + q.statusLabel) : null,
    statusLabel: reqs.length > 1 && anyActive && reqs.some(isTerm) ? 'pedido em andamento' : (scopeTodos ? label(reqs[0]!.niche) + ': ' : '') + reqs[0]!.statusLabel,
    statusText: dead && act ? reqs.filter(q => q !== act).map(one).concat([againText(act, dead, clock)]).join(' ') : reqs.map(one).join(' '),
    quota: quotaOf(reqs, clock),
  }
}

export interface NewRequest { niche: Niche; type?: string; createdAt?: number; seq?: number; fmt?: Fmt; scope?: 'todos'; video?: string | null }
/**
 * Composes a new "na fila" request over what exists (dados.js:1645-1679), never replacing the whole scenario: it
 * replaces the request of its niche (or is appended) and the others stay. It gets "atrás do …" only if an active
 * request is in front of it. Without the per-niche quota (see `composeWithQuota`).
 */
export function composeRaw(base: Pick<Scenario, 'requests'> & Partial<Pick<Scenario, 'split' | 'request' | 'machine'>> | null, newReq: NewRequest, opts: { niche?: 'todos' | Niche | null; machine?: Machine } | null, clock: Clock): Scenario {
  const now = clock.now
  const scopeTodos = (opts?.niche === 'todos') || newReq.scope === 'todos' || !!(base && base.split)
  const createdAt = Math.min(newReq.createdAt ?? now, now), type = newReq.type || (base && base.request ? base.request.type : 'padroes-titulo')
  const keep = (base && base.requests ? base.requests : []).filter(q => q.niche !== newReq.niche).map(q => ({ ...q }))
  const machine = base && base.machine ? base.machine : (opts?.machine ?? machineOf(null, clock))
  const nq: ForjaRequest = {
    id: 'req-' + type + '-' + newReq.niche + '-novo-' + clock.hm(createdAt).replace(':', ''), scenario: true, composed: true, type, niche: newReq.niche,
    target: { kind: 'niche', niche: newReq.niche, fmt: newReq.fmt || (type === 'padroes-titulo-shorts' ? 'short' : 'long') },
    state: 'na fila', status: 'pending', attempt: 1, maxAttempts: MAX_ATTEMPTS, createdAt, claimedAt: null, startedAt: null, publishedAt: null, failedAt: null,
    refusedReason: null, readingId: null, forecast: null, waitingMinutes: Math.round((now - createdAt) / MIN),
  }
  // createdAt tie: whoever came in first stays in front (stable); an optional seq breaks the tie
  keep.forEach((q, i) => { if (q.seq == null) q.seq = i })
  nq.seq = newReq.seq != null ? newReq.seq : keep.length
  const requests = queueOrder(keep.sort((a, b) => a.seq! - b.seq!).concat([nq]))
  const me = requests.indexOf(nq)
  const ahead = requests.slice(0, me).find(isActive)
  if (ahead) { nq.stateNote = aheadNote(ahead, nq); nq.behind = ahead.id }
  nq.statusLabel = statusLabel(nq, clock, { machine })
  // an active request that ended up behind the new one (smaller seq) gets the suffix too
  requests.forEach((q, i) => {
    if (q !== nq && q.state === 'na fila' && i > me) { q.stateNote = 'atrás do de ' + label(nq.niche); q.behind = nq.id; q.statusLabel = 'na fila · pedido ' + clock.hm(q.createdAt) + ' (' + q.stateNote + ')' }
  })
  for (const q of requests) q.statusLabel = labelled(q, machine, clock)
  const anyActive = requests.some(q => !isTerm(q)), split = requests.length > 1 || scopeTodos
  const dead = requests.find(q => NO_QUOTA.includes(q.state)), act = requests.find(isActive)
  return {
    state: anyActive ? 'na fila' : requests[0]!.state, composed: true, requests, request: requests[0]!, split, active: anyActive, anyActive, terminal: !anyActive,
    statusLines: split ? requests.map(q => label(q.niche) + ': ' + q.statusLabel) : null,
    statusLabel: requests.length > 1 && anyActive && requests.some(isTerm) ? 'pedido em andamento' : (scopeTodos ? label(requests[0]!.niche) + ': ' : '') + requests[0]!.statusLabel,
    statusText: dead && act ? requests.filter(q => q !== act).map(q => sentence(q, clock, !split)).concat([againText(act, dead, clock)]).join(' ') : requests.map(q => sentence(q, clock, !split)).join(' '),
    machine, quota: quotaOf(requests, clock),
  }
}
/** `forja.compose`: compose + per-niche quota ("Todos" when opts.niche is 'todos'). */
export function compose(base: Parameters<typeof composeRaw>[0], newReq: NewRequest, opts: { niche?: 'todos' | Niche | null; createdAt?: number; machine?: Machine } | null, clock: Clock): Scenario {
  const r = newReq.createdAt == null && opts?.createdAt != null ? { ...newReq, createdAt: opts.createdAt } : newReq
  return withQuota(composeRaw(base, r, opts, clock), opts?.niche === 'todos', clock)
}
