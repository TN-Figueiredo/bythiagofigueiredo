'use client'
/**
 * A vista Lista da página do canal (spec 5.1, 5.6 e 5.9; mockup canal.js `thead`/`linha`): uma `table` com `th scope="col"`, o
 * botão de ordenar dentro do `th` das quatro colunas ordenáveis (Publicado, Views, Views/dia, Múltiplo) e `aria-sort` só na ativa.
 * Linha de 56 px, thumbnail de 96 px; os divisores de fim de lista viram linhas de grupo. Abaixo de 820 px o CSS vira a tabela em
 * pilha e cada célula mostra o rótulo (`data-label`). Só desenha: quem muda o estado, escreve a URL e anuncia é a tela
 * (`onSort`); o menu ⋯ é o mesmo da grade. Dado ausente é "não medido" (classe `obs-ch-nm`), nunca zero.
 */
import Link from 'next/link'
import { Suspense, use } from 'react'
import type { CanalSort } from '@/lib/youtube/observatorio/links'
import { notaDoDivisor } from './grade'
import type { ListaView } from './lista'
import type { CanalState } from './params'
import { ehProprio } from '../_proprio/eh-proprio'
import { AGUARDANDO, type ChannelVideoView } from './videos-model'
import { VideoMenu } from './video-menu'
import { PastilhaAusencia } from '../_chrome/ausencia/pastilhas'
import type { EstadoAusencia } from '../_chrome/ausencia/estado'
import { reacaoComEstado } from '@/lib/youtube/observatorio/medidas/engajamento'

/** Coluna ordenável -> ordenação (a mesma do select "Ordenar"). */
const COLUNAS: Array<[CanalSort, string]> = [['recentes', 'Publicado'], ['vistos', 'Views'], ['vpd', 'Views/dia'], ['multiplo', 'Múltiplo']]
/** Canal próprio (spec 16.4): Impressões no lugar de Views/dia; no fim, Cliques no lugar de Trocas. */
const COLUNAS_PROPRIO: Array<[CanalSort, string]> = [['recentes', 'Publicado'], ['vistos', 'Views'], ['imp', 'Impressões'], ['multiplo', 'Múltiplo']]
const NCOLS = 9   // Vídeo, as quatro ordenáveis, Curtidas, Comentários, Trocas (ou Cliques), Ações

function Seta({ dir }: { dir: 'asc' | 'desc' }) {
  return (
    <svg className="arr" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={dir === 'asc' ? 'M8 12.5v-9M4.5 7L8 3.5 11.5 7' : 'M8 3.5v9M4.5 9L8 12.5 11.5 9'} />
    </svg>
  )
}

