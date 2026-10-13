'use client'
/**
 * A página do vídeo próprio (spec 17, mockup video-proprio.html): miniatura, título, a meta, a faixa de seis números com UM ⓘ (a base de cada
 * número, com a conta feita), "Abrir no YouTube" e "Ampliar thumbnail". O paginador mora na linha da trilha (a página o põe em `aside` da
 * moldura, como o Histórico); esta tela continua sendo quem decide o foco depois de Anterior/Próximo e quem atende `[` e `]`, então procura os
 * botões em toda a moldura (`[data-obs]`). `children` é onde a página encaixa os blocos (`VideoBlocos`): views por dia, impressões e cliques, % assistido, retenção, "Este vídeo no canal" e o cartão da forja.
 *
 * Recebe só o que o modelo montou: nenhum dado privado (os blocos privados vêm em `children`, já em texto), e o token de edição não tem como chegar aqui. Next 16 pode
 * manter este componente quando só o `[id]` ou a query mudam: tudo que depende do vídeo é relido pelo `header.id`; o botão usado no pager vive
 * FORA do componente (`pager-usado.ts`), para o foco sobreviver a uma remontagem.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Popover } from '../_chrome/flut/flut'
import { Icon } from '../_chrome/icons'
import { useThumbViewer } from '../_chrome/thumb-viewer/thumb-viewer'
import { lembrarUltimoVideo, renovarUltimoVideo } from '../_chrome/ultimo-video'
import { marcarPagerUsado, tomarPagerUsado, videoDoHref } from '../_historico/pager-usado'
import type { PagerView } from '../_historico/view-model'
import type { CelulaVideo, ProprioVideoHeader } from './video-model'
import '../_canal/canal.css'
import './video.css'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const ExtIcon = () => <svg className="i" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M9 3h4v4M13 3L7.5 8.5M12 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.5" /></svg>

function Celula({ c }: { c: CelulaVideo }) {
  // no DOM o valor vem antes do rótulo ("118 views"); na tela os dois ficam um sobre o outro
  return (
    <div className="nc">
      {c.value != null
        ? <dd><b className="num">{c.value}</b></dd>
        : <dd className="nf"><span className="obs-ch-nm">{c.missing}</span></dd>}
      <dt>{c.label}{c.sub ? <span className="nsub">{c.sub}</span> : null}</dt>
    </div>
  )
}

export function ProprioVideoScreen({ header, pager, fromCanal, children }: {
  header: ProprioVideoHeader
  /** O mesmo paginador que a página pôs na trilha: aqui só para os atalhos [ e ] e o anúncio. */
  pager: PagerView | null
  /** O id do canal quando a pessoa veio da página dele: o último vídeo visto é guardado para o Voltar pôr o foco no cartão. */
  fromCanal: string | null
  children?: ReactNode
}) {
  const root = useRef<HTMLDivElement>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const ibtn = useRef<HTMLButtonElement>(null)
  /** A linha da faixa de números: o popover do ⓘ é medido nela (abre ABAIXO da faixa inteira), não no botão, que está na altura dos valores e deixaria o popover sobre a linha de rótulos (H13). */
  const nrow = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState(false)
  const [live, setLive] = useState('')
  const router = useRouter()

  const { open: abrirViewer, node: viewerNode } = useThumbViewer({ fallback: () => titulo.current })
  const viewer = header.viewer
  const ampliar = useCallback((el: HTMLElement | null) => { if (viewer) abrirViewer(viewer, el) }, [viewer, abrirViewer])

  // Foco: UM lugar decide, e só quando um vídeo CHEGA na tela. Depois do pager (botão ou tecla): o botão que foi usado (na ponta, o apagado), e o
  // anúncio "Vídeo 3 de 5: título". Senão, o título.
  const visto = useRef<string | null>(null)
  useEffect(() => {
    const usado = tomarPagerUsado()
    const antes = visto.current
    visto.current = header.id
    if (antes === header.id && !usado) return
    const r = root.current
    if (!r) return
    const moldura = r.closest<HTMLElement>('[data-obs]') ?? r
    const btn = usado && usado.to === header.id && pager
      ? moldura.querySelector<HTMLElement>('[data-pager-' + usado.which + ']') ?? moldura.querySelector<HTMLElement>('[data-pager-prev], [data-pager-next]') : null
    if (btn && pager) { btn.focus({ preventScroll: true }); setLive(pager.status); return }
    titulo.current?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o vídeo que chegou é lido pelo id
  }, [header.id])

  // `[` e `]` fazem o que Anterior e Próximo fazem, só com o foco no título ou dentro do paginador (nunca em campo, nunca com modificador)
  useEffect(() => {
    if (!pager) return
    const tecla = (e: KeyboardEvent) => {
      if ((e.key !== '[' && e.key !== ']') || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return
      const lado = e.key === '[' ? 'prev' : 'next', href = pager[lado]
      const r = root.current, em = document.activeElement as HTMLElement | null
      const moldura = r?.closest<HTMLElement>('[data-obs]') ?? r
      if (!href || !r || !em || !moldura || !moldura.contains(em)) return
      if (em.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return
      if (em !== titulo.current && !em.closest('[data-pager]')) return
      e.preventDefault()
      marcarPagerUsado(lado, videoDoHref(href))
      router.replace(href)
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [pager, router])

  // o último vídeo visto a partir da página do canal: ela põe o foco nesse cartão quando a pessoa volta (A2, `ultimo-video.ts`)
  useEffect(() => { if (fromCanal) lembrarUltimoVideo(fromCanal, header.id) }, [fromCanal, header.id])
  // o registro vale 30 min: sair por qualquer link desta tela renova o prazo, então uma visita longa ainda tem o foco de volta
  useEffect(() => {
    if (!fromCanal) return
    const sair = (e: MouseEvent) => { if ((e.target as Element | null)?.closest?.('a[href]') && root.current?.contains(e.target as Node)) renovarUltimoVideo(fromCanal) }
    document.addEventListener('click', sair, true)
    return () => document.removeEventListener('click', sair, true)
  }, [fromCanal])

  return (
    <div data-obs-screen="video-proprio" ref={root}>
      <p className="obs-ch-sr" role="status" aria-atomic="true">{live}</p>
      <header className="vp-h">
        {header.thumb ? <img src={header.thumb} alt="" width={320} height={180} decoding="async" /> : <div className="vp-sem-thumb">sem thumbnail</div>}
        <div className="vp-t">
          <h1 ref={titulo} tabIndex={-1}>{header.titulo}</h1>
          <p className="vp-m"><span className="own-seal">seu canal</span><span>{header.meta}</span></p>

          <div className="vp-nrow" ref={nrow}>
            <div className="nclip">
              <dl className="nstrip" aria-label="Números deste vídeo">{header.faixa.map(c => <Celula key={c.key} c={c} />)}</dl>
            </div>
            <div className="ntools">
              <button ref={ibtn} type="button" className="ibtn" aria-expanded={tip} aria-controls="video-tip" aria-label="De onde vêm os números deste vídeo" onClick={() => setTip(o => !o)}>
                {Icon.info()}
              </button>
              <Popover open={tip} anchor={() => ibtn.current} posAnchor={() => nrow.current} onClose={() => setTip(false)} id="video-tip" role="dialog" labelledBy="video-tip-t" className="canal-tip" pref="baixo" align="fim" maxW={380}>
                <h3 id="video-tip-t">De onde vêm os números deste vídeo</h3>
                <ul>{header.faixa.map(c => <li key={c.key}><b>{cap(c.label)}:</b> {c.conta}</li>)}</ul>
              </Popover>
            </div>
          </div>

          <div className="vp-a">
            <a className="obs-ch-btn" href={header.url} target="_blank" rel="noopener noreferrer">Abrir no YouTube<ExtIcon /><span className="obs-ch-sr"> (abre em nova aba)</span></a>
            {viewer ? <button type="button" className="obs-ch-btn" onClick={e => ampliar(e.currentTarget)}>Ampliar thumbnail</button> : null}
          </div>
        </div>
      </header>
      {children}
      {viewerNode}
    </div>
  )
}
