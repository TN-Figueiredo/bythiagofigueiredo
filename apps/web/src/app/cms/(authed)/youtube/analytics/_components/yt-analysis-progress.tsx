'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  describeProgress,
  isActive,
  formatClock,
  formatDuration,
  formatHM,
  formatHMS,
  formatDM,
  MAX_ATTEMPTS,
  type AnalysisTaskSnapshot,
  type ProgressView,
} from '@/lib/youtube/analysis-progress'

/** How often the card asks for the task while the forja still has something to do. */
export const POLL_MS = 15_000
/** How long the "publicado" confirmation stays before the card goes away on its own. */
export const DONE_VISIBLE_MS = 20_000

export interface AnalysisTaskState {
  task: AnalysisTaskSnapshot | null
  view: ProgressView | null
  /** The 1 s clock the view was computed with; null before mount. */
  now: Date | null
  /** Re-reads the task now: after a request, and on every poll. */
  refresh: () => Promise<void>
  /** Id of a completion watched on this page, for the banner's "NOVO" flash. */
  arrivedTaskId: string | null
}

/**
 * The task the card and the header button both read. Lives in the tabs container so the two
 * cannot disagree. `now` stays null until mount: the server has a different clock, and a
 * countdown rendered on both sides is a hydration mismatch.
 */
export function useAnalysisTask(
  channelId: string | undefined,
  initial: AnalysisTaskSnapshot | null,
  poll: ((channelId: string) => Promise<AnalysisTaskSnapshot | null>) | undefined,
): AnalysisTaskState {
  const router = useRouter()
  const [task, setTask] = useState<AnalysisTaskSnapshot | null>(initial)
  const [now, setNow] = useState<Date | null>(null)
  const [arrivedTaskId, setArrivedTaskId] = useState<string | null>(null)
  // Ids watched while pending/running on THIS page: only those may show "publicado".
  const watched = useRef<Set<string>>(new Set(initial && isActive(initial) ? [initial.id] : []))
  const taskRef = useRef<AnalysisTaskSnapshot | null>(initial)

  // The server's read wins whenever it changes: a channel switch (same component instance,
  // new props) or the router.refresh() after an arrival.
  useEffect(() => {
    if (initial && isActive(initial)) watched.current.add(initial.id)
    taskRef.current = initial
    setTask(initial)
  }, [channelId, initial?.id, initial?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    if (!poll || !channelId) return
    let next: AnalysisTaskSnapshot | null
    try {
      next = await poll(channelId)
    } catch {
      return // a failed poll keeps the last known state; the next tick tries again
    }
    const prev = taskRef.current
    if (next && isActive(next)) watched.current.add(next.id)
    const arrived = next !== null && next.status === 'completed' && watched.current.has(next.id)
      && !(prev?.id === next.id && prev.status === 'completed')
    taskRef.current = next
    setTask(next)
    if (arrived && next) {
      setArrivedTaskId(next.id)
      // The new analysis is a server read; refresh re-runs the page's queries.
      router.refresh()
    }
  }, [poll, channelId, router])

  const active = isActive(task)
  const view = now ? describeProgress(task, now, task ? watched.current.has(task.id) : false) : null
  const showing = view !== null

  // 1 s clock only while something is on screen: the countdown and the stopwatch need it.
  useEffect(() => {
    setNow(new Date())
    if (!showing && !active) return
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [showing, active])

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void refresh()
    }, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [active, refresh])

  // "Publicado" is a confirmation, not a state: it leaves on its own.
  const doneId = view?.kind === 'done' ? task?.id ?? null : null
  useEffect(() => {
    if (!doneId) return
    const id = setTimeout(() => { watched.current.delete(doneId); setNow(new Date()) }, DONE_VISIBLE_MS)
    return () => clearTimeout(id)
  }, [doneId])

  return { task, view, now, refresh, arrivedTaskId }
}

