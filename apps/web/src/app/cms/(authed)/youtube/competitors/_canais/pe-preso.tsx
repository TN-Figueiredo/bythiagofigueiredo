'use client'
/**
 * A linha presa no pé (spec 15.2): "seu canal · 14º de 14 em inscritos, com 1,16 mil.", só quando nem o bloco do topo nem a linha do
 * canal estão na tela. O observador usa como `root` o contêiner que rola (a casca do CMS rola em `main`); sem IntersectionObserver
 * (jsdom, navegador antigo) a linha fica escondida, nunca presa por engano.
 *
 * Enquanto está à vista ela cobre o pé da área que rola. O componente escreve na tela (`--cn-pin-cobre`) quantos px do pé ela cobre, medidos
 * da altura REAL dela (uma linha a 1440 px, duas num celular) mais uma folga, e zero quando está escondida: o `scroll-margin-bottom` dos controles
 * da lista lê essa variável, para o Tab nunca deixar o foco sob a linha presa e nunca rolar à toa quando ela não existe.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import { contentorQueRola } from './rolagem'

const COBRE = '--cn-pin-cobre', FOLGA_PX = 14

export function PePreso({ pe, topoRef, linha, versao, onIr, onTopo }: {
  pe: { canalId: string; texto: string }
  /** O bloco do topo. */
  topoRef: RefObject<HTMLElement | null>
  /** A linha (ou o cartão) do canal na tela; null quando a busca a esconde. Achada por ref, nunca por id global. */
  linha: () => HTMLElement | null
  /** Muda quando a linha pode ser outro elemento (tabela/cartões, busca): o observador observa de novo. */
  versao: string
  onIr: () => void
  onTopo: () => void
}) {
  const raiz = useRef<HTMLDivElement>(null)
  const [oculta, setOculta] = useState(true)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') { setOculta(true); return }
    const alvoTopo = topoRef.current, alvoLinha = linha()
    const vis = { topo: false, linha: false }
    const io = new IntersectionObserver(es => {
      for (const e of es) { if (e.target === alvoTopo) vis.topo = e.isIntersecting; else if (e.target === alvoLinha) vis.linha = e.isIntersecting }
      setOculta(vis.topo || vis.linha)
    }, { root: contentorQueRola(raiz.current), threshold: 0.15 })
    if (alvoTopo) io.observe(alvoTopo)
    if (alvoLinha) io.observe(alvoLinha)
    return () => io.disconnect()
  }, [pe.canalId, versao]) // eslint-disable-line react-hooks/exhaustive-deps -- topoRef e linha() são lidos na hora; `versao` diz quando mudam
  // a distância do topo da linha presa ao pé da área que rola; 14 px de folga para o anel de foco
  useEffect(() => {
    const el = raiz.current, tela = el?.closest<HTMLElement>('[data-obs-screen]')
    if (!el || !tela) return
    const escrever = () => {
      if (oculta) { tela.style.setProperty(COBRE, '0px'); return }
      const area = contentorQueRola(el), fimDaArea = area ? area.getBoundingClientRect().bottom : window.innerHeight
      tela.style.setProperty(COBRE, `${Math.max(0, Math.round(fimDaArea - el.getBoundingClientRect().top)) + FOLGA_PX}px`)
    }
    escrever()
    if (oculta) return
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(escrever)
    ro?.observe(el)
    window.addEventListener('resize', escrever)
    return () => { ro?.disconnect(); window.removeEventListener('resize', escrever) }
  }, [oculta])
  useEffect(() => () => { raiz.current?.closest<HTMLElement>('[data-obs-screen]')?.style.removeProperty(COBRE) }, [])
  return (
    <div className="cn-pin" ref={raiz} hidden={oculta} role="group" aria-label="Seu canal">
      <p>{pe.texto}</p>
      <button type="button" className="lk" onClick={onIr}>Ir até a linha</button>
      <button type="button" className="lk" onClick={onTopo}>Voltar ao topo</button>
    </div>
  )
}
