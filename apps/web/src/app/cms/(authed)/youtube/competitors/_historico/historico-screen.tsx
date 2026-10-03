'use client'
/**
 * Histórico do vídeo (port of historico-video.html): header, the views/day curve with every version of title,
 * thumbnail and description, the before/after comparison per change, and the versions. The forja (Task 35): the
 * screen's single filled button in the video header and the "Leitura da forja" card below the comparison.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '../_chrome/toasts'
import type { HistoricoView, LaneType } from './view-model'
import type { Hl } from './lanes'
import { Crumbs } from './pager'
import { Timeline } from './views-chart'
import { Compare } from './compare'
import { Versions } from './versions'
import { HIcon, TYPE_COLOR } from './icons'
import { Thumb } from './thumb'
import { ForjaAskButton, VideoReading } from './video-reading'
import type { ForjaAsk, ForjaCancel } from '../_chrome/forja-view-model'

const reduced = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function HistoricoScreen({ view, onAskForja, onCancelForja }: { view: HistoricoView; onAskForja?: ForjaAsk; onCancelForja?: ForjaCancel }) {
  const toast = useToast()
  const [pairK, setPairK] = useState<string | null>(view.defaultPair)
  const [hl, setHl] = useState<Hl | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const onHl = useCallback((h: Hl | null) => setHl(h), [])
  const toasted = useRef<string | null>(null)
  useEffect(() => { setPairK(view.defaultPair) }, [view.defaultPair])
  useEffect(() => {
    const t = view.video?.nicheToast
    if (t && toasted.current !== view.video!.id) { toasted.current = view.video!.id; toast('', t, '') }
  }, [view.video, toast])

  const goVersion = (type: LaneType, i: number) => {
    const t = root.current?.querySelector<HTMLElement>('[data-ver="' + type + ':' + i + '"]')
    if (!t) return
    t.scrollIntoView?.({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' })
    t.focus({ preventScroll: true })
  }
  const selectPair = (k: string) => {
    setPairK(k)
    const c = root.current?.querySelector<HTMLElement>('#hv-compare')
    c?.scrollIntoView?.({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })
    setTimeout(() => root.current?.querySelector<HTMLElement>('#hv-compare .pair[aria-pressed="true"]')?.focus(), 0)
  }
  const openDesc = () => {
    const sec = root.current?.querySelector<HTMLElement>('#hv-desc')
    sec?.querySelectorAll('details').forEach(d => { d.open = true })
    const h = root.current?.querySelector<HTMLElement>('#hv-deh')
    h?.focus(); h?.scrollIntoView?.({ block: 'start' })
  }

  if (view.state === 'not-found' && view.notFound) {
    return (
      <div data-obs-screen="historico" ref={root}>
        <div className="page">
          <Crumbs crumbs={view.crumbs} pager={null} />
          <section className="card nobase-card" data-not-found="">
            <div className="nfin"><strong>{view.notFound.title}</strong>{view.notFound.text} <a className="inl" href={view.notFound.href}>{view.notFound.back}</a></div>
          </section>
        </div>
      </div>
    )
  }
  const v = view.video!, h = view.header!
  const pair = view.comparisons.find(c => c.changeId === pairK) ?? null
  const legend = view.legends[pair ? pair.changeId : ''] ?? view.legends[''] ?? []
  return (
    <div data-obs-screen="historico" data-state={view.state} ref={root}>
      <div className="page">
        <Crumbs crumbs={view.crumbs} pager={view.pager} />
        <section className="vhead" id="vhead" aria-label="Vídeo">
          <div className="cur"><Thumb t={h.thumb} dur={h.dur} /></div>
          <div>
            <h2 tabIndex={-1}>{v.title}</h2>
            <div className="facts">
              <span className="chan">
                <span className="av" aria-hidden="true" style={{ background: h.chan.color }}>{h.chan.ini}</span>{h.chan.name}
                {h.chan.niche ? <span className="niche">{h.chan.niche}</span> : null}
              </span>
              <span>{h.views.num ? <><b className="mono">{h.views.num}</b>{h.views.text}</> : h.views.text}</span>
              <span>publicado <b title={h.pub.full}>{h.pub.age}</b> <span className="mono">({h.pub.full})</span></span>
              <span>{h.fmt}</span>
              <span className={h.sync.bad ? 'syncbad' : undefined} title={h.sync.title || undefined}>{h.sync.bad ? <HIcon name="warn" /> : null}{h.sync.text}</span>
              <span title={h.mult.title || undefined}>{h.mult.text}</span>
            </div>
            {h.fallback ? <div className="fallback">{h.fallback}</div> : null}
            {h.counts.length ? (
              <div className="counts">
                {h.counts.map((c, i) => <span key={i} className="count">{c.type ? <i style={{ background: TYPE_COLOR[c.type] }} aria-hidden="true" /> : null}{c.text}</span>)}
              </div>
            ) : null}
          </div>
          <div className="actions">
            {view.forja && view.forjaCard ? <div className="arow"><ForjaAskButton forja={view.forja} card={view.forjaCard} onAsk={onAskForja} /></div> : null}
            <div className="arow"><a className="btn" href={v.url} target="_blank" rel="noopener noreferrer"><HIcon name="ext" />Abrir no YouTube</a></div>
          </div>
        </section>
        {view.untracked ? (
          <section className="card nobase-card" data-untracked="">
            <div className="nfin"><strong>Vídeo fora dos acompanhados.</strong>{view.untracked.text} <a className="inl" href={view.untracked.href}>Ver o canal em Canais</a></div>
          </section>
        ) : (
          <>
            {view.chart ? (
              <Timeline chart={view.chart} lanes={view.lanes} legend={legend} pair={pair} hl={hl} onHl={onHl}
                onSelectPair={selectPair} onGoVersion={goVersion} />
            ) : null}
            <Compare comparisons={view.comparisons} selected={pairK} empty={view.compareEmpty} onSelect={setPairK} onDescLink={openDesc} />
            {view.forja && view.forjaCard ? <VideoReading card={view.forjaCard} forja={view.forja} onCancel={onCancelForja} /> : null}
            {view.versions ? <Versions versions={view.versions} hl={hl} onHl={onHl} /> : null}
          </>
        )}
      </div>
    </div>
  )
}
