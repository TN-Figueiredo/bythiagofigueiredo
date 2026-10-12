'use client'
/**
 * A vista Lista da página do canal (spec 5.1, 5.6 e 5.9; mockup canal.js `thead`/`linha`): uma `table` com `th scope="col"`, o
 * botão de ordenar dentro do `th` das quatro colunas ordenáveis (Publicado, Views, Views/dia, Múltiplo) e `aria-sort` só na ativa.
 * Linha de 56 px, thumbnail de 96 px; os divisores de fim de lista viram linhas de grupo. Abaixo de 820 px o CSS vira a tabela em
 * pilha e cada célula mostra o rótulo (`data-label`). Só desenha: quem muda o estado, escreve a URL e anuncia é a tela
 * (`onSort`); o menu ⋯ é o mesmo da grade. Dado ausente é "não medido" (classe `obs-ch-nm`), nunca zero.
 */
import Link from 'next/link'
import type { CanalSort } from '@/lib/youtube/observatorio/links'
import { notaDoDivisor } from './grade'
import type { ListaView } from './lista'
import type { CanalState } from './params'
import { ehProprio } from '../_proprio/eh-proprio'
import { AGUARDANDO, type ChannelVideoView } from './videos-model'
import { VideoMenu } from './video-menu'

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

const Nm = ({ children }: { children: string }) => <span className="obs-ch-nm">{children}</span>
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

function Linha({ v, sort, href, onAmpliar, onTrocas }: {
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
        <td className={'r num' + on('imp')} data-label="Impressões">{v.impText ?? (v.semImpressao ? <Zero /> : <Nm>{v.impMissing ?? 'não medido'}</Nm>)}</td>
      ) : (
        <td className={'r num' + on('vpd')} data-label="Views/dia">{v.vpdText ?? <Nm>{sem}</Nm>}</td>
      )}
      <td className={'r num' + on('multiplo')} data-label="Múltiplo">
        {v.multText != null
          ? <span className={v.multTier ? 't-' + v.multTier : undefined}>{v.multText}{v.multWord ? <> <span className="lv">{v.multWord}</span></> : null}</span>
          : <Nm>{sem}</Nm>}
      </td>
      <td className="r num" data-label="Curtidas">{v.likesText ?? <Nm>não medido</Nm>}</td>
      <td className="r num" data-label="Comentários">{v.commentsText ?? <Nm>não medido</Nm>}</td>
      {ehProprio(v)
        ? <td className="r num" data-label="Cliques">{v.cliquesText ?? (v.semImpressao ? <Zero /> : <Nm>{v.cliquesMissing ?? 'não medido'}</Nm>)}</td>
        : <td className="r num" data-label="Trocas">{v.aguardando ? <Nm>{AGUARDANDO}</Nm> : v.swaps}</td>}
      <td className="a"><VideoMenu v={v} onAmpliar={onAmpliar} onTrocas={onTrocas} /></td>
    </tr>
  )
}

export function Tabela({ lista, state, nome, descrito, hrefDe, onSort, onAmpliar, onTrocas, proprio = false }: {
  lista: ListaView; state: CanalState; nome: string
  /** A Lista do canal próprio: colunas Impressões e Cliques. */
  proprio?: boolean
  /** O id da nota fixa da tela, que descreve a tabela. */
  descrito?: string
  hrefDe: (v: ChannelVideoView) => string
  onSort: (s: CanalSort) => void
  onAmpliar: (v: ChannelVideoView, trigger: HTMLElement | null) => void; onTrocas: (v: ChannelVideoView) => void
}) {
  return (
    <div className="cv-tw">
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
            {s.itens.map(v => <Linha key={v.id} v={v} sort={state.sort} href={hrefDe(v)} onAmpliar={onAmpliar} onTrocas={onTrocas} />)}
          </tbody>
        ))}
      </table>
    </div>
  )
}
