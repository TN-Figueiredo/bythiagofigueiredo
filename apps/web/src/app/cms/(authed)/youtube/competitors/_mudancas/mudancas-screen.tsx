'use client'
/**
 * Mudanças screen (port of mudancas.html #screen): summary + ledger, filters, count line and legend, the feed of
 * before → after with the measured effect, the honest empty state and "Carregar mais". Everything shown comes from
 * the view model; this file holds only UI state (page, optimistic swipe file). Server actions arrive as props.
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useToast } from '../_chrome/toasts'
import { SWIPE_LABEL, SWIPE_UNAVAILABLE, type Hero, type MudancasView } from './view-model'
import { Ledger } from './ledger'
import { Filters, useGo } from './filters'
import { VideoGroup, type SwipeState } from './change-hero'
import { RichText } from './rich'
import { ReadingCard } from './reading-card'

export interface SwipeResult { ok: boolean; saved?: boolean }
export interface MudancasScreenProps {
  view: MudancasView
  /** Server action: toggles competitor_changes.bookmarked for the change whose version key is given. */
  onToggleSwipe?: (key: string) => Promise<SwipeResult>
  /** Replaces the forja card of the summary box (default: ReadingCard from view.forja). */
  forjaSlot?: ReactNode
}

export function MudancasScreen({ view, onToggleSwipe, forjaSlot }: MudancasScreenProps) {
  const router = useRouter(), toast = useToast(), go = useGo()
  const [page, setPage] = useState(0)
  const [over, setOver] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const listKey = view.heroes.map(h => h.id).join('|')
  // a new list (filters changed) starts on the first page and drops the optimistic marks
  useEffect(() => { setPage(0); setOver({}) }, [listKey])
  useEffect(() => { if (view.nicheNote) toast('', view.nicheNote, '') }, [view.nicheNote, toast])

  const swipeOf = useCallback((h: Hero): SwipeState => {
    if (h.swipe.key == null) return { saved: false, label: SWIPE_UNAVAILABLE, busy: false, disabled: true }
    const saved = over[h.id] ?? h.swipe.saved
    return { saved, label: saved ? SWIPE_LABEL.on : SWIPE_LABEL.off, busy: !!busy[h.id], disabled: false }
  }, [over, busy])
  const onSwipe = useCallback(async (h: Hero) => {
    const key = h.swipe.key
    if (!onToggleSwipe || key == null) return
    const was = over[h.id] ?? h.swipe.saved
    setOver(o => ({ ...o, [h.id]: !was })); setBusy(b => ({ ...b, [h.id]: true }))
    let r: SwipeResult
    try { r = await onToggleSwipe(key) } catch { r = { ok: false } }
    setBusy(b => ({ ...b, [h.id]: false }))
    if (!r.ok) {
      setOver(o => ({ ...o, [h.id]: was }))
      toast('warn', was ? 'Não deu para tirar do swipe file' : 'Não deu para salvar no swipe file', 'Tente de novo.')
      return
    }
    const now = r.saved ?? !was
    setOver(o => ({ ...o, [h.id]: now }))
    toast('ok', now ? 'Salvo no swipe file' : 'Tirado do swipe file', '')
    if (view.filters.saved) router.refresh()
  }, [onToggleSwipe, over, toast, router, view.filters.saved])

  const cuts = view.paging.cuts
  const shown = cuts[Math.min(page, cuts.length - 1)] ?? 0
  const groups = useMemo(() => {
    const vis = view.heroes.slice(0, shown), out: Hero[][] = []
    for (const h of vis) {
      const last = out[out.length - 1]
      if (view.groupByVideo && last && last[0]!.video.id === h.video.id) last.push(h); else out.push([h])
    }
    return out
  }, [view.heroes, view.groupByVideo, shown])
  const total = view.heroes.length, pi = Math.min(page, cuts.length - 1)

  return (
    <div data-obs-screen="mudancas">
      <Ledger view={view} forjaSlot={forjaSlot ?? <ReadingCard view={view} />} />
      <Filters view={view} />
      <div className="count-row">
        <span aria-live="polite" data-count-line="">{total ? <RichText r={view.paging.countLines[pi]!} /> : null}</span>
        <span className="legend" aria-hidden="true" hidden={!total}>
          <span><svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke="var(--spark-before)" strokeWidth="2" /></svg>views/dia antes da troca</span>
          <span><svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke="var(--spark-after)" strokeWidth="2" /></svg>depois da troca</span>
          <span><svg width="22" height="10"><rect x="0" y="0" width="22" height="10" fill="var(--band)" /><line x1="0" y1="5" x2="22" y2="5" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="3 2" /></svg>esperado sem a troca (faixa normal)</span>
        </span>
      </div>
      <div id="feed" data-feed="">
        {groups.map(g => <VideoGroup key={g[0]!.id} heroes={g} swipeOf={swipeOf} onSwipe={onSwipe} />)}
      </div>
      {view.empty ? (
        <div className="empty" role="status" data-empty="" data-hidden-by={view.empty.hiddenBy ?? undefined}>
          <h3>{view.empty.title}</h3>
          <p>{view.empty.text}</p>
          <div className="btns">{view.empty.actions.map(a => <button key={a.label} className="btn" type="button" onClick={() => go(a.patch)}>{a.label}</button>)}</div>
        </div>
      ) : null}
      {total ? (
        <div className="pager">
          <span>{view.paging.restTexts[pi]}</span>
          {pi < cuts.length - 1 ? <button className="btn" type="button" onClick={() => setPage(p => p + 1)}>Carregar mais</button> : null}
        </div>
      ) : null}
      {/* slot of the forja reading opened by ?reading= (Task 35); it never changes the list */}
      <div data-reading-slot={view.filters.reading ?? undefined} hidden />
    </div>
  )
}
