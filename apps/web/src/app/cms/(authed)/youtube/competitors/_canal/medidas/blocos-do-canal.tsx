/**
 * E5a Tarefa 19: os três elementos de servidor da página do canal do concorrente. Cada um recebe a MESMA promessa de medidas (a página
 * chama o carregador uma vez) e faz `await` dela; nenhum chama o carregador. Entram em `CanalScreen` como elemento pronto, nunca como
 * componente (Next 16). `TopoDoCanal` = a frase do topo e a faixa de estado; `CelulasDoCanal` = as cinco células que dependem de medida;
 * `BlocosDoCanal` = os atalhos e os cinco blocos.
 */
import type { ReactNode } from 'react'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import { RiInfo } from '../../_canais/ri-info'
import { canalDerivadoDe, type ContextoDoCanal } from './canal-derivado-async'
import { CelulasDoCabecalho } from './celulas'
import { celulasDoCabecalho } from './cabecalho-model'
import { DirecaoBloco } from './direcao-bloco'
import { blocoDeDirecao } from './direcao-model'
import { FaixaDeEstado } from './faixa-de-estado'
import { FRASE_CRIADOR_NAO_PEDIDA } from './criador-model'
import { HorasDoCanal } from './horas-do-canal'
import { Lancamentos } from './lancamentos'
import { horasDoCanal } from './lancamentos-model'
import { LinhaDoTempoBloco } from './linha-do-tempo'
import { linhaDoTempo } from './linha-do-tempo-model'
import { RitmoBloco } from './ritmo-bloco'
import { blocoDeRitmo } from './ritmo-model'
import { fraseDoTopo, type Glifo } from './frase-do-topo'
import { entradaDaFrase } from './canal-derivado'
import './canal-medidas.css'

export type { ContextoDoCanal }
export interface PropsDosBlocos { medidas: Promise<CanalInteiro>; contexto: ContextoDoCanal }

const GLIFO: Record<Glifo, string> = { up: '▲', dn: '▼', eq: '＝', x: '✕', aviso: '⚠', sync: '↻', pausa: '⏸', interr: '?' }

export async function TopoDoCanal({ medidas, contexto }: PropsDosBlocos): Promise<ReactNode> {
  const { d } = await canalDerivadoDe(medidas, contexto)
  const f = fraseDoTopo(entradaDaFrase(contexto, d))
  return (
    <>
      <FaixaDeEstado estado={d.estado} />
      <p className={`pc-fr ${f.tom}`} data-frase-do-topo>
        <span className={`pc-sim ${f.tom}`} aria-hidden="true">{GLIFO[f.glifo]}</span>
        <span>{f.partes.map((p, i) => (p.k === 'forte' ? <b key={i}>{p.t}</b> : p.k === 'num' ? <span key={i} className="num">{p.t}</span> : <span key={i}>{p.t}</span>))}</span>
      </p>
    </>
  )
}

export async function CelulasDoCanal({ medidas, contexto }: PropsDosBlocos): Promise<ReactNode> {
  const { c, d } = await canalDerivadoDe(medidas, contexto)
  void c
  const cels = celulasDoCabecalho({
    F: contexto.F, subs: contexto.subs, medidas: d.medidas, formato: d.formato, estado: d.estado, extras: { missingSince: null },
    semVideos: contexto.semVideos, hojeSP: contexto.hojeSP,
  }).filter(x => x.chave !== 'inscritos')
  return (
    <dl className="pc-cels" aria-label="Números do canal" data-celulas-do-canal>
      <CelulasDoCabecalho celulas={cels} />
    </dl>
  )
}

const ATALHOS: Array<[string, string]> = [['direcao', 'Direção'], ['lancamentos', 'Lançamentos'], ['tempo', 'Linha do tempo'], ['ritmo', 'Ritmo'], ['criador', 'O que o criador respondeu']]

/** O bloco "O que o criador respondeu" no estado sem dado; a C4 o completa. */
function CriadorVazio({ extra }: { extra?: ReactNode }) {
  const itens = [
    'Base: vídeos longos publicados nos últimos 90 dias que já têm dias de comentários guardados.',
    'Conta: em quantos desses vídeos vimos pelo menos uma resposta do criador. Percentual só com 10 vídeos ou mais; menos de 5, não medido.',
    'Piso: só vemos as respostas entre os comentários guardados; “não vimos resposta” não quer dizer que ele não respondeu.',
  ]
  return (
    <section className="pc-sec" id="criador" aria-labelledby="hCri">
      <div className="pc-sh">
        <h2 id="hCri">O que o criador respondeu</h2>
        <RiInfo titulo="as respostas do criador" itens={itens} rotuloBotao="Como ler as respostas do criador" />
      </div>
      {extra ?? (
        <>
          <p className="pc-fr2" data-frase-do-bloco><span><b>Ainda não dá para dizer se o criador responde.</b></span></p>
          <p className="pc-lc"><span className="obs-ch-nm">{FRASE_CRIADOR_NAO_PEDIDA}</span></p>
        </>
      )}
    </section>
  )
}

export async function BlocosDoCanal({ medidas, contexto }: PropsDosBlocos): Promise<ReactNode> {
  const { c, d } = await canalDerivadoDe(medidas, contexto)
  const retratos = c.retratos.lido ? c.retratos.dados : null
  const horas = c.horas !== 'nao_pedida' && c.horas.lido ? c.horas.dados : null
  const direcao = blocoDeDirecao({ F: contexto.F, medidas: d.medidas, soShorts: d.formato.soShorts, estado: d.estado, hojeSP: contexto.hojeSP })
  const ritmo = blocoDeRitmo({ medidas: d.medidas, videos: d.videos, formato: d.formato, estado: d.estado, ultimaLeituraMs: contexto.sync.last, agoraMs: contexto.agoraMs, hojeSP: contexto.hojeSP })
  const tempo = linhaDoTempo({
    F: contexto.F, medidas: d.medidas, retratos, videos: d.videos,
    mudancas: c.mudancas !== 'nao_pedida' && c.mudancas.lido ? c.mudancas.dados : null,
    trocas: contexto.trocas, titulos: d.titulos, estado: d.estado, formato: d.formato,
    foraEm: d.estado.tipo === 'saiu' ? d.estado.ate : null, hojeSP: contexto.hojeSP,
  })
  return (
    <div className="pc-blocos" data-blocos-do-canal>
      <nav className="pc-nav" aria-label="Nesta página">{ATALHOS.map(([id, t]) => <a key={id} href={`#${id}`}>{t}</a>)}</nav>
      <DirecaoBloco bloco={direcao} />
      <Lancamentos modelo={d.lanc.modelo} horas={<HorasDoCanal modelo={horasDoCanal({ videos: d.videos, horas, formato: d.formato, agoraMs: contexto.agoraMs })} />} />
      <LinhaDoTempoBloco modelo={tempo} />
      <RitmoBloco bloco={ritmo} />
      <CriadorVazio />
    </div>
  )
}

