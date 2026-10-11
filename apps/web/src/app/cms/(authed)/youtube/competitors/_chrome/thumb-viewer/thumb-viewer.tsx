'use client'
/**
 * Visualizador de thumbnail (spec telas v9, 6.3 e 11 linha 7): diálogo modal com zoom, troca de versão e comparação lado a lado.
 * Compartilhado: quem abre (Histórico, canal) monta `useThumbViewer()` e põe `node` na árvore.
 *
 * Camadas: o diálogo mora em um contêiner PRÓPRIO no fim do <body> (data-obs, para herdar os tokens), em `--z-modal`.
 * Ele NÃO usa Popover nem HoverTip: `#flut` fica em `--z-flutuante` (1000), abaixo do modal (2000), e uma dica aberta ali
 * ficaria escondida atrás do diálogo. Tudo o que o diálogo explica é texto visível.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../icons'
import { focusables } from '../flut/store'
import { candidates, downloadName, fileOf, isYoutubeUrl, missingText, positionLabel, PLACEHOLDER_MAX_W, resolutionLine, type ViewerInput, type ViewerVersion } from './viewer-model'
import { clampView, fit, isFit, pan, zoomAt, zoomTo, type Point, type Size, type View } from './zoom'
import './thumb-viewer.css'

/* ---------------------------------------------------------------- carga da imagem */
interface Loaded { url: string; file: string; w: number; h: number; fellBack: boolean; archived: boolean }
type LoadState = { status: 'none' } | { status: 'loading' } | { status: 'fail' } | ({ status: 'ok' } & Loaded)

const probe = (url: string): Promise<Size | null> => new Promise(done => {
  const im = new Image()
  im.onload = () => done({ w: im.naturalWidth, h: im.naturalHeight })
  im.onerror = () => done(null)
  im.src = url
})

/** A primeira URL da lista que carrega. O quadro de 120×90 com que o YouTube responde a uma variante que não existe não vale. */
async function loadFirst(urls: string[], archivedUrl: string | null): Promise<Loaded | null> {
  for (const [i, url] of urls.entries()) {
    const p = await probe(url)
    if (!p || p.w <= 0 || p.h <= 0) continue
    if (isYoutubeUrl(url) && p.w <= PLACEHOLDER_MAX_W) continue
    return { url, file: fileOf(url), w: p.w, h: p.h, fellBack: isYoutubeUrl(url) && i > 0, archived: url === archivedUrl }
  }
  return null
}

function useLoaded(v: ViewerVersion | undefined): LoadState {
  const key = v ? candidates(v).join('|') : ''
  const archivedUrl = v?.archived ?? null
  const [res, setRes] = useState<{ key: string; r: Loaded | null } | null>(null)
  useEffect(() => {
    if (!key) return
    let live = true
    void loadFirst(key.split('|'), archivedUrl).then(r => { if (live) setRes({ key, r }) })
    return () => { live = false }
  }, [key, archivedUrl])
  if (!key) return { status: 'none' }
  if (res?.key !== key) return { status: 'loading' }
  return res.r ? { status: 'ok', ...res.r } : { status: 'fail' }
}

/* ---------------------------------------------------------------- peças */
function Missing({ children }: { children: ReactNode }): ReactElement {
  return <div className="obs-tv-miss"><div>{children}</div></div>
}
function Frame({ v, state }: { v: ViewerVersion; state: LoadState }): ReactElement {
  if (state.status === 'none') return <Missing><p>{missingText(v)}</p></Missing>
  if (state.status === 'fail') return <Missing><p><b>A imagem não carregou.</b></p></Missing>
  if (state.status === 'loading') return <Missing><p>Carregando a imagem…</p></Missing>
  return <div className="obs-tv-fig"><img src={state.url} alt={`${v.label}`} draggable={false} /></div>
}
const resText = (s: LoadState): string => (s.status === 'ok' ? resolutionLine(s.file, s.w, s.h, s.fellBack, s.archived) : s.status === 'loading' ? 'Carregando a imagem…' : '')

const STEP = 1.25
const ARROW_PX = 60

