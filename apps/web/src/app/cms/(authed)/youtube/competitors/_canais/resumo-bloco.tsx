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
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'

const JANELA = MEASURE_RULES.direction.windowDays, PERIODOS = MEASURE_RULES.decline.windows

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

/** A frase-resumo com "subindo", "sem mudança" e "descendo" como botões de texto (o mesmo filtro da casa). Só vira botão a palavra com canal para mostrar. */
function FraseClicavel({ frase, casas, onDirecao }: { frase: string; casas: ResumoView['casas']; onDirecao: (d: DirecaoFiltro | null) => void }): ReactNode {
  const chaveDe: Record<string, DirecaoFiltro> = { subindo: 'sobe', 'sem mudança': 'estavel', descendo: 'desce' }
  return frase.split(/(\d+(?:[.,]\d+)? (?:subindo|sem mudança|descendo))/).map((p, i) => {
    if (i % 2 === 0) return destacarNumeros(p)
    const [n, ...resto] = p.split(' '), palavra = resto.join(' ')
    const casa = casas.find(c => c.chave === chaveDe[palavra])
    if (!casa || !casa.n) return <span key={i}>{destacarNumeros(p)}</span>
    return <span key={i}><strong>{n}</strong>{' '}<button type="button" className="obs-cn-fr-bt" aria-label={`Ver só os canais ${palavra}`} aria-pressed={casa.pressed}
      onClick={() => onDirecao(casa.pressed ? null : casa.chave)}>{palavra}</button></span>
  })
}

export function ResumoBloco({ resumo, onFiltro, onDirecao }: {
  resumo: ResumoView
  onFiltro: (f: FiltroDeEstado | null) => void
  onDirecao: (d: DirecaoFiltro | null) => void
}) {
  const { casas, filtros } = resumo
  const ligada = casas.find(c => c.pressed)
  return (
    <section className="obs-cn-res" aria-label="Resumo dos canais" data-k="resumo">
      <p className="obs-cn-frase" data-k="resumo-frase">
        {resumo.frase ? <FraseClicavel frase={resumo.frase} casas={casas} onDirecao={onDirecao} /> : 'Sem canais para resumir.'}{' '}
        <Tip label="Como o resumo e o estado são calculados">
          Parado: dias sem publicar acima do maior entre {MEASURE_RULES.stalled.floorDays} dias e {MEASURE_RULES.stalled.factor} vezes o intervalo habitual do canal. Canal que publica por temporada pode parecer parado.
          Em queda (sustentada): descendo em {PERIODOS} períodos de {JANELA} dias seguidos, só depois da mudança de contagem de 24/08/2026. Parado e descendo são medidas diferentes: um canal pode ser os dois. Saiu do YouTube: o YouTube não achou o canal em duas
          leituras seguidas; os números param na data. Não medido: menos de {JANELA * 2} dias de registro, dia sem registro, ou a contagem não existe. No seu canal, o
          YouTube não dá o número por dia. Cálculo do Observatório sobre dados públicos do YouTube.
        </Tip>
      </p>
      <p className="obs-cn-casas-leg" data-k="casas-legenda">{ligada ? `Mostrando só: ${ligada.palavra}. Clique de novo para limpar.` : 'Clique numa direção para ver só esses canais.'}</p>
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
              {f.ainda ? <AindaNaoExiste existeEm={f.ainda} /> : f.naoMedido ? <span className="obs-ch-nm">{f.naoMedido}</span> : f.n === null ? <NaoCarregou /> : f.base ? <><b className="num">{f.n}</b><span className="obs-cn-filtro-b"> de {f.base.medidos}</span></> : f.n === 0 ? <ZeroMedido /> : <b className="num">{f.n}</b>}
            </span>
          </button>
        ))}
      </div>
      <div className="obs-cn-faixa">
        <p><b>Direção:</b> views dos últimos {JANELA} dias contra os {JANELA} anteriores, cada canal contra ele mesmo.</p>
        <ul className="obs-cn-legenda">
          <li><span className="obs-cn-sy sobe" aria-hidden="true">▲</span> subindo, +10% ou mais</li>
          <li><span className="obs-cn-sy estavel" aria-hidden="true">＝</span> sem mudança</li>
          <li><span className="obs-cn-sy desce" aria-hidden="true">▼</span> descendo, −10% ou menos</li>
          <li><span className="obs-cn-sy nm obs-ch-nm" aria-hidden="true" /> não medido, com o motivo</li>
        </ul>
        {resumo.avisoDeContagem ? (
          <p className="obs-cn-aviso" data-k="aviso-contagem">Até {dm(resumo.avisoDeContagem.ate)} os {JANELA * 2} dias cruzam a mudança de contagem de 24/08/2026.</p>
        ) : null}
      </div>
    </section>
  )
}

/** Texto próprio de cada filtro de estado na linha de estado (sem lower-case do rótulo: "Saíram do YouTube" virava "saíram do youtube"). */
const PALAVRA_DO_FILTRO: Record<string, string> = { parados: 'parados', 'em-queda': 'em queda', sairam: 'que saíram do YouTube', problemas: 'com problema', 'sem-videos': 'sem vídeos' }

/** Com filtro ligado: o que está filtrado, quantos canais a lista mostra e de quantos. Fica logo acima da lista (não no bloco das casas), para o clique mostrar o resultado perto dele. */
export function EstadoDoFiltro({ resumo, mostrando, onLimpar }: { resumo: ResumoView; mostrando: { n: number; de: number }; onLimpar: () => void }) {
  const direcao = resumo.casas.find(c => c.pressed)?.palavra
  const filtro = resumo.filtros.find(f => f.pressed && f.chave !== 'todos')
  const estado = filtro ? (PALAVRA_DO_FILTRO[filtro.chave] ?? filtro.rotulo) : undefined
  const dois = Boolean(direcao && estado)
  const quais = dois ? `${direcao} e também ${estado}` : (direcao ?? estado ?? '')
  return (
    <p className="obs-cn-estado-filtro" data-k="estado-do-filtro" aria-live="polite">
      Só {quais}: {mostrando.n} de {mostrando.de} {mostrando.de === 1 ? 'canal' : 'canais'} ·{' '}
      <button type="button" className="obs-cn-fr-bt" onClick={onLimpar}>{dois ? 'Limpar filtros' : 'Limpar filtro'}</button>
    </p>
  )
}