/** The header button while a request is open; null means "Pedir diagnostico" as usual. */
export function progressButtonLabel(view: ProgressView | null, now: Date | null): { text: string; small?: string } | null {
  if (!view) return null
  if (view.kind === 'queued') {
    const left = now ? view.expectedDoneAt.getTime() - now.getTime() : null
    return { text: 'Na fila', small: left !== null && left > 0 ? `~${formatDuration(left)}` : undefined }
  }
  if (view.kind === 'running') return { text: 'Forja trabalhando' }
  if (view.kind === 'late') return { text: 'Na fila, atrasado' }
  return null
}

interface Props {
  view: ProgressView
  now: Date
  channelName: string
  requestedAt: Date
  retryCount: number
  onRequestAgain?: () => void
}

function Step({ s, title, time, note }: { s: 'feito' | 'agora' | 'pendente' | 'erro' | 'parado'; title: string; time?: string; note?: string }) {
  return (
    <li className="run-step" data-s={s}>
      <b>{title}</b>
      {time && <time>{time}</time>}
      {note && <small>{note}</small>}
    </li>
  )
}

const INSIDE = 'lê os números do canal, o Gemma escreve, o validador confere'

export function YtAnalysisProgress({ view, now, channelName, requestedAt, retryCount, onRequestAgain }: Props) {
  const label = (
    <p className="run-lbl"><span className="run-dot" aria-hidden="true" />Diagnóstico pedido · {channelName}</p>
  )
  const requested = <Step s="feito" title="Pedido registrado" time={formatHMS(requestedAt)} />

  if (view.kind === 'queued') {
    const retrying = retryCount > 0
    const left = Math.max(0, view.expectedDoneAt.getTime() - now.getTime())
    return (
      <section className="run" data-st="queued">
        {label}
        <div className="run-eta">
          <b>~{formatDuration(left)}</b>
          <span>{retrying ? `tentativa ${view.attempt} de ${MAX_ATTEMPTS}` : `previsto ${formatHM(view.expectedDoneAt)}`}</span>
        </div>
        <p className="run-tit">
          {retrying
            ? `A tentativa anterior não terminou. A forja tenta de novo às ${formatHM(view.pickupAt)}.`
            : `Na fila. A forja pega na próxima olhada, às ${formatHM(view.pickupAt)}.`}
        </p>
        <p className="run-sub">
          {retrying
            ? 'Nada foi publicado; o diagnóstico abaixo continua o anterior.'
            : 'Ela verifica a fila a cada 10 minutos; você pode sair desta tela, o pedido continua.'}
        </p>
        <ol className="run-steps">
          {requested}
          <Step s="agora" title="Forja pega o pedido" time={`próxima olhada ${formatHM(view.pickupAt)}`} />
          <Step s="pendente" title="Diagnóstico publicado" note={INSIDE} />
        </ol>
      </section>
    )
  }

  if (view.kind === 'running') {
    return (
      <section className="run" data-st="running">
        {label}
        <div className="run-eta"><b>{formatClock(view.elapsedMs)}</b><span>costuma levar &lt; 1 min</span></div>
        <p className="run-tit">A forja pegou o pedido às {formatHMS(view.startedAt)} e está escrevendo.</p>
        <p className="run-sub">Lendo os números do canal, redigindo com o Gemma e conferindo cada número antes de publicar.</p>
        <ol className="run-steps">
          {requested}
          <Step s="feito" title="Forja pegou" time={formatHMS(view.startedAt)} />
          <Step s="agora" title="Diagnóstico publicado" note={INSIDE} />
        </ol>
      </section>
    )
  }

  if (view.kind === 'done') {
    return (
      <section className="run" data-st="done">
        {label}
        <div className="run-eta"><b aria-hidden="true">✓</b><span>em {formatDuration(view.totalMs)}</span></div>
        <p className="run-tit">Diagnóstico novo publicado às {formatHMS(view.completedAt)}.</p>
        <p className="run-sub">Está logo abaixo.</p>
        <ol className="run-steps">
          {requested}
          <Step s="feito" title="Forja pegou" time={view.startedAt ? formatHMS(view.startedAt) : undefined} />
          <Step s="feito" title="Publicado" time={formatHMS(view.completedAt)} />
        </ol>
      </section>
    )
  }

  if (view.kind === 'late') {
    return (
      <section className="run" data-st="late">
        {label}
        <div className="run-eta"><b>+{formatDuration(Math.max(0, view.lateByMs))}</b><span>de atraso</span></div>
        <p className="run-tit">A forja não pegou o pedido no horário previsto ({formatHM(view.expectedAt)}).</p>
        <p className="run-sub">Ela pode estar desligada ou ocupada. O pedido continua na fila e é pego assim que ela voltar.</p>
        <ol className="run-steps">
          {requested}
          <Step s="parado" title="Forja pega o pedido" time={`esperado ${formatHM(view.expectedAt)}`} />
          <Step s="pendente" title="Diagnóstico publicado" />
        </ol>
      </section>
    )
  }

  if (view.kind === 'unserved') {
    return (
      <section className="run" data-st="unserved">
        {label}
        <div className="run-eta"><b>{formatDuration(view.queuedForMs)}</b><span>na fila</span></div>
        <p className="run-tit">Nenhuma máquina atende este canal no momento.</p>
        <p className="run-sub">O pedido está na fila desde {formatDM(requestedAt)}. A forja hoje só analisa os canais configurados nela.</p>
      </section>
    )
  }

  if (view.kind === 'stale') {
    return (
      <section className="run" data-st="stale">
        {label}
        <div className="run-eta"><b aria-hidden="true">!</b><span>30 min sem resposta</span></div>
        <p className="run-tit">
          {view.startedAt
            ? `A forja começou às ${formatHM(view.startedAt)} e não terminou em 30 min.`
            : 'A forja não terminou o pedido a tempo.'}
        </p>
        <p className="run-sub">O vigia liberou o pedido. Nada foi publicado; você pode pedir de novo.</p>
        {onRequestAgain && (
          <div className="run-acoes"><button type="button" className="btn sm" onClick={onRequestAgain}>Pedir de novo</button></div>
        )}
      </section>
    )
  }

  return (
    <section className="run" data-st="failed">
      {label}
      <div className="run-eta"><b aria-hidden="true">!</b><span>{retryCount + 1} de {MAX_ATTEMPTS} tentativas</span></div>
      <p className="run-tit">A forja não conseguiu publicar: {view.reason}.</p>
      <p className="run-sub">Nada foi publicado; o diagnóstico abaixo continua o anterior. Você pode pedir de novo.</p>
      <ol className="run-steps">
        {requested}
        {view.startedAt
          ? <Step s="feito" title="Forja pegou" time={formatHMS(view.startedAt)} />
          : <Step s="pendente" title="Forja pega o pedido" />}
        <Step s="erro" title="Não publicado"
          time={[view.failedAt ? formatHMS(view.failedAt) : null, view.code].filter(Boolean).join(' · ')} />
      </ol>
      {onRequestAgain && (
        <div className="run-acoes"><button type="button" className="btn sm" onClick={onRequestAgain}>Pedir de novo</button></div>
      )}
    </section>
  )
}

/**
 * One short sentence per state for a live region that lives in the container (a region
 * inserted together with the card is not announced). It changes only when the STATE changes,
 * never with the countdown.
 */
export function progressAnnouncement(view: ProgressView | null): string {
  switch (view?.kind) {
    case 'queued': return 'Diagnóstico na fila da forja.'
    case 'running': return 'A forja pegou o pedido e está escrevendo.'
    case 'done': return 'Diagnóstico novo publicado.'
    case 'late': return 'A forja não pegou o pedido no horário previsto.'
    case 'unserved': return 'Nenhuma máquina atende este canal no momento.'
    case 'failed': return 'A forja não conseguiu publicar o diagnóstico.'
    case 'stale': return 'A forja não terminou o pedido a tempo.'
    default: return ''
  }
}