export function ThumbViewer({ input, onClose, trigger }: { input: ViewerInput; onClose: () => void; trigger?: HTMLElement | null }): ReactElement | null {
  const { title, versions } = input
  const n = versions.length
  const uid = useId()
  const titleId = `${uid}-t`, capId = `${uid}-c`, whyId = `${uid}-w`, cmpId = `${uid}-s`

  const [host] = useState<HTMLElement | null>(() => {
    if (typeof document === 'undefined') return null
    const el = document.createElement('div')
    el.setAttribute('data-obs', '')
    el.className = 'obs-tv-host'
    return el
  })
  const [opener] = useState<HTMLElement | null>(() => trigger ?? (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null))
  const [i, setI] = useState(() => Math.max(0, Math.min(n - 1, input.start)))
  const [cmp, setCmp] = useState(false)
  const [other, setOther] = useState(0)
  const [msg, setMsg] = useState('')
  const [box, setBox] = useState<Size>({ w: 0, h: 0 })
  const [cv, setCv] = useState<{ key: string; v: View } | null>(null)

  const cur = versions[i] as ViewerVersion | undefined
  const o = other !== i && other < n ? other : i === 0 ? 1 : i - 1
  const second = cmp && n > 1 ? versions[o] : undefined
  const main = useLoaded(cur)
  const sideState = useLoaded(second)

  const titleRef = useRef<HTMLHeadingElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  /* ---- zoom derivado: nada de efeito para "ajustar quando a imagem chega" ---- */
  const loaded = main.status === 'ok' ? main : null
  const stageOn = !cmp && loaded != null
  const img: Size | null = loaded ? { w: loaded.w, h: loaded.h } : null
  const key = loaded?.url ?? ''
  const shown: View | null = img ? (cv && cv.key === key ? clampView(cv.v, img, box) : fit(img, box)) : null
  const zoomed = !!(shown && img && !isFit(shown, img, box))
  const latest = useRef({ shown, img, box, key, stageOn })
  useLayoutEffect(() => { latest.current = { shown, img, box, key, stageOn }; onCloseRef.current = onClose })

  const commit = useCallback((v: View) => {
    const L = latest.current
    if (!L.img) return
    setCv(isFit(v, L.img, L.box) ? null : { key: L.key, v })
  }, [])
  const center = (): Point => ({ x: latest.current.box.w / 2, y: latest.current.box.h / 2 })
  const say = useCallback((t: string) => setMsg(t), [])
  const withView = useCallback((f: (L: { shown: View; img: Size; box: Size }) => View | null, then?: (v: View) => string) => {
    const L = latest.current
    if (!L.stageOn || !L.shown || !L.img) return
    const v = f({ shown: L.shown, img: L.img, box: L.box })
    if (!v) return
    commit(v)
    if (then) say(then(v))
  }, [commit, say])
  const zoomBy = (f: number) => withView(L => zoomAt(L.shown, f, center(), L.img, L.box), v => `Zoom ${Math.round(v.scale * 100)}%`)
  const doFit = () => withView(L => fit(L.img, L.box), v => `Ajustado à janela, ${Math.round(v.scale * 100)}%`)
  const actual = () => withView(L => zoomTo(L.shown, 1, center(), L.img, L.box), () => 'Tamanho real, 100%: um pixel da imagem por pixel da tela.')

  /* ---- montagem: contêiner no <body>, fundo inerte, foco no título, e o caminho de volta ---- */
  useLayoutEffect(() => {
    if (!host) return
    document.body.appendChild(host)
    const back = [...document.body.children].filter(e => e !== host).map(e => [e, e.getAttribute('inert')] as const)
    for (const [e] of back) e.setAttribute('inert', '')
    titleRef.current?.focus()
    return () => {
      for (const [e, antes] of back) { if (antes === null) e.removeAttribute('inert'); else e.setAttribute('inert', antes) }
      host.remove()
      if (opener?.isConnected) opener.focus()
    }
  }, [host, opener])

  // Esc fecha qualquer que seja o foco (captura: a camada de cima responde primeiro)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCloseRef.current() } }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [])

  /* ---- medida da caixa e roda do mouse (não passiva) ---- */
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => setBox(b => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }))
    measure()
    const onWheel = (e: WheelEvent) => {
      const L = latest.current
      if (!L.shown || !L.img) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      commit(zoomAt(L.shown, Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left, y: e.clientY - r.top }, L.img, L.box))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(measure); ro.observe(el) } else window.addEventListener('resize', measure)
    return () => { el.removeEventListener('wheel', onWheel); ro?.disconnect(); window.removeEventListener('resize', measure) }
  }, [stageOn, key, commit])

  /* ---- arrastar e pinça ---- */
  const pointers = useRef(new Map<number, Point>())
  const drag = useRef<{ x: number; y: number; v: View } | null>(null)
  const pinch = useRef<{ d: number; scale: number } | null>(null)
  const two = (): [Point, Point] | null => { const [a, b] = [...pointers.current.values()]; return a && b ? [a, b] : null }
  const dist = () => { const p = two(); return p ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0 }
  const mid = (): Point => { const p = two(), r = stageRef.current?.getBoundingClientRect(); return p && r ? { x: (p[0].x + p[1].x) / 2 - r.left, y: (p[0].y + p[1].y) / 2 - r.top } : center() }
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const L = latest.current
    if (!L.shown) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (pointers.current.size === 2) { pinch.current = { d: dist() || 1, scale: L.shown.scale }; drag.current = null } else drag.current = { x: e.clientX, y: e.clientY, v: L.shown }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const L = latest.current
    if (!L.shown || !L.img) return
    if (pointers.current.size === 2 && pinch.current) commit(zoomTo(L.shown, pinch.current.scale * dist() / pinch.current.d, mid(), L.img, L.box))
    else if (drag.current) commit(pan(drag.current.v, e.clientX - drag.current.x, e.clientY - drag.current.y, L.img, L.box))
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) drag.current = null
  }
  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const L = latest.current
    if (!L.shown || !L.img) return
    if (!isFit(L.shown, L.img, L.box)) { doFit(); return }
    const r = e.currentTarget.getBoundingClientRect()
    commit(zoomTo(L.shown, 1, { x: e.clientX - r.left, y: e.clientY - r.top }, L.img, L.box))
    say('Tamanho real, 100%: um pixel da imagem por pixel da tela.')
  }

  /* ---- versões, comparar, abrir, baixar ---- */
  const go = (d: number) => { const k = i + d; if (k < 0 || k >= n) return; setI(k); setMsg('') }
  const downloading = useRef(false)
  const download = async () => {
    if (!cur || main.status !== 'ok' || downloading.current) return
    downloading.current = true
    const nome = downloadName(cur, main.file, main.archived), url = main.url
    try {
      const r = await fetch(url, { mode: 'cors' })
      if (!r.ok) throw new Error(String(r.status))
      const href = URL.createObjectURL(await r.blob())
      const a = document.createElement('a')
      a.href = href; a.download = nome
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(href), 4000)
      say(`Download iniciado: ${nome}`)
    } catch {
      // CORS do host da imagem ou a política de conteúdo do site: abre a imagem e deixa o navegador salvar
      window.open(url, '_blank', 'noopener')
      say('O navegador não deixou baixar direto. A imagem abriu em outra aba: salve por lá.')
    } finally { downloading.current = false }
  }

  /* ---- teclado ---- */
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      const root = boxRef.current, t = titleRef.current
      if (!root || !t) return
      const ring = [t, ...focusables(root)]
      const first = ring[0] ?? t, last = ring[ring.length - 1] ?? t, active = document.activeElement
      if (e.shiftKey && (active === first || !root.contains(active))) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (active === last || !root.contains(active))) { e.preventDefault(); first.focus() }
      return
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return
    if (e.target instanceof HTMLSelectElement) return
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(STEP) }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(1 / STEP) }
    else if (e.key === '0') { e.preventDefault(); doFit() }
    else if (e.key === '1') { e.preventDefault(); actual() }
    else if (e.target === stageRef.current && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault()
      if (zoomed) {
        const dx = e.key === 'ArrowLeft' ? ARROW_PX : e.key === 'ArrowRight' ? -ARROW_PX : 0
        const dy = e.key === 'ArrowUp' ? ARROW_PX : e.key === 'ArrowDown' ? -ARROW_PX : 0
        withView(L => pan(L.shown, dx, dy, L.img, L.box))
      } else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
  }

  if (!host) return null

  const multi = n > 1
  const zoomOn = stageOn
  const pct = cmp ? 'sem zoom' : shown ? `${Math.round(shown.scale * 100)}%` : '—'
  const opened = main.status === 'ok' ? main.url : null
  const noop = (f: () => void) => (zoomOn ? f : undefined)

  return createPortal(
    <div className="obs-tv" onKeyDown={onKeyDown}>
      <div className="obs-tv-back" onClick={onClose} />
      <div className="obs-tv-box" ref={boxRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={cmp ? undefined : capId}>
        <div className="obs-tv-top">
          <h2 id={titleId} ref={titleRef} tabIndex={-1}>{`Thumbnail: ${title}`}</h2>
          <button type="button" className="obs-tv-b obs-tv-icon" aria-label="Fechar" onClick={onClose}><Icon.x /></button>
        </div>

        <div className="obs-tv-nav" role="group" aria-label="Versão da thumbnail">
          {multi && cur ? (
            <>
              <button type="button" className="obs-tv-b" aria-disabled={i === 0} onClick={() => go(-1)}><Icon.prev /><span>Anterior</span></button>
              <span className="obs-tv-pos" role="status">{positionLabel(cur.label, i, n)}</span>
              <button type="button" className="obs-tv-b" aria-disabled={i === n - 1} onClick={() => go(1)}><span>Próxima</span><Icon.next /></button>
            </>
          ) : null}
          <button type="button" className="obs-tv-b obs-tv-cmpbtn" aria-pressed={cmp} aria-disabled={!multi} aria-describedby={multi ? undefined : whyId}
            onClick={() => { if (multi) setCmp(c => !c) }}><Icon.compare /><span>Comparar lado a lado</span></button>
          {multi ? null : <span id={whyId} className="obs-tv-why">Só há uma versão de thumbnail deste vídeo.</span>}
          {cmp && multi ? (
            <label className="obs-tv-sel" htmlFor={cmpId}><span>Comparar com</span>
              <select id={cmpId} value={o} onChange={e => setOther(Number(e.target.value))}>
                {versions.map((v, k) => (k === i ? null : <option key={k} value={k}>{v.label}{candidates(v).length ? '' : ' (não arquivada)'}</option>))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="obs-tv-main">
          {!cur ? <Missing><p>Este vídeo não tem versão de thumbnail registrada.</p></Missing>
            : cmp && second ? (
              <div className="obs-tv-cmp">
                {([[cur, main], [second, sideState]] as const).map(([v, s]) => (
                  <div className="obs-tv-side" key={v.label + (v === cur ? 'a' : 'b')}>
                    <p className="obs-tv-lab">{v.label}{v.current ? ' (no ar)' : ''}</p>
                    <Frame v={v} state={s} />
                    <p className="obs-tv-cap">{v.caption}</p>
                    {s.status === 'ok' ? <p className="obs-tv-cap">{resText(s)}</p> : null}
                  </div>
                ))}
              </div>
            )
            : loaded && shown ? (
              <div className="obs-tv-stage" ref={stageRef} tabIndex={0} role="img" data-zoomed={zoomed || undefined}
                aria-label={`${cur.label}, ${title}. Setas movem a imagem ou trocam de versão; mais e menos dão zoom; 0 ajusta; 1 mostra a 100%.`}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onDoubleClick={onDoubleClick}>
                <img src={loaded.url} alt="" draggable={false} style={{ width: loaded.w, height: loaded.h, transform: `translate(${shown.x}px,${shown.y}px) scale(${shown.scale})` }} />
              </div>
            )
            : <Frame v={cur} state={main} />}
        </div>

        <div className="obs-tv-info">
          {cmp || !cur ? null : <p id={capId} className="obs-tv-cap">{cur.caption}</p>}
          {cmp ? null : <p className="obs-tv-res" role="status" aria-live="polite" aria-atomic="true">{resText(main)}</p>}
          <p className="obs-tv-msg" role="status" aria-live="polite" aria-atomic="true">{cmp && cur && second ? `Comparando ${cur.label} com ${second.label}` : msg}</p>
        </div>

        <div className="obs-tv-foot">
          <div className="obs-tv-grp" role="group" aria-label="Zoom">
            <button type="button" className="obs-tv-b obs-tv-icon" aria-label="Diminuir o zoom" aria-disabled={!zoomOn} onClick={noop(() => zoomBy(1 / STEP))}><Icon.minus /></button>
            <span className="obs-tv-pct">{pct}</span>
            <button type="button" className="obs-tv-b obs-tv-icon" aria-label="Aumentar o zoom" aria-disabled={!zoomOn} onClick={noop(() => zoomBy(STEP))}><Icon.plus /></button>
            <button type="button" className="obs-tv-b" aria-disabled={!zoomOn} onClick={noop(doFit)}>Ajustar</button>
            <button type="button" className="obs-tv-b" aria-disabled={!zoomOn} onClick={noop(actual)}>100%</button>
          </div>
          <div className="obs-tv-grp" role="group" aria-label="Arquivo">
            <a className="obs-tv-b" role="link" target="_blank" rel="noopener noreferrer" href={opened ?? undefined} aria-disabled={opened ? undefined : true}>
              <Icon.ext /><span>Abrir original em nova aba<span className="obs-tv-sr"> (abre em nova aba)</span></span>
            </a>
            <button type="button" className="obs-tv-b" aria-disabled={!opened} onClick={opened ? () => { void download() } : undefined}><Icon.download /><span>Baixar</span></button>
          </div>
        </div>
      </div>
    </div>,
    host,
  )
}

/**
 * O gancho de quem abre: `open(input, gatilho)` mostra o diálogo; o gatilho é onde o foco volta ao fechar.
 * `node` vai em qualquer lugar da árvore (o diálogo sai por portal no fim do <body>).
 */
export function useThumbViewer(): { open: (input: ViewerInput, trigger: HTMLElement | null) => void; node: ReactNode } {
  const [st, setSt] = useState<{ input: ViewerInput; trigger: HTMLElement | null; seq: number } | null>(null)
  const seq = useRef(0)
  const open = useCallback((input: ViewerInput, trigger: HTMLElement | null) => setSt({ input, trigger, seq: ++seq.current }), [])
  const close = useCallback(() => setSt(null), [])
  const node = st ? <ThumbViewer key={st.seq} input={st.input} trigger={st.trigger} onClose={close} /> : null
  return { open, node }
}
