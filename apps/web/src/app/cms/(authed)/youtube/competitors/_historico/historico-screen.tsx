'use client'
/**
 * Histórico do vídeo (port of historico-video.html): header, the views/day curve with every version of title,
 * thumbnail and description, the before/after comparison per change, and the versions. The forja (Task 35): the
 * screen's single filled button in the video header and the "Leitura da forja" card below the comparison.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useToast } from '../_chrome/toasts'
import { lembrarUltimoVideo } from '../_chrome/ultimo-video'
import { currentFlut } from '../_chrome/flut/store'
import type { HistoricoView, LaneType } from './view-model'
import type { Hl } from './lanes'
import { Crumbs } from './pager'
import { Timeline } from './views-chart'
import { Compare, NO_FILTER, type CompareFilter } from './compare'
import { ImageSummary } from './image-summary'
import { useGo } from '../_mudancas/filters'
import { Versions } from './versions'
import { HIcon, TYPE_COLOR } from './icons'
import { Thumb } from './thumb'
import { ForjaAskButton, VideoReading } from './video-reading'
import type { ForjaAsk, ForjaCancel } from '../_chrome/forja-view-model'
import { ChannelAvatar } from '../_chrome/channel-avatar'
import { PinProvider, PinButton, PinMessage, PinChips, PinIcon, type PinAction } from '../_chrome/pin-kit'

/** The video a pager href leads to (`/…/video/<id>?…`). */
const videoOf = (href: string) => { try { return decodeURIComponent(new URL(href, 'http://x').pathname.split('/').pop() ?? '') } catch { return '' } }

