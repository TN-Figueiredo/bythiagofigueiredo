'use client'
/**
 * "Os 5 vídeos mais vistos de cada canal" (spec 18.7): duas colunas (empilham abaixo de 820 px), uma por lado, cada uma com o chip do lado, a
 * nota de quantos vídeos há e a lista. Cada item é um link para o Histórico do vídeo (D19: também para vídeo do canal próprio, que abre como
 * abre hoje até a A4) com a origem `comparar` e o `back=` desta comparação, para a trilha do Histórico voltar com o MESMO par. A capa é
 * decorativa (`alt=""`: o título está no link); sem imagem, ou com a imagem quebrada, o texto "sem capa" ocupa o lugar dela. Nunca <img> quebrada.
 * Título e nome do canal são texto (React escapa): HTML aparece como letras, emoji passa. Nenhuma server action, nenhum router.
 */
import { useState } from 'react'
import Link from 'next/link'
import { link } from '@/lib/youtube/observatorio/links'
import { corVar } from './lados'
import type { CanalPack, Top5Item } from './pack'
import type { CorLado, ParView } from './par-model'

/** O `back=` da comparação: a query da própria URL da tela, que começa com "?". */
export function voltarParaComparacao(a: string, b: string): string {
  const url = link.comparar(a, b)
  return url.slice(url.indexOf('?'))
}

function Capa({ thumb }: { thumb: string | null }) {
  const [falhou, setFalhou] = useState(false)
  if (!thumb || falhou) return <span className="cp-capa sem" aria-hidden="true">sem capa</span>
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="cp-capa" src={thumb} alt="" width={64} height={36} loading="lazy" onError={() => setFalhou(true)} />
}

function Item({ v, back }: { v: Top5Item; back: string }) {
  const corpo = (
    <>
      <Capa thumb={v.thumb} />
      <span className="cp-vt">
        <b>{v.titulo}</b>
        <small><span className="num">{v.viewsTexto}</span>, {v.idadeTexto}{v.short ? <span className="cp-short"> · Short</span> : null}</small>
        {v.abre ? null : <small className="cp-sem-link">sem data de publicação: o histórico não abre</small>}
      </span>
    </>
  )
  // um vídeo que o Histórico não sabe abrir ("Vídeo não encontrado") não vira link: a frase que promete uma ação só vale com destino válido
  return <li>{v.abre ? <Link href={link.historico(v.id, { from: 'comparar', back })}>{corpo}</Link> : <div className="cp-sem-abrir">{corpo}</div>}</li>
}

function Coluna({ lado, canal, cor, back }: { lado: 'A' | 'B'; canal: CanalPack; cor: CorLado; back: string }) {
  return (
    <div className="cp-vc" style={{ '--c': corVar(cor) } as React.CSSProperties}>
      <h3><span className="lm">Lado {lado}</span>{canal.name}</h3>
      <p className="cp-cnt">{canal.top5Nota}</p>
      {canal.top5.length ? (
        <ol className="cp-t5">{canal.top5.map(v => <Item key={v.id} v={v} back={back} />)}</ol>
      ) : null}
    </div>
  )
}

export function MaisVistos({ par }: { par: ParView }) {
  const back = voltarParaComparacao(par.a.id, par.b.id)
  return (
    <section className="cp-sec" aria-labelledby="cp-mv-t">
      <h2 id="cp-mv-t">Os 5 vídeos mais vistos de cada canal</h2>
      <div className="cp-vids">
        <Coluna lado="A" canal={par.a} cor={par.cores[0]} back={back} />
        <Coluna lado="B" canal={par.b} cor={par.cores[1]} back={back} />
      </div>
    </section>
  )
}
