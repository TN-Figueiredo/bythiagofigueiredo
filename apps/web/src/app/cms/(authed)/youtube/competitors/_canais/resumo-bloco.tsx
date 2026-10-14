'use client'
/**
 * A5 · E5a, Tarefa 5: o bloco de resumo da lista de Canais. A frase, as quatro casas da direção (botões que filtram), os filtros de estado
 * (botões com a mesma contagem do filtro) e a faixa da base. A resposta fica num lugar só; a busca e os alternadores vêm depois.
 */
import type { ReactNode } from 'react'
import type { DirecaoFiltro, ResumoView } from './view-model'
import type { FiltroDeEstado } from './estado-model'
import { AindaNaoExiste, NaoCarregou, ZeroMedido } from '../_chrome/medidas/marcas'
import { Tip } from './cells'

const GLIFO: Record<DirecaoFiltro, string> = { sobe: '▲', estavel: '＝', desce: '▼', 'nao-medido': '' }
const GLIFO_FILTRO: Partial<Record<FiltroDeEstado, string>> = { parados: '⏸', 'em-queda': '▼', sairam: '✕', problemas: '⚠' }
const dm = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`

/** Os números da frase-resumo em peso 600 (o destaque único do topo). */
function destacarNumeros(frase: string): ReactNode {
  return frase.split(/(\d+(?:[.,]\d+)?)/).map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p))
}

function Numero({ n }: { n: number | null }): ReactNode {
  if (n === null) return <NaoCarregou />
  return n === 0 ? <ZeroMedido /> : <b className="num">{n}</b>
}

export function ResumoBloco({ resumo, onFiltro, onDirecao }: {
  resumo: ResumoView
  onFiltro: (f: FiltroDeEstado | null) => void
  onDirecao: (d: DirecaoFiltro | null) => void
}) {
  const { casas, filtros } = resumo
  return (
    <section className="obs-cn-res" aria-label="Resumo dos canais" data-k="resumo">
      <p className="obs-cn-frase" data-k="resumo-frase">
        {resumo.frase ? destacarNumeros(resumo.frase) : 'Sem canais para resumir.'}{' '}
        <Tip label="Como o resumo e o estado são calculados">
          Parado: dias sem publicar acima do maior entre 28 dias e 4 vezes o intervalo habitual do canal. Canal que publica por temporada pode parecer parado.
          Em queda (sustentada): descendo em 3 períodos de 28 dias seguidos, só depois da mudança de contagem de 24/08/2026. Parado e descendo são medidas diferentes: um canal pode ser os dois. Saiu do YouTube: o YouTube não achou o canal em duas
          leituras seguidas; os números param na data. Não medido: menos de 56 dias de registro, dia sem registro, ou a contagem não existe. No seu canal, o
          YouTube não dá o número por dia. Cálculo do Observatório sobre dados públicos do YouTube.
        </Tip>
      </p>
      <div className="obs-cn-casas" role="group" aria-label="Filtrar canais por direção">
        {casas.map(c => (
          <button key={c.chave} type="button" className={`obs-cn-casa ${c.chave}${c.n === null ? ' sk' : c.n === 0 ? ' z' : ''}`} aria-pressed={c.pressed} aria-label={c.leitor}
            style={c.n ? { flex: `${c.n} 1 0` } : undefined}
            onClick={() => onDirecao(c.pressed ? null : c.chave)}>
            <span className="obs-cn-casa-b" aria-hidden="true">
              {GLIFO[c.chave] ? <span className="obs-cn-casa-g">{GLIFO[c.chave]}</span> : null}
              <Numero n={c.n} />
            </span>
            <span className="obs-cn-casa-p" aria-hidden="true">{c.palavra}{c.pressed ? ' ×' : ''}</span>
            {c.data ? <span className="obs-cn-casa-d" aria-hidden="true">{c.data}</span> : null}
          </button>
        ))}
      </div>
      <div className="obs-cn-filtros" role="group" aria-label="Filtrar canais por estado">
        {filtros.map(f => (
          <button key={f.chave} type="button" className="obs-cn-filtro" aria-pressed={f.pressed} aria-label={f.leitor}
            onClick={() => onFiltro(f.pressed || f.chave === 'todos' ? null : f.chave)}>
            {GLIFO_FILTRO[f.chave] ? <span className={`obs-cn-filtro-i ${f.chave}`} aria-hidden="true">{GLIFO_FILTRO[f.chave]}</span> : null}
            <span aria-hidden="true">{f.rotulo}</span>{' '}
            <span className="obs-cn-filtro-n" aria-hidden="true">
              {f.ainda ? <AindaNaoExiste existeEm={f.ainda} /> : f.naoMedido ? <span className="obs-ch-nm">{f.naoMedido}</span> : f.n === null ? <NaoCarregou /> : f.n === 0 ? <ZeroMedido /> : <b className="num">{f.n}</b>}
            </span>
          </button>
        ))}
      </div>
      <div className="obs-cn-faixa">
        <p><b>Direção:</b> views dos últimos 28 dias contra os 28 anteriores, cada canal contra ele mesmo.</p>
        <ul className="obs-cn-legenda">
          <li><span className="obs-cn-sy sobe" aria-hidden="true">▲</span> subindo, +10% ou mais</li>
          <li><span className="obs-cn-sy estavel" aria-hidden="true">＝</span> sem mudança</li>
          <li><span className="obs-cn-sy desce" aria-hidden="true">▼</span> descendo, −10% ou menos</li>
          <li><span className="obs-cn-sy nm obs-ch-nm" aria-hidden="true" /> não medido, com o motivo</li>
        </ul>
        {resumo.avisoDeContagem ? (
          <p className="obs-cn-aviso" data-k="aviso-contagem">Até {dm(resumo.avisoDeContagem.ate)} os 56 dias cruzam a mudança de contagem de 24/08/2026.</p>
        ) : null}
      </div>
    </section>
  )
}
