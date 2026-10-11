'use client'
/**
 * A linha presa no pé (spec 15.2): "seu canal · 14º de 14 em inscritos, com 1,16 mil.", só quando nem o bloco do topo nem a linha do
 * canal estão na tela. O observador usa como `root` o contêiner que rola (a casca do CMS rola em `main`); sem IntersectionObserver
 * (jsdom, navegador antigo) a linha fica escondida, nunca presa por engano.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import { contentorQueRola } from './rolagem'

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
  return (
    <div className="cn-pin" ref={raiz} hidden={oculta} role="group" aria-label="Seu canal">
      <p>{pe.texto}</p>
      <button type="button" className="lk" onClick={onIr}>Ir até a linha</button>
      <button type="button" className="lk" onClick={onTopo}>Voltar ao topo</button>
    </div>
  )
}
