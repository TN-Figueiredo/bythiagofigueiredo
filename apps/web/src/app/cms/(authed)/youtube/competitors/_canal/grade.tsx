'use client'
/**
 * A grade da vista Capas (spec 5.4 a 5.6): `ul`/`li` com os cartões e, entre eles, os divisores de fim de lista (h3 com a contagem).
 * Quem filtra e ordena é `montarLista`; aqui só se desenha. O `hrefDe` e as ações chegam por props.
 */
import type { ReactNode } from 'react'
import type { CanalSort } from '@/lib/youtube/observatorio/links'
import type { Divisor, ListaView } from './lista'
import type { ChannelVideoView } from './videos-model'
import { VideoCard } from './video-card'

/** A frase miúda de cada divisor (a Lista usa as mesmas). Os antigos: spec 5.6, letra por letra. */
export function notaDoDivisor(d: Divisor, sort: CanalSort): string {
  if (d.key === 'antigos') return 'a contagem de views deles é antiga; não há views por dia, e o múltiplo é o de quando foram contados'
  if (d.key === 'sem-data') return 'o YouTube não devolveu a data; ficam no fim em qualquer ordenação'
  if (sort === 'vistos') return 'o YouTube ainda não devolveu a contagem'
  if (sort === 'multiplo') return 'formato não confirmado, fixado antigo ou sem contagem'
  return 'fora dos acompanhados, fixado antigo ou sem contagem'
}

export function Grade({ lista, sort, nome, hrefDe, onAmpliar, onTrocas }: {
  lista: ListaView; sort: CanalSort; nome: string
  hrefDe: (v: ChannelVideoView) => string
  onAmpliar: (v: ChannelVideoView) => void; onTrocas: (v: ChannelVideoView) => void
}) {
  return (
    <ul className="cv-grid" data-ord={sort} aria-label={'Vídeos de ' + nome}>
      {lista.secoes.map((s, i) => (
        <SecaoGrade key={s.divisor?.key ?? 'main' + i} divisor={s.divisor} sort={sort}>
          {s.itens.map(v => <VideoCard key={v.id} v={v} sort={sort} href={hrefDe(v)} onAmpliar={onAmpliar} onTrocas={onTrocas} />)}
        </SecaoGrade>
      ))}
    </ul>
  )
}

function SecaoGrade({ divisor, sort, children }: { divisor: Divisor | null; sort: CanalSort; children: ReactNode }) {
  return (
    <>
      {divisor ? (
        <li className="cv-div"><h3>{divisor.label} ({divisor.count})</h3><small>{notaDoDivisor(divisor, sort)}</small></li>
      ) : null}
      {children}
    </>
  )
}
