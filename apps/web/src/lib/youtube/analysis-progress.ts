/**
 * Where a "Pedir diagnóstico" request stands, derived ONLY from what the task row records.
 *
 * The site sees two events from the forja — the claim (`started_at`) and the end
 * (`completed_at` / `failed_at`). What happens in between (snapshot, Gemma, validator) is
 * never reported, so this module never claims it happened: those steps are prose on the
 * card, not ticked milestones.
 *
 * The timing constants mirror the forja's cron and the site's watchdog. They are coupled on
 * purpose and documented in CLAUDE.md ("Orçamento acoplado em três lugares"): change the
 * forja's `*\/10` and FORJA_TICK_MINUTES has to follow.
 */

export type AnalysisTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stale'

export interface AnalysisTaskSnapshot {
  id: string
  status: AnalysisTaskStatus
  requestedAt: string
  startedAt: string | null
  completedAt: string | null
  failedAt: string | null
  updatedAt: string
  retryCount: number
  errorMessage: string | null
}

/** The forja's cron runs `*\/10` in its local time; Brazil has whole-hour offsets, so the
 *  boundaries are the same minutes in UTC. */
export const FORJA_TICK_MINUTES = 10
/** What a run takes once claimed: ~15 s measured on 23/09, rounded up. */
export const RUN_ESTIMATE_SECONDS = 30
/** A tick is "missed" once this much time passed after it with the task still pending. */
const TICK_GRACE_SECONDS = 90
/** Two missed ticks and a half: the forja is off or busy. */
export const LATE_AFTER_MINUTES = 25
/** A day in the queue: nothing consumes this channel (the EN channel today). */
export const UNSERVED_AFTER_HOURS = 24
/** `failTask` requeues while `retry_count < 2`: three attempts in total. */
export const MAX_ATTEMPTS = 3
/** The watchdog's STALE_THRESHOLD_MINUTES (app/api/cron/youtube-intelligence-watchdog). */
export const STALE_AFTER_MINUTES = 30
/** A failure older than this is history, not something the card should still announce. */
const FAILURE_VISIBLE_HOURS = 24

const TICK_MS = FORJA_TICK_MINUTES * 60_000

/** The first forja tick strictly after `at`. */
export function nextTick(at: Date): Date {
  return new Date((Math.floor(at.getTime() / TICK_MS) + 1) * TICK_MS)
}

export type ProgressView =
  | { kind: 'queued'; attempt: number; pickupAt: Date; expectedDoneAt: Date }
  | { kind: 'late'; attempt: number; expectedAt: Date; lateByMs: number }
  | { kind: 'unserved'; queuedForMs: number }
  | { kind: 'running'; startedAt: Date; elapsedMs: number }
  | { kind: 'done'; completedAt: Date; startedAt: Date | null; totalMs: number }
  | { kind: 'failed'; failedAt: Date | null; startedAt: Date | null; reason: string; code: string | null }
  | { kind: 'stale'; startedAt: Date | null }

function parse(iso: string | null): Date | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : new Date(t)
}

/**
 * The state to show, or null when there is nothing to announce (no task, or a task that
 * ended long enough ago to be history). `done` is only produced for a completion the caller
 * says it WATCHED happen (`sawActive`): on a fresh page load an old completion is not news.
 */
export function describeProgress(
  task: AnalysisTaskSnapshot | null,
  now: Date,
  sawActive = false,
): ProgressView | null {
  if (!task) return null
  const requestedAt = parse(task.requestedAt)
  if (!requestedAt) return null
  const nowMs = now.getTime()

  if (task.status === 'pending') {
    const queuedForMs = nowMs - requestedAt.getTime()
    if (queuedForMs >= UNSERVED_AFTER_HOURS * 3_600_000) return { kind: 'unserved', queuedForMs }
    const attempt = Math.min(task.retryCount, MAX_ATTEMPTS - 1) + 1
    // A requeued task keeps its original requested_at: its pickup is simply the next tick.
    const firstPickup = nextTick(requestedAt)
    if (queuedForMs >= LATE_AFTER_MINUTES * 60_000 && task.retryCount === 0) {
      return { kind: 'late', attempt, expectedAt: firstPickup, lateByMs: nowMs - firstPickup.getTime() }
    }
    const pickupAt = nowMs <= firstPickup.getTime() + TICK_GRACE_SECONDS * 1000 && task.retryCount === 0
      ? firstPickup
      : nextTick(now)
    return {
      kind: 'queued',
      attempt,
      pickupAt,
      expectedDoneAt: new Date(pickupAt.getTime() + RUN_ESTIMATE_SECONDS * 1000),
    }
  }

  if (task.status === 'running') {
    const startedAt = parse(task.startedAt) ?? requestedAt
    return { kind: 'running', startedAt, elapsedMs: Math.max(0, nowMs - startedAt.getTime()) }
  }

  if (task.status === 'completed') {
    const completedAt = parse(task.completedAt)
    if (!sawActive || !completedAt) return null
    return { kind: 'done', completedAt, startedAt: parse(task.startedAt), totalMs: Math.max(0, completedAt.getTime() - requestedAt.getTime()) }
  }

  const endedAt = parse(task.failedAt) ?? parse(task.updatedAt)
  if (!sawActive && (!endedAt || nowMs - endedAt.getTime() > FAILURE_VISIBLE_HOURS * 3_600_000)) {
    return null
  }
  if (task.status === 'stale') return { kind: 'stale', startedAt: parse(task.startedAt) }
  return {
    kind: 'failed',
    failedAt: parse(task.failedAt),
    startedAt: parse(task.startedAt),
    reason: failureReason(task.errorMessage),
    code: task.errorMessage,
  }
}

/** True while the forja still has something to do: poll and keep the button busy. */
export function isActive(task: AnalysisTaskSnapshot | null): boolean {
  return task?.status === 'pending' || task?.status === 'running'
}

/**
 * The forja's `fail` reasons (fila_intel.py) in one sentence each. Unknown codes fall back
 * to a generic sentence and keep the raw code visible next to the time, so a new reason is
 * never hidden — it just reads less nicely until it gets a line here.
 */
const REASONS: Record<string, string> = {
  llama: 'o modelo local não respondeu',
  timeout: 'o modelo local não respondeu a tempo',
  orcamento: 'o tempo da execução acabou antes de o texto ficar pronto',
  janela: 'a janela de dados do canal veio diferente de 90 dias',
  escopo: 'o resultado saiu do escopo desta fase',
  bug: 'um erro no programa da forja',
  snapshot: 'a forja não conseguiu ler os números do canal',
  patch: 'o site não aceitou o resultado da forja',
}

export function failureReason(code: string | null): string {
  if (!code) return 'a forja não informou o motivo'
  // The forja writes `llama`, `bug: KeyError`, `snapshot 500`, `janela 28`, `patch 429`.
  const key = Object.keys(REASONS).find(k => code === k || /^[ :_]/.test(code.slice(k.length)) && code.startsWith(k))
  return key ? REASONS[key]! : 'um erro que a forja registrou'
}

const HM = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const HMS = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' })
const DM = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })

export function formatHM(d: Date): string { return HM.format(d) }
export function formatHMS(d: Date): string { return HMS.format(d) }
export function formatDM(d: Date): string { return DM.format(d) }

/** "5 min", "58 s", "1 h 05 min", "140 dias" — the card's big number. */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s} s`
  const min = Math.round(s / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h} h ${String(min % 60).padStart(2, '0')} min`
  return `${Math.floor(h / 24)} dias`
}

/** "0:18" — a stopwatch for a run in progress. */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
