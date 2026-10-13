'use client'
/**
 * O bloco "Carregar mais" (spec 5.6): barra de progresso, "Mostrando 120 de 202 vídeos", a frase do que vem e o botão, o único
 * preenchido da tela, com 44 px. Só botão: nada carrega ao rolar. Depois do clique quem chama move o foco e anuncia.
 */
import type { ListaView } from './lista'

/** O que o bloco precisa. A lista de Capas usa o mesmo bloco, com outra marca e outro rótulo, para o "Mostrar mais" de 24 em 24 do celular (`grade-paginacao.ts`). */
export type MaisView = Pick<NonNullable<ListaView['mais']>, 'mostrando' | 'total' | 'frase' | 'botao'> & { soAntigos?: string | null }

export function CarregarMais({ mais, onMais, rotulo = 'Carregar mais vídeos', marca = '', espera = false }: {
  mais: MaisView; onMais: () => void
  /** O `aria-label` do grupo. */
  rotulo?: string
  /** Classe extra do grupo (`cv-pag`: o bloco da paginação do celular). */
  marca?: string
  /** O bloco dos antigos (e o aviso que o explica) fica escondido a 480 px ou menos enquanto a grade ainda tem cartões por mostrar (`cv-pag-espera`). */
  espera?: boolean
}) {
  const pct = mais.total ? Math.round((mais.mostrando / mais.total) * 100) : 0
  return (
    <>
      {mais.soAntigos ? <p className={'cv-soantigos' + (espera ? ' cv-pag-espera' : '')}>{mais.soAntigos}</p> : null}
      <div className={'cv-more' + (marca ? ' ' + marca : '') + (espera ? ' cv-pag-espera' : '')} role="group" aria-label={rotulo}>
        <div className="cv-more-bar" role="progressbar" aria-label="Vídeos na tela" aria-valuemin={0} aria-valuemax={mais.total} aria-valuenow={mais.mostrando}><i style={{ width: pct + '%' }} /></div>
        <p className="cv-more-t"><b>Mostrando {mais.mostrando} de {mais.total} vídeos</b></p>
        <p className="cv-more-s">{mais.frase}</p>
        <button type="button" className="obs-ch-btn pri" onClick={onMais}>{mais.botao}</button>
      </div>
    </>
  )
}