const reduced = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function HistoricoScreen({ view, onAskForja, onCancelForja, onPin, onUnpin }: { view: HistoricoView; onAskForja?: ForjaAsk; onCancelForja?: ForjaCancel; onPin?: PinAction; onUnpin?: PinAction }) {
  const toast = useToast()
  const [pairK, setPairK] = useState<string | null>(view.defaultPair)
  const [hover, setHover] = useState<Hl | null>(null)
  /** Thumbnail image whose highlight is pinned (image summary); Esc lets it go. */
  const [pinImg, setPinImg] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [target, setTarget] = useState<string | null>(null)
  const [flt, setFlt] = useState<CompareFilter>(NO_FILTER)
  const [live, setLive] = useState('')
  const go = useGo()
  const router = useRouter()
  const root = useRef<HTMLDivElement>(null)
  /** Which pager button (or key) was used and the video it leads to: the focus effect puts the focus back on it once that video is on screen. */
  const pagerUsed = useRef<{ which: 'prev' | 'next'; to: string } | null>(null)
  const onPage = useCallback((which: 'prev' | 'next', href: string) => { pagerUsed.current = { which, to: videoOf(href) } }, [])
  // 30 days is the default (spec 6.4): it leaves the URL; `tudo` is written out. With an arrival the period may have been widened by the
  // change, so every choice (30 included) is written out: without it "30 d" would patch away a `range` that is not there and do nothing.
  const onRange = (id: string) => go({ range: id === '30' && !view.arrival ? null : id })
  const onHl = useCallback((h: Hl | null) => setHover(h), [])
  const hl: Hl | null = hover ?? (pinImg ? { type: 'thumb', i: -1, ev: null, label: pinImg } : null)
  const rangeValue = view.range?.value ?? 'tudo'
  // another period (or another video): the grid collapses again, the filters and the pin start over
  useEffect(() => { setExpanded(false); setTarget(null); setFlt(NO_FILTER); setPinImg(null) }, [rangeValue, view.video?.id])
  // Esc lets the pinned image go, unless a tooltip or a group list is open (those close first)
  useEffect(() => {
    if (!pinImg) return
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || currentFlut() != null || document.getElementById('hv-tip') != null) return
      setPinImg(null); setLive('Destaque solto.')
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [pinImg])
  const pinImage = (label: string) => {
    const next = pinImg === label ? null : label
    setPinImg(next); setLive(next ? 'Imagem ' + next + ' fixada no destaque. Esc solta.' : 'Destaque solto.')
  }
  const toasted = useRef<string | null>(null)
  // Next 16 keeps this component when only the query changes: whatever is born from the URL (the pair, the arrival) is re-read here
  useEffect(() => { setPairK(view.defaultPair) }, [view.defaultPair, view.arrival?.changeId, view.video?.id])
  // Focus: ONE place decides it, and only when a video ARRIVES on the screen (a new video, or a new arrival change on the same one).
  // 1. After the pager (Anterior/Próximo or `[` `]`, spec 6.5): the button that was used; the status reads "Vídeo 8 de 51: <título>".
  // 2. Else, on an arrival (spec 6.2): the change's marker (or its group's counter); scroll only when it is out of the visible part of
  //    the scrolling container (the CMS shell scrolls in <main>, not in the window). Its status is read only when the marker took the focus.
  // 3. Else the title takes the focus.
  // Never on a re-render with the same video and the same arrival (another period, `router.refresh()`), and never when the arrival merely
  // goes away on the same video (a period chosen by hand that no longer holds the change): the focus stays where the person put it.
  const arrivalKey = view.arrival ? view.arrival.changeId : ''
  const seen = useRef<{ video: string | undefined; arrival: string } | null>(null)
  useEffect(() => {
    const r = root.current
    const used = pagerUsed.current
    pagerUsed.current = null
    const before = seen.current
    seen.current = { video: view.video?.id, arrival: arrivalKey }
    if (!r || view.state === 'not-found') return
    if (before && before.video === view.video?.id && arrivalKey === '' && !used) return
    // the button that was used, if the video it promised is the one that arrived; when it is gone (end of the list) the other one
    const btn = used && used.to === view.video?.id && view.pager
      ? r.querySelector<HTMLElement>('[data-pager-' + used.which + ']') ?? r.querySelector<HTMLElement>('[data-pager-prev], [data-pager-next]') : null
    if (btn && view.pager) { btn.focus({ preventScroll: true }); setLive(view.pager.status); return }
    const a = view.arrival
    const mark = a ? r.querySelector<HTMLElement>('[data-arrival]') : null
    if (!a || !mark) { r.querySelector<HTMLElement>('.vhead h2')?.focus({ preventScroll: true }); return }
    mark.focus({ preventScroll: true })
    const box = mark.closest('main')?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight }
    const at = mark.getBoundingClientRect()
    if (at.top < box.top + 8 || at.bottom > box.bottom - 8) mark.scrollIntoView?.({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' })
    setLive(a.status)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the arrival is read through its key
  }, [view.video?.id, arrivalKey])
  // `[` and `]` do what Anterior and Próximo do, only with the focus on the title or inside the pager (never in a field, never with a modifier)
  useEffect(() => {
    const pg = view.pager
    if (!pg) return
    const key = (e: KeyboardEvent) => {
      if ((e.key !== '[' && e.key !== ']') || e.ctrlKey || e.metaKey || e.altKey) return
      const which = e.key === '[' ? 'prev' : 'next', href = pg[which]
      const r = root.current, at = document.activeElement as HTMLElement | null
      if (!href || !r || !at || !r.contains(at)) return
      if (at.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return
      if (at !== r.querySelector('.vhead h2') && !at.closest('[data-pager]')) return
      e.preventDefault()
      onPage(which, href)
      router.replace(href)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [view.pager, router, onPage])
  // the last video seen from a channel page: its page puts the focus on that card when the person comes back
  const fromChannel = view.crumbs.canal, videoId = view.video?.id
  useEffect(() => { if (fromChannel && videoId) lembrarUltimoVideo(fromChannel, videoId) }, [fromChannel, videoId])
  useEffect(() => {
    const t = view.video?.nicheToast
    if (t && toasted.current !== view.video!.id) { toasted.current = view.video!.id; toast('', t, '') }
  }, [view.video, toast])

  const goVersion = (type: LaneType, i: number) => {
    const find = () => root.current?.querySelector<HTMLElement>('[data-ver="' + type + ':' + i + '"]')
    let t = find()
    // a period the collapsed grid hides: open the grid first, then go
    if (t?.hidden) { flushSync(() => setExpanded(true)); t = find() }
    if (!t) return
    setTarget(type + ':' + i)
    t.scrollIntoView?.({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' })
    t.focus({ preventScroll: true })
  }
  const selectPair = (k: string) => {
    // a change the list filters hide: clear the filters, then select
    const cmp = view.comparisons.find(x => x.changeId === k)
    if (cmp && ((flt.field !== 'all' && cmp.field !== flt.field) || (flt.situation !== 'all' && cmp.situation !== flt.situation))) setFlt(NO_FILTER)
    setPairK(k)
    const c = root.current?.querySelector<HTMLElement>('#hv-compare')
    c?.scrollIntoView?.({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })
    setTimeout(() => root.current?.querySelector<HTMLElement>('#hv-compare .pair[aria-pressed="true"], #hv-compare [role="option"][aria-selected="true"]')?.focus({ preventScroll: true }), 0)
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
  const pv = view.pinView
  // outside the observed ones the stored count is frozen, and a just-pinned video (or one YouTube did not return) was not checked yet: no views, no sync (D11, D13)
  const quiet = !!view.untracked || view.pin?.state === 'aguardando-primeira' || view.pin?.state === 'sem-resposta'
  const notice = view.untracked?.notice ?? '', cut = notice.indexOf('. ') + 1
  return (
    <PinProvider onPin={onPin} onUnpin={onUnpin}>
      <div data-obs-screen="historico" data-state={view.state} ref={root}>
        <div className="page">
          <Crumbs crumbs={view.crumbs} pager={view.pager} onPage={onPage} />
          {/* DOM order = screen order: thumbnail, title, actions, facts and chips. Only the title (which never changes) is
              before the actions row, so the pin button keeps its rectangle whatever appears below. */}
          <section className="vhead" id="vhead" aria-label="Vídeo">
            <div className="cur"><Thumb t={h.thumb} dur={h.dur} /></div>
            <div className="vt"><h2 tabIndex={-1}>{v.title}</h2></div>
            <div className="actions">
              <div className="fx-top">
                <div className="arow">
                  {pv ? <PinButton pin={pv} className="btn" /> : null}
                  <a className="btn" href={v.url} target="_blank" rel="noopener noreferrer"><HIcon name="ext" />Abrir no YouTube</a>
                </div>
                <div className="fx-under">{pv ? <PinMessage k={pv.videoId} /> : null}</div>
              </div>
              {view.forja && view.forjaCard ? <div className="frow"><ForjaAskButton forja={view.forja} card={view.forjaCard} onAsk={onAskForja} /></div> : null}
            </div>
            <div className="vm">
              <div className="facts">
                <span className="chan">
                  <ChannelAvatar src={h.chan.avatar} ini={h.chan.ini} color={h.chan.color} />{h.chan.name}
                  {h.chan.niche ? <span className="niche">{h.chan.niche}</span> : null}
                </span>
                {quiet ? null : <span>{h.views.num ? <><b className="mono">{h.views.num}</b>{h.views.text}</> : h.views.text}</span>}
                <span>publicado <b title={h.pub.full}>{h.pub.age}</b> <span className="mono">({h.pub.full})</span></span>
                <span>{h.fmt}</span>
                {quiet ? null : <span className={h.sync.bad ? 'syncbad' : undefined} title={h.sync.title || undefined}>{h.sync.bad ? <HIcon name="warn" /> : null}{h.sync.text}</span>}
                {view.untracked ? null : <span title={h.mult.title || undefined}>{h.mult.text}</span>}
              </div>
              {h.fallback && !view.untracked ? <div className="fallback">{h.fallback}</div> : null}
              {(pv && pv.chips.length) || h.counts.length ? (
                <div className="counts">
                  {pv ? <PinChips chips={pv.chips} /> : null}
                  {h.counts.map((c, i) => <span key={i} className="count">{c.type ? <i style={{ background: TYPE_COLOR[c.type] }} aria-hidden="true" /> : null}{c.text}</span>)}
                </div>
              ) : null}
            </div>
          </section>
          <p className="sr" id="hv-live" role="status">{live}</p>
          {view.untracked ? (
            <>
              <section className="card fx-notice" data-untracked="" aria-label="Vídeo fora dos acompanhados">
                <PinIcon name="out" />
                <p className="fx-what"><strong>{cut > 0 ? notice.slice(0, cut) : notice}</strong>{cut > 0 ? notice.slice(cut) : ''}</p>
              </section>
              {view.lanesAxis ? (
                <Timeline chart={null} axis={view.lanesAxis} lanes={view.lanes} legend={view.legends[''] ?? []} pair={null} hl={hl} onHl={onHl}
                  onSelectPair={selectPair} onGoVersion={goVersion} groupLegend={view.groupLegend} />
              ) : null}
              {view.versions ? <Versions versions={view.versions} hl={hl} onHl={onHl} expanded={expanded} onToggle={() => setExpanded(e => !e)} target={target} onTargetBlur={() => setTarget(null)} /> : null}
            </>
          ) : (
            <>
              {view.chart ? (
                <Timeline chart={view.chart} lanes={view.lanes} legend={legend} pair={pair} hl={hl} onHl={onHl}
                  onSelectPair={selectPair} onGoVersion={goVersion} range={view.range} onRange={onRange} groupLegend={view.groupLegend} arrivalId={view.arrival?.changeId ?? null} />
              ) : null}
              {view.imageSummary ? <ImageSummary sum={view.imageSummary} active={hl?.label ?? null} pinned={pinImg} onHover={l => setHover(l ? { type: 'thumb', i: -1, ev: null, label: l } : null)} onPin={pinImage} /> : null}
              <Compare comparisons={view.comparisons} compare={view.compare} selected={pairK} empty={view.compareEmpty} onSelect={setPairK} onDescLink={openDesc}
                filter={flt} onFilter={setFlt} onWholeVideo={() => onRange('tudo')} arrival={view.arrival} />
              {view.forja && view.forjaCard ? <VideoReading card={view.forjaCard} forja={view.forja} onCancel={onCancelForja} /> : null}
              {view.versions ? <Versions versions={view.versions} hl={hl} onHl={onHl} expanded={expanded} onToggle={() => setExpanded(e => !e)} target={target} onTargetBlur={() => setTarget(null)} /> : null}
            </>
          )}
        </div>
      </div>
    </PinProvider>
  )
}
