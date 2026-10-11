'use client'
/**
 * Histórico do vídeo (port of historico-video.html): header, the views/day curve with every version of title,
 * thumbnail and description, the before/after comparison per change, and the versions. The forja (Task 35): the
 * screen's single filled button in the video header and the "Leitura da forja" card below the comparison.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { lembrarUltimoVideo, renovarUltimoVideo } from '../_chrome/ultimo-video'
import { DOUBLE_CLICK_MS } from '../_canal/use-rolagem-ao-voltar'
import { useAvisoLeituraPublicada, useForjaRefresh } from '../_chrome/use-forja-refresh'
import { marcarPagerUsado, tomarPagerUsado, videoDoHref } from './pager-usado'
import { currentFlut } from '../_chrome/flut/store'
import type { HistoricoView, LaneType } from './view-model'
import type { Hl } from './lanes'
import { Pager } from './pager'
import { Timeline } from './views-chart'
import { Compare, NO_FILTER, type CompareFilter } from './compare'
import { ImageSummary } from './image-summary'
import { useGo } from '../_mudancas/filters'
import { Versions } from './versions'
import { HIcon, TYPE_COLOR } from './icons'
import { Thumb, type ThumbZoom } from './thumb'
import { useThumbViewer } from '../_chrome/thumb-viewer/thumb-viewer'
import { ForjaCard, HeaderAskButton, usePedidoForja } from './forja-card'
import { headerAsk } from './forja-card-model'
import type { ForjaAsk, ForjaCancel } from '../_chrome/forja-view-model'
import { ChannelAvatar } from '../_chrome/channel-avatar'
import { PinProvider, PinButton, PinMessage, PinChips, PinIcon, type PinAction } from '../_chrome/pin-kit'

const reduced = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * `pagerNaTrilha`: a página já pôs o pager na linha da trilha da moldura (mockup aprovado: trilha à esquerda, pager à direita, a mesma linha);
 * a tela não o desenha de novo, mas continua sendo ela que decide o foco depois de Anterior/Próximo e que atende `[` e `]`, então procura os
 * botões em toda a moldura (`[data-obs]`), não só na própria raiz.
 */
