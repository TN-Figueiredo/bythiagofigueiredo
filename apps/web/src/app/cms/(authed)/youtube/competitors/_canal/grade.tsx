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
  // um `switch` exaustivo: uma ordenação nova não compila sem a frase do seu divisor (a de impressões já ficou com a frase dos concorrentes, falsa)
  switch (sort) {
    case 'vistos': return 'o YouTube ainda não devolveu a contagem'
    case 'multiplo': return 'formato não confirmado, fixado antigo ou sem contagem'
    // canal próprio: o vídeo que não aparece no relatório de alcance E o alcance que não pôde ser lido caem aqui (o motivo de cada caso está na nota sob a grade)
    case 'imp': return 'o vídeo não teve impressão nos dias medidos, ou o alcance do canal não pôde ser medido'
    case 'recentes':
    case 'vpd': return 'fora dos acompanhados, fixado antigo ou sem contagem'
    default: { const nunca: never = sort; return nunca }
  }
}

/**
 * `limite` é o teto de cartões da página atual do "Mostrar mais" do celular (lotes × 24, `grade-paginacao.ts`). Os cartões além dele continuam no
 * documento, marcados com `data-pag-oculto`: o CSS só os esconde a 480 px ou menos, então em tela larga a grade segue inteira. O divisor cujo primeiro
 * cartão está escondido também se esconde. Quem mostra o botão e conta os lotes é quem chama.
 */
export function Grade({ lista, sort, nome, hrefDe, onAmpliar, onTrocas, limite = Infinity }: {
  lista: ListaView; sort: CanalSort; nome: string
  hrefDe: (v: ChannelVideoView) => string
  onAmpliar: (v: ChannelVideoView, trigger: HTMLElement | null) => void; onTrocas: (v: ChannelVideoView) => void
  limite?: number
}) {
  let pos = 0
  return (
    <ul className="cv-grid" data-ord={sort} aria-label={'Vídeos de ' + nome}>
      {lista.secoes.map((s, i) => {
        const inicio = pos
        pos += s.itens.length
        return (
          <SecaoGrade key={s.divisor?.key ?? 'main' + i} divisor={s.divisor} sort={sort} oculto={inicio >= limite}>
            {s.itens.map((v, j) => <VideoCard key={v.id} v={v} sort={sort} href={hrefDe(v)} onAmpliar={onAmpliar} onTrocas={onTrocas} oculto={inicio + j >= limite} />)}
          </SecaoGrade>
        )
      })}
    </ul>
  )
}

function SecaoGrade({ divisor, sort, oculto, children }: { divisor: Divisor | null; sort: CanalSort; oculto: boolean; children: ReactNode }) {
  return (
    <>
      {divisor ? (
        <li className="cv-div" data-pag-oculto={oculto ? '' : undefined}><h3>{divisor.label} ({divisor.count})</h3><small>{notaDoDivisor(divisor, sort)}</small></li>
      ) : null}
      {children}
    </>
  )
}
