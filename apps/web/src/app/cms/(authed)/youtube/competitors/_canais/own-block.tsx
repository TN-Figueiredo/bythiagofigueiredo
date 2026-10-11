'use client'
/**
 * O bloco "Seus canais" no topo da lista (spec 15.2, mockup `.cn-top`): uma linha por canal próprio, com a frase de posição na
 * ordenação atual. Só desenha o que o modelo calculou. "Ir até a linha" e "Abrir meu canal" chegam como funções da tela.
 */
import type { Ref } from 'react'
import { useId } from 'react'
import { ChannelAvatar } from '../_chrome/channel-avatar'
import { Ic } from './cells'
import type { OwnBlock, OwnBlockLinha, OwnGroupPart } from './view-model'

/** As partes da linha de baixo do bloco (canais.html ownParts): um <span> cada; os textos vêm do modelo. */
export function OwnGroupParts({ parts }: { parts: OwnGroupPart[] }) {
  return <>{parts.map((p, i) => (
    <span key={i}>
      {p.warn ? <span className="flag" style={{ color: 'var(--warning-text)' }}><Ic n="warn" />{p.text}</span>
        : p.num != null ? <><span className="num">{p.num}</span> {p.text}</> : p.text}
    </span>
  ))}</>
}

function Cheia({ l, onIr, onAbrir }: { l: Extract<OwnBlockLinha, { tipo: 'cheia' }>; onIr: (id: string) => void; onAbrir: (id: string) => void }) {
  const lead = l.pos ? `${l.pos.pos}º de ${l.pos.de}` : null
  return (
    <li data-own-id={l.id}>
      <ChannelAvatar src={l.avatar} ini={l.ini} color={l.color} />
      <span className="tn"><span className="nm">{l.name}</span><span className="youtag">seu canal</span></span>
      <p className="tp">
        {lead && l.frase.startsWith(lead) ? <><b>{lead}</b>{l.frase.slice(lead.length)}</> : l.frase}
        {l.vizinhos ? <> {l.vizinhos}</> : null}
      </p>
      <span className="ta">
        <button type="button" className="btn" aria-label={`Ir até a linha de ${l.name}`} onClick={() => onIr(l.id)}>Ir até a linha</button>
        <button type="button" className="btn" aria-label={`Abrir meu canal: ${l.name}`} onClick={() => onAbrir(l.id)}>Abrir meu canal</button>
      </span>
    </li>
  )
}

export function OwnBlockView({ block, onIr, onAbrir, topoRef }: { block: OwnBlock; onIr: (id: string) => void; onAbrir: (id: string) => void; topoRef?: Ref<HTMLElement> }) {
  const h = useId()
  return (
    <section className="cn-top" data-own-block="" aria-labelledby={h} ref={topoRef}>
      <h2 id={h}>{block.titulo}</h2>
      {block.linhas.length ? (
        <ul>
          {block.linhas.map(l => l.tipo === 'fina'
            ? <li key={l.id} className="fina" data-own-id={l.id}><p>{l.texto} <button type="button" className="lk" aria-label={`Ir até a linha de ${l.texto.slice(0, l.texto.lastIndexOf(': sem vídeos'))}`} onClick={() => onIr(l.id)}>Ir até a linha</button></p></li>
            : <Cheia key={l.id} l={l} onIr={onIr} onAbrir={onAbrir} />)}
        </ul>
      ) : null}
      <p className="cn-own"><OwnGroupParts parts={block.partes} /></p>
    </section>
  )
}
