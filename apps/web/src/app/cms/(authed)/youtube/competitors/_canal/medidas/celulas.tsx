/**
 * E5a Tarefa 15: as cinco células novas do cabeçalho (Direção, Estado, Acerto, Ritmo, Criador responde) e a de Inscritos, na ordem da
 * tabela do NOTAS 15. Sem estado: componente de servidor que só recebe dado pronto. A base de cada célula é escrita aqui, dentro do próprio
 * elemento (o ⓘ do cabeçalho não tem como listá-las: elas chegam como elemento pronto). Nenhuma célula não medida fica sem motivo.
 */
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { Direcao } from '../../_chrome/medidas/direcao'
import { ZeroMedido } from '../../_chrome/medidas/marcas'
import { PastilhaAusencia } from '../../_chrome/ausencia/pastilhas'
import { dm } from './formatos'
import type { CelulaDoCabecalho } from './cabecalho-model'
import './canal-medidas.css'

const PASTILHA_CLASSE: Record<string, string> = { ativo: 'ativo', parado: 'parado', em_queda: 'queda', saiu: 'fora', erro: 'erro', primeira_busca: 'novo', pausado: 'novo', nao_carregou: 'novo', nao_medido: 'novo' }
const PASTILHA_GLIFO: Record<string, string> = { ativo: '✓', parado: '⏸', em_queda: '▼', saiu: '✕', erro: '!', primeira_busca: '↻', pausado: '⏸', nao_carregou: '!', nao_medido: '–' }

function Valor({ c }: { c: CelulaDoCabecalho }) {
  if (c.valor === 'nao_carregou') return <PastilhaAusencia estado="falhou" />
  if (c.valor === 'nao_medido') return <span className="obs-ch-nm">{c.chave === 'estado' ? 'não confirmado' : 'não medido'}</span>
  const d = c.detalhe
  switch (d.chave) {
    case 'inscritos':
      return <b className="num">{d.texto}</b>
    case 'direcao':
      if (d.direcao.tipo !== 'medido') return null
      return (
        <>
          <Direcao variante="contorno" simbolo={d.direcao.simbolo} pct={d.direcao.pct} />
        </>
      )
    case 'estado': {
      const t = d.estado.tipo
      return <span className={`pc-est ${PASTILHA_CLASSE[t] ?? 'novo'}`}><span aria-hidden="true">{PASTILHA_GLIFO[t]}</span><span>{d.estado.pastilha}</span></span>
    }
    case 'acerto': {
      const pc = d.pct === null ? null : <span className="pc-pc"> ({d.pct}%)</span>
      return d.k === 0
        ? <><ZeroMedido /><b className="num">0 de {d.n}</b>{pc}</>
        : <><b className="num">{d.k} de {d.n}</b>{pc}</>
    }
    case 'ritmo':
      return <><b className="num">{d.porSemana}</b><span className="un">por semana</span></>
    case 'criador': {
      if (d.k === null || d.n === null) return null
      const pc = d.pct === null ? null : <span className="pc-pc"> ({d.pct}%)</span>
      return d.k === 0
        ? <><ZeroMedido /><b className="num">0 de {d.n}</b>{pc}</>
        : <><b className="num">{d.k} de {d.n}</b>{pc}</>
    }
  }
}

function Base({ c }: { c: CelulaDoCabecalho }) {
  const d = c.detalhe
  return (
    <>
      {d.chave === 'acerto' && c.valor !== 'nao_medido' && c.valor !== 'nao_carregou' && !d.soNumero && d.pontos.length > 0 ? (
        <span className="pc-qs" style={{ ['--cols' as string]: d.colunas }} aria-hidden="true">
          {d.pontos.map((p, i) => <i key={i} className={`pc-q ${p}`} />)}
        </span>
      ) : null}
      <span>{c.base}</span>
      {d.chave === 'direcao' && d.avisoAte ? (
        <span className="pc-av"><span aria-hidden="true">⚠</span><span>ainda cruza a mudança de {dm(MEASURE_RULES.countChange)}</span></span>
      ) : null}
    </>
  )
}

/** Um `<div>` por célula (válido dentro de `<dl>`), na ordem recebida. */
export function CelulasDoCabecalho({ celulas }: { celulas: CelulaDoCabecalho[] }) {
  return (
    <>
      {celulas.map(c => (
        <div key={c.chave} className="pc-cel" data-celula={c.chave} data-valor={c.valor}>
          <dt>{c.rotulo}</dt>
          <dd className="v"><Valor c={c} /></dd>
          <dd className="b"><Base c={c} /></dd>
        </div>
      ))}
    </>
  )
}
