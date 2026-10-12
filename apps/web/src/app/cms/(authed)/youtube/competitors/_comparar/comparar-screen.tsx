'use client'
/**
 * A tela de comparação entre dois canais (spec 18, fase A3). Chega do servidor só dado simples (o pacote com os números de TODOS os canais e o
 * par inicial); o par (lados, relação, Leitura rápida, régua, rodapé) é calculado aqui, por funções puras, para trocar o seletor ou
 * "Inverter lados" sem rede. O par vive na URL (`usePar`). Nenhuma server action: a tela só lê.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { link } from '@/lib/youtube/observatorio/links'
import type { CompararPack } from './pack'
import { buildPar } from './par-model'
import { Lados } from './lados'
import { NumeroANumero } from './numero-a-numero'
import { SoSeuCanal } from './so-seu-canal'
import { MaisVistos } from './mais-vistos'
import { Publicacao } from './publicacao'
import { ForjaIndisponivel } from './forja-indisponivel'
import { usePar } from './use-par'
import './comparar.css'

export function CompararScreen({ pack, inicial }: { pack: CompararPack; inicial: { a: string; b: string } | null }) {
  return inicial ? <ComPar pack={pack} inicial={inicial} /> : <SemPar />
}

/** Menos de dois canais no site (D4 d): sem seletores, e o próximo passo: o mesmo destino do botão "Adicionar canal" das abas. */
function SemPar() {
  return (
    <div data-obs-screen="comparar">
      <header className="cp-head"><h1>Comparar canais</h1></header>
      <section className="cp-sec">
        <p className="cp-lead">Para comparar, o site precisa acompanhar pelo menos dois canais.</p>
        <p className="cp-open"><Link className="lk" href={link.canais({ add: 1 })}>Adicionar canal</Link></p>
      </section>
    </div>
  )
}

function ComPar({ pack, inicial }: { pack: CompararPack; inicial: { a: string; b: string } }) {
  const { a, b, trocar, inverter } = usePar(pack, inicial)
  const par = useMemo(() => buildPar(pack, a, b), [pack, a, b])
  const h1 = useRef<HTMLHeadingElement>(null)
  // o anúncio só depois de uma troca: na abertura a tela fala por si
  const [anuncio, setAnuncio] = useState('')
  const primeiro = useRef(true)
  useEffect(() => { h1.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => {
    document.title = `${par.titulo} · Competidores`
    if (primeiro.current) { primeiro.current = false; return }
    setAnuncio(par.status)
  }, [par])
  return (
    <div data-obs-screen="comparar">
      <header className="cp-head">
        <h1 ref={h1} tabIndex={-1}>Comparar canais</h1>
        <p className="cp-sub">{par.subtitulo}</p>
        <button type="button" className="cp-swap" onClick={inverter}>
          <svg className="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.5h9.5L10 3M13 10.5H3.5L6 13" /></svg>Inverter lados
        </button>
      </header>
      <p className="obs-ch-sr" role="status" aria-atomic="true">{anuncio}</p>
      <Lados pack={pack} a={par.a} b={par.b} cores={par.cores} onTrocar={trocar} />
      <SoSeuCanal pack={pack} par={par} />
      <NumeroANumero pack={pack} par={par} />
      <MaisVistos par={par} />
      <Publicacao par={par} pack={pack} />
      <ForjaIndisponivel par={par} />
    </div>
  )
}