function Cabecalho({ state, onSort, proprio }: { state: CanalState; onSort: (s: CanalSort) => void; proprio: boolean }) {
  return (
    <thead>
      <tr>
        <th scope="col">Vídeo</th>
        {(proprio ? COLUNAS_PROPRIO : COLUNAS).map(([sort, nome]) => {
          const on = state.sort === sort
          return (
            <th key={sort} scope="col" className="r" aria-sort={on ? (state.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
              <button type="button" onClick={() => onSort(sort)}>{nome}{on ? <Seta dir={state.dir} /> : null}</button>
            </th>
          )
        })}
        <th scope="col" className="r">Curtidas</th>
        <th scope="col" className="r">Comentários</th>
        <th scope="col" className="r">{proprio ? 'Cliques' : 'Trocas'}</th>
        <th scope="col"><span className="obs-ch-sr">Ações</span></th>
      </tr>
    </thead>
  )
}

const Nm = ({ children }: { children: React.ReactNode }) => <span className="obs-ch-nm">{children}</span>
/** Decisão 75: célula sem número do vídeo próprio. `falhou` e `restrito` ganham a pastilha da forma certa (sem role: o aviso é UM, acima da tabela); `nao_medido` segue a hachura com a palavra do motivo. */
function Ausente({ estado, palavra }: { estado: EstadoAusencia | null; palavra: string }) {
  return estado === 'falhou' || estado === 'restrito' ? <PastilhaAusencia estado={estado} /> : <Nm>{palavra}</Nm>
}
/** Zero medido: o alcance foi lido e o vídeo não apareceu em nenhum dia medido. A caixa vazada do gráfico, nunca a hachura de "não medido". */
const Zero = () => <span className="obs-ch-zero">0<span className="obs-ch-sr"> (zero medido)</span></span>

/** O que a célula diz quando não há views por dia nem múltiplo: o motivo, em poucas palavras (mockup `linha`). */
function semMedida(v: ChannelVideoView): string {
  return v.aguardando ? AGUARDANDO : v.views == null ? 'sem contagem' : v.grupo === 'fixado-antigo' ? 'fixado antigo' : 'não medido'
}

/** As marcas sob o título (o selo de duração fica na thumbnail). */
function marcas(v: ChannelVideoView): string[] {
  const m: string[] = []
  if (v.pinned) m.push(v.grupo === 'fixado-antigo' ? 'fixado antigo' : 'fixado')
  if (v.isShort == null) m.push('formato não confirmado')
  else if (!v.isShort && v.dur == null) m.push('sem duração')
  return m
}

/** Sinalizadores por id do vídeo, só as exceções (curtidas ocultas ou valor 0 com sinalizador lido); id ausente = metade sem sinalizador. `null` = não deu para ler. */
export type Reacoes = Record<string, { likesHidden: boolean | null; commentsDisabled: boolean | null }>
/** A promessa das reações: `undefined` = canal próprio (a célula de hoje); `null` = sem sinalizador nenhum. */
export type ReacoesPromessa = Promise<Reacoes | null> | null

/** Fallback enquanto `medidas` não resolve: nunca "0" e nunca "não medido" para um 0 cru (pode ser zero falso ou verdadeiro). */
export function fallbackDaReacao(cru: number | null, texto: string | null) {
  if (cru == null) return <Nm>não medido</Nm>
  if (cru === 0) return <Nm><span aria-hidden="true">…</span><span className="obs-ch-sr">lendo</span></Nm>
  return <>{texto ?? <Nm>não medido</Nm>}</>
}
/** A célula decidida: a mesma regra de `reacao` (`reacaoComEstado`); mostra o texto já formatado do vídeo. */
function decidida(cru: number | null, sinal: boolean | null, texto: string | null) {
  return reacaoComEstado(cru, sinal).x === null ? <Nm>não medido</Nm> : <>{texto ?? <Nm>não medido</Nm>}</>
}
const DuasCelulas = ({ curtidas, comentarios }: { curtidas: React.ReactNode; comentarios: React.ReactNode }) => (
  <>
    <td className="r num" data-label="Curtidas">{curtidas}</td>
    <td className="r num" data-label="Comentários">{comentarios}</td>
  </>
)
function LeituraDeReacao({ v, reacoes }: { v: ChannelVideoView; reacoes: Promise<Reacoes | null> }) {
  const r = use(reacoes)?.[v.id]
  return <DuasCelulas curtidas={decidida(v.likes, r?.likesHidden ?? null, v.likesText)} comentarios={decidida(v.comments, r?.commentsDisabled ?? null, v.commentsText)} />
}
function CelulasDeReacao({ v, reacoes }: { v: ChannelVideoView; reacoes: ReacoesPromessa | undefined }) {
  if (reacoes === undefined) return <DuasCelulas curtidas={v.likesText ?? <Nm>não medido</Nm>} comentarios={v.commentsText ?? <Nm>não medido</Nm>} />
  if (reacoes === null) return <DuasCelulas curtidas={decidida(v.likes, null, v.likesText)} comentarios={decidida(v.comments, null, v.commentsText)} />
  return (
    <Suspense fallback={<DuasCelulas curtidas={fallbackDaReacao(v.likes, v.likesText)} comentarios={fallbackDaReacao(v.comments, v.commentsText)} />}>
      <LeituraDeReacao v={v} reacoes={reacoes} />
    </Suspense>
  )
}

function Linha({ v, sort, href, onAmpliar, onTrocas, reacoes }: {
  reacoes?: ReacoesPromessa
  v: ChannelVideoView; sort: CanalSort; href: string; onAmpliar: (v: ChannelVideoView, trigger: HTMLElement | null) => void; onTrocas: (v: ChannelVideoView) => void
}) {
  const on = (s: CanalSort) => (sort === s ? ' on' : '')
  const selo = v.isShort ? 'Short' : v.durText
  const tags = marcas(v)
  const sem = semMedida(v)
  return (
    <tr className="cv-row" data-id={v.id}>
      <td className="v">
        <Link prefetch={false} className="cv-tl" id={'cv-lnk-' + v.id} href={href}>
          <span className="cv-tthumb">
            {v.thumbSrc ? <img src={v.thumbSrc} alt="" width={320} height={180} loading="lazy" decoding="async" /> : null}
            {selo ? <span className={'cv-seal br' + (v.isShort ? '' : ' num')}>{selo}</span> : null}
          </span>
          <span className="cv-tx">
            <span className="cv-ttl obs-ch-ttl">{v.title}</span>
            {tags.length ? <span className="cv-tags">{tags.join(', ')}</span> : null}
          </span>
        </Link>
      </td>
      <td className={'r' + on('recentes')} data-label="Publicado">
        {v.pub == null ? <Nm>sem data</Nm> : <time dateTime={v.pubISO ?? undefined}>{v.ageText}<span className="obs-ch-sr"> ({v.pubTitle})</span></time>}
      </td>
      <td className={'r num' + on('vistos')} data-label="Views">{v.viewsText ?? <Nm>{v.viewsMissing ?? 'sem contagem'}</Nm>}</td>
      {ehProprio(v) ? (
        <td className={'r num' + on('imp')} data-label="Impressões">{v.impText ?? (v.semImpressao ? <Zero /> : <Ausente estado={v.impEstado} palavra={v.impMissing ?? 'não medido'} />)}</td>
      ) : (
        <td className={'r num' + on('vpd')} data-label="Views/dia">{v.vpdText ?? <Nm>{sem}</Nm>}</td>
      )}
      <td className={'r num' + on('multiplo')} data-label="Múltiplo">
        {v.multText != null
          ? <span className={v.multTier ? 't-' + v.multTier : undefined}>{v.multText}{v.multWord ? <> <span className="lv">{v.multWord}</span></> : null}</span>
          : <Nm>{sem}</Nm>}
      </td>
      <CelulasDeReacao v={v} reacoes={reacoes} />
      {ehProprio(v)
        ? <td className="r num" data-label="Cliques">{v.cliquesText ?? (v.semImpressao ? <Zero /> : <Ausente estado={v.cliquesEstado} palavra={v.cliquesMissing ?? 'não medido'} />)}</td>
        : <td className="r num" data-label="Trocas">{v.aguardando ? <Nm>{AGUARDANDO}</Nm> : v.swaps}</td>}
      <td className="a"><VideoMenu v={v} onAmpliar={onAmpliar} onTrocas={onTrocas} /></td>
    </tr>
  )
}

export function Tabela({ lista, state, nome, descrito, hrefDe, onSort, onAmpliar, onTrocas, proprio = false, avisoAlcance = null, reacoes }: {
  /** As reações vindas de `medidas` (canal concorrente); ausente = canal próprio. */
  reacoes?: ReacoesPromessa
  lista: ListaView; state: CanalState; nome: string
  /** A Lista do canal próprio: colunas Impressões e Cliques. */
  proprio?: boolean
  /** Decisão 75: o motivo do alcance não lido quando ele é `falhou` ou `restrito`. UM `role=status` acima da tabela (leitor de tela não ouve 40 vezes); as células não levam role. */
  avisoAlcance?: { texto: string; estado: EstadoAusencia } | null
  /** O id da nota fixa da tela, que descreve a tabela. */
  descrito?: string
  hrefDe: (v: ChannelVideoView) => string
  onSort: (s: CanalSort) => void
  onAmpliar: (v: ChannelVideoView, trigger: HTMLElement | null) => void; onTrocas: (v: ChannelVideoView) => void
}) {
  return (
    <div className="cv-tw">
      {avisoAlcance ? <p role="status" className="obs-au-frase"><PastilhaAusencia estado={avisoAlcance.estado} /> {avisoAlcance.texto}</p> : null}
      <table className="cv-lst" aria-describedby={descrito}>
        <caption className="obs-ch-sr">Vídeos de {nome}</caption>
        <Cabecalho state={state} onSort={onSort} proprio={proprio} />
        {lista.secoes.map((s, i) => (
          <tbody key={s.divisor?.key ?? 'main' + i}>
            {s.divisor ? (
              <tr className="cv-grp">
                <th scope="rowgroup" colSpan={NCOLS}>{s.divisor.label} ({s.divisor.count})<small>{notaDoDivisor(s.divisor, state.sort)}</small></th>
              </tr>
            ) : null}
            {s.itens.map(v => <Linha key={v.id} v={v} sort={state.sort} href={hrefDe(v)} onAmpliar={onAmpliar} onTrocas={onTrocas} reacoes={reacoes} />)}
          </tbody>
        ))}
      </table>
    </div>
  )
}
