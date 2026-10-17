/**
 * E5a Tarefa 21a: a faixa de números do resumo (Views agora; Com 1, 7 e 30 dias; Subida). Cada célula tem uma das quatro formas
 * (número, zero medido em caixa vazada, não medido em hachura, ainda não existe pontilhado) e nunca troca de aparência. Componente de servidor.
 */
import { NaoCarregou, NaoMedido, ZeroMedido } from '../../_chrome/medidas/marcas'
import { abrev } from './formatos'
import type { FaixaDeNumeros } from './resumo-model'
import type { CelulaDeIdade } from './idade-model'
import type { CelulaDaSubida } from './subida-model'
import './historico-medidas.css'

function Idade({ c }: { c: CelulaDeIdade }) {
  return (
    <div className="nc" data-celula={`idade-${c.idade}`} data-estado={c.estado}>
      <dt>{c.rotulo}<span className="nsub">{c.estado === 'nao_medido' ? '' : c.sub}</span></dt>
      <dd>
        {c.estado === 'ok' ? <><b className="num">{c.views === null ? '' : abrev(c.views)}</b>{c.razao ? <span className="rz">{c.razao}</span> : null}</>
          : c.estado === 'zero' ? <><ZeroMedido /><span className="rz">medido: nenhuma view</span></>
          : c.estado === 'ainda_nao_existe' ? <span className="hv-ainda-tag">ainda não existe</span>
          : <NaoMedido curta={c.sub} longa={`${c.rotulo}: ${c.sub}`} />}
      </dd>
    </div>
  )
}

function Subida({ c }: { c: CelulaDaSubida }) {
  return (
    <div className="nc" data-celula="subida" data-estado={c.estado}>
      <dt>{c.rotulo}<span className="nsub">{c.estado === 'nao_medido' || c.estado === 'nao_carregou' ? '' : c.sub}</span></dt>
      <dd>
        {c.estado === 'ok' ? <><b className="num">{c.valor}</b>{c.razao ? <span className="rz">{c.razao}</span> : null}</>
          : c.estado === 'neutro' ? <span className="hv-neu">{c.valor}</span>
          : c.estado === 'nao_carregou' ? <NaoCarregou />
          : <NaoMedido curta={c.sub} longa={`Subida: ${c.sub}`} />}
      </dd>
    </div>
  )
}

export function FaixaDeNumerosHistorico({ faixa }: { faixa: FaixaDeNumeros }) {
  const v = faixa.viewsAgora
  return (
    <dl className="nstrip hv-faixa" aria-label="Números do vídeo">
      <div className="nc" data-celula="views-agora"><dt>{v.rotulo}<span className="nsub">{v.sub}</span></dt><dd><b className="num">{v.texto}</b></dd></div>
      {faixa.idades.map((c) => <Idade key={c.idade} c={c} />)}
      <Subida c={faixa.subida} />
    </dl>
  )
}