export function HistoricoScreen({ view, onAskForja, onCancelForja, onSyncChannel, onPin, onUnpin, pagerNaTrilha = false }: {
  view: HistoricoView; onAskForja?: ForjaAsk; onCancelForja?: ForjaCancel
  /** "Sincronizar este canal" (a situação "Precisa de você"): a mesma ação de servidor que a página do canal usa. */
  onSyncChannel?: (channelRowId: string) => Promise<{ ok: boolean }>
  onPin?: PinAction; onUnpin?: PinAction; pagerNaTrilha?: boolean
}) {
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
  // The thumbnail viewer (spec 6.3, triggers 1 to 4). If its trigger is gone when it closes (another period, a new list) the focus goes to the
  // video's title, never to the body. Found through the root's ref: after a Voltar Next keeps the old tree hidden in the document.
  const { open: openViewer, node: viewerNode } = useThumbViewer({ fallback: () => root.current?.querySelector<HTMLElement>('.vhead h2') ?? null })
  const viewer = view.viewer
  const ampliar = useCallback((i: number, trigger: HTMLElement | null) => { if (viewer) openViewer({ ...viewer, start: i }, trigger) }, [viewer, openViewer])
  /** The trigger of the thumbnail of version `i` ("Capa B"); null/out of range = not a version, so not a button. */
  const zoomOf = (i: number | null): ThumbZoom | undefined => {
    const ver = viewer && i != null ? viewer.versions[i] : undefined
    return ver ? { label: 'Ampliar a thumbnail: ' + ver.label, onOpen: el => ampliar(i!, el) } : undefined
  }
  // Which pager button (or key) was used and the video it leads to lives OUTSIDE this component (pager-usado.ts): Anterior/Próximo change the
  // `[id]` segment, Next may remount the screen, and a ref would be born empty in the new one.
  const onPage = useCallback((which: 'prev' | 'next', href: string) => { marcarPagerUsado(which, videoDoHref(href)) }, [])
  // 30 days is the default (spec 6.4): it leaves the URL; `tudo` is written out. While the URL carries a `troca=` the period may be widened by
  // that change whenever `range` is absent (the model's rule), so every choice (30 included) is written out: dropping it would hand the period
  // back to the change (7 d, then 30 d, and the screen would jump to 90 d). The test is the URL, not `view.arrival`: the arrival is gone as soon
  // as a smaller period is chosen, and `troca=` stays.
  const search = useSearchParams()
  const comTroca = view.arrival != null || !!search?.get('troca')
  const onRange = (id: string) => go({ range: id === '30' && !comTroca ? null : id })
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
  // Next 16 keeps this component when only the query changes: whatever is born from the URL (the pair, the arrival) is re-read here
  useEffect(() => { setPairK(view.defaultPair) }, [view.defaultPair, view.arrival?.changeId, view.video?.id])
  // Focus: ONE place decides it, and only when a video ARRIVES on the screen (a new video, or a new arrival change on the same one).
  // 1. After the pager (Anterior/Próximo or `[` `]`, spec 6.5): the button that was used; the status reads "Vídeo 8 de 51: <título>".
  // 2. Else, on an arrival (spec 6.2): the change's marker (or its group's counter); scroll only when it is out of the visible part of
  //    the scrolling container (the CMS shell scrolls in <main>, not in the window). Its status is read only when the marker took the focus.
  // 3. Else the title takes the focus.
  // Never on a re-render with the same video and the same arrival (another period, `router.refresh()`), never when the arrival merely
  // goes away on the same video (a period chosen by hand that no longer holds the change), and never when it COMES BACK (another period
  // that holds the same change again): the arrival is read once per video opened. The focus stays where the person put it.
  const arrivalKey = view.arrival ? view.arrival.changeId : ''
  const seen = useRef<{ video: string | undefined; arrival: string; last: string } | null>(null)
  useEffect(() => {
    const r = root.current
    const used = tomarPagerUsado()
    const before = seen.current
    const sameVideo = !!before && before.video === view.video?.id
    // the last arrival this video had on screen: coming back to it (a period that holds it again) is not an arrival
    seen.current = { video: view.video?.id, arrival: arrivalKey, last: arrivalKey || (sameVideo ? before.last : '') }
    if (!r || view.state === 'not-found') return
    const frame = r.closest<HTMLElement>('[data-obs]') ?? r   // the pager may live in the frame's trail row (pagerNaTrilha)
    if (sameVideo && !used && (arrivalKey === '' || arrivalKey === before.last)) return
    // the button that was used, if the video it promised is the one that arrived; when it is gone (end of the list) the other one
    const btn = used && used.to === view.video?.id && view.pager
      ? frame.querySelector<HTMLElement>('[data-pager-' + used.which + ']') ?? frame.querySelector<HTMLElement>('[data-pager-prev], [data-pager-next]') : null
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
      if ((e.key !== '[' && e.key !== ']') || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return
      const which = e.key === '[' ? 'prev' : 'next', href = pg[which]
      const r = root.current, at = document.activeElement as HTMLElement | null
      const frame = r?.closest<HTMLElement>('[data-obs]') ?? r
      if (!href || !r || !at || !frame || !frame.contains(at)) return
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
  // the record expires (30 min): leaving through any link of this screen renews it, so a long visit still gets its focus back on the Voltar
  useEffect(() => {
    if (!fromChannel) return
    const leave = (e: MouseEvent) => { if ((e.target as Element | null)?.closest?.('a[href]') && root.current?.contains(e.target as Node)) renovarUltimoVideo(fromChannel) }
    document.addEventListener('click', leave, true)
    return () => document.removeEventListener('click', leave, true)
  }, [fromChannel])
  // While a forja request is in progress the screen refreshes itself (it used to come with the whole frame; the trail-only frame has no such
  // effect, D7), and a request that reaches "publicado" says so once.
  // "Pausar atualização automática" (spec 11, linha 14) vive aqui porque o efeito mora aqui; outro vídeo começa sem pausa.
  const [pausado, setPausado] = useState(false)
  useEffect(() => { setPausado(false) }, [view.video?.id])
  // a pausa vale para o pedido em que foi feita: quando ele acaba (ou é cancelado), o pedido seguinte começa sem pausa
  const forjaAtiva = !!view.forja?.status?.active
  useEffect(() => { if (!forjaAtiva) setPausado(false) }, [forjaAtiva])
  const { lastAt } = useForjaRefresh(forjaAtiva, pausado)
  useAvisoLeituraPublicada(view.forja)
  // "Tela atualizada há N min": o último refresh do intervalo, ou a chegada de uma tela nova (o pedido, o cancelar e o sincronizar também atualizam)
  const [telaEm, setTelaEm] = useState(() => Date.now())
  useEffect(() => { setTelaEm(Date.now()) }, [view])
  // The one request (both forja buttons send it) and the card the header button scrolls to, found through the screen's ref
  const cardRef = useRef<HTMLElement>(null)
  const pedido = usePedidoForja({ forja: view.forja, onAsk: onAskForja, videoId: view.video?.id, situacao: view.forjaCard?.situacao ?? null })
  const forjaCard = view.forja && view.forjaCard ? view.forjaCard : null
  const atualizacao = { paused: pausado, onTogglePause: () => setPausado(p => !p), lastAt: Math.max(lastAt, telaEm) }
  const cartao = forjaCard && view.forja && view.video
    ? <ForjaCard key={view.video.id} card={forjaCard} forja={view.forja} pedido={pedido} onCancel={onCancelForja} onSyncChannel={onSyncChannel} refresh={atualizacao} cardRef={cardRef} say={setLive} />
    : null

  // Clique de ponteiro na miniatura da raia Thumbnail (spec 6.3, gatilho 4): o alvo é marcado na hora, mas a rolagem e o foco no cartão esperam a janela do
  // duplo clique, e o segundo clique a cancela. Rolar no primeiro clique tirava a miniatura de baixo do cursor: o segundo caía em outro elemento.
  // Teclado (`detail === 0`) e as outras raias não esperam.
  const clipTimer = useRef<number | null>(null)
  const cancelClip = () => { if (clipTimer.current != null) { window.clearTimeout(clipTimer.current); clipTimer.current = null } }
  useEffect(() => cancelClip, [])
  // another video (Next 16 keeps this component when only the `[id]` changes): the scroll the click was waiting to do would land on the new video's card
  useEffect(() => { cancelClip() }, [view.video?.id])
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
  const onClip = (type: LaneType, i: number, detail?: number) => {
    cancelClip()
    if (type !== 'thumb' || !detail) { goVersion(type, i); return }
    if (detail > 1) return                                   // o segundo clique do duplo: o dblclick abre o visualizador
    setTarget(type + ':' + i)
    clipTimer.current = window.setTimeout(() => { clipTimer.current = null; goVersion(type, i) }, DOUBLE_CLICK_MS)
  }
  const onClipDouble = (i: number, trigger: HTMLElement) => { cancelClip(); setTarget(null); ampliar(i, trigger) }
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
          {pagerNaTrilha ? null : <Pager pager={view.pager} onPage={onPage} />}
          {/* DOM order = screen order: thumbnail, title, actions, facts and chips. Only the title (which never changes) is
              before the actions row, so the pin button keeps its rectangle whatever appears below. */}
          <section className="vhead" id="vhead" aria-label="Vídeo">
            <div className="cur"><Thumb t={h.thumb} dur={h.dur} zoom={zoomOf(viewer ? viewer.start : null)} /></div>
            <div className="vt"><h2 tabIndex={-1}>{v.title}</h2></div>
            <div className="actions">
              <div className="fx-top">
                <div className="arow">
                  {pv ? <PinButton pin={pv} className="btn" /> : null}
                  <a className="btn" href={v.url} target="_blank" rel="noopener noreferrer"><HIcon name="ext" />Abrir no YouTube</a>
                </div>
                <div className="fx-under">{pv ? <PinMessage k={pv.videoId} /> : null}</div>
              </div>
              {forjaCard ? <div className="frow"><HeaderAskButton ask={headerAsk(forjaCard)} pedido={pedido} cardRef={cardRef} say={setLive} videoId={view.video?.id} bloqueado={forjaCard.botao.por === 'bloqueado' ? forjaCard.bloqueado : null} /></div> : null}
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
                  onSelectPair={selectPair} onGoVersion={onClip} onZoomVersion={viewer ? onClipDouble : undefined} groupLegend={view.groupLegend} />
              ) : null}
              {forjaCard?.situacao != null ? cartao : null}
              {view.versions ? <Versions versions={view.versions} hl={hl} onHl={onHl} expanded={expanded} onToggle={() => setExpanded(e => !e)} target={target} onTargetBlur={() => setTarget(null)} zoomOf={zoomOf} /> : null}
            </>
          ) : (
            <>
              {view.chart ? (
                <Timeline chart={view.chart} lanes={view.lanes} legend={legend} pair={pair} hl={hl} onHl={onHl}
                  onSelectPair={selectPair} onGoVersion={onClip} onZoomVersion={viewer ? onClipDouble : undefined} range={view.range} onRange={onRange} groupLegend={view.groupLegend} arrivalId={view.arrival?.changeId ?? null} />
              ) : null}
              {view.imageSummary ? <ImageSummary sum={view.imageSummary} active={hl?.label ?? null} pinned={pinImg} onHover={l => setHover(l ? { type: 'thumb', i: -1, ev: null, label: l } : null)} onPin={pinImage} /> : null}
              <Compare comparisons={view.comparisons} compare={view.compare} selected={pairK} empty={view.compareEmpty} onSelect={setPairK} onDescLink={openDesc}
                filter={flt} onFilter={setFlt} onWholeVideo={() => onRange('tudo')} arrival={view.arrival} zoomOf={zoomOf} />
              {cartao}
              {view.versions ? <Versions versions={view.versions} hl={hl} onHl={onHl} expanded={expanded} onToggle={() => setExpanded(e => !e)} target={target} onTargetBlur={() => setTarget(null)} zoomOf={zoomOf} /> : null}
            </>
          )}
        </div>
        {viewerNode}
      </div>
    </PinProvider>
  )
}
