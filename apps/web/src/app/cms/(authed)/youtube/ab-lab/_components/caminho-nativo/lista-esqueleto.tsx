'use client'
// Esqueleto da lista enquanto o filho assíncrono lê (F1a-tela-1, T7). Mockup `lista-carregando`: contagem "Carregando…", nunca 0.
// A quantidade de linhas vem da última contagem guardada em `localStorage['ab-lab:linhas']` (a lista a grava depois de renderizar).
import { useEffect, useState, type ReactElement } from 'react'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import '../caminho-nativo.css'
import '../lista-caminho.css'

const PADRAO = 11
const MAXIMO = 25

function lerContagem(): { n: number; p: number } {
  try {
    const bruto = window.localStorage.getItem('ab-lab:linhas')
    if (!bruto) return { n: PADRAO, p: 0 }
    const o: unknown = JSON.parse(bruto)
    if (typeof o !== 'object' || o === null) return { n: PADRAO, p: 0 }
    const { n, p } = o as { n?: unknown; p?: unknown }
    const nn = typeof n === 'number' && Number.isFinite(n) ? Math.min(MAXIMO, Math.max(1, Math.floor(n))) : PADRAO
    const pp = typeof p === 'number' && Number.isFinite(p) ? Math.min(nn, Math.max(0, Math.floor(p))) : 0
    return { n: nn, p: pp }
  } catch {
    return { n: PADRAO, p: 0 }
  }
}

function Linha(): ReactElement {
  return (
    <div className="cn-vrow" aria-hidden="true" data-skel-linha="">
      <span className="cn-skel" style={{ width: 96, aspectRatio: '16 / 9' }} />
      <div>
        <span className="cn-skel" style={{ width: '70%', height: 16 }} />
        <span className="cn-skel" style={{ width: '40%', height: 14, marginTop: 10 }} />
        <span className="cn-skel" style={{ width: '85%', height: 14, marginTop: 10 }} />
      </div>
      <span className="cn-skel" style={{ width: 160, height: 36 }} />
    </div>
  )
}

export function ListaEsqueleto(): ReactElement {
  const [c, setC] = useState<{ n: number; p: number }>({ n: PADRAO, p: 0 })
  useEffect(() => { setC(lerContagem()) }, [])
  const outros = c.n - c.p
  return (
    <section className="cn-raiz" aria-label="Vídeos do A/B Lab" aria-busy="true">
      <p className="cn-sum">
        {FRASES.lista.carregando.frase}
        <small>{FRASES.lista.carregando.apoio}</small>
      </p>
      <div className="cn-lista cn-lsk" data-skel-lista="">
        <div className="cn-lhd"><span>{FRASES.lista.contadorCarregando}</span><span /></div>
        {c.p > 0 ? <div className="cn-grp-h" data-skel-grupo="" aria-hidden="true"><span className="cn-skel" style={{ width: 120, height: 14 }} /><span /></div> : null}
        {Array.from({ length: c.p }, (_, i) => <Linha key={`p${i}`} />)}
        {c.p > 0 ? <div className="cn-grp-h" data-skel-grupo="" aria-hidden="true"><span className="cn-skel" style={{ width: 120, height: 14 }} /><span /></div> : null}
        {Array.from({ length: outros }, (_, i) => <Linha key={`o${i}`} />)}
      </div>
    </section>
  )
}
