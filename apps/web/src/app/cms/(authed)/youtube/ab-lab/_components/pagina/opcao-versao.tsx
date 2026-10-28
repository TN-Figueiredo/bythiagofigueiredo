'use client'
// Uma opção do painel de escolha (M7b T11; mockup r4 `opcao()`). No máximo 2 selos; o texto vem do modelo (`textoDoSelo`).
import { useState, type ReactElement, type Ref } from 'react'
import { textoDoSelo, type FaseFrase, type OpcaoEscolha, type PainelEscolha, type SeloEscolha } from '@/lib/youtube/ab-lab-pagina/painel-escolha'
import { Ic, type NomeIcone } from './icones-painel'

const ICONE_SELO: Record<SeloEscolha, NomeIcone> = {
  no_ar: 'dot', no_ar_ultima: 'clock', sugerida: 'star', escolhida: 'user', mantida: 'user', titulo_no_ar: 'dot', miniatura_no_ar: 'dot',
}
const CLASSE_SELO: Record<SeloEscolha, string> = {
  no_ar: 'dia', no_ar_ultima: 'ult', sugerida: 'sug', escolhida: 'esc', mantida: 'esc', titulo_no_ar: 'dia', miniatura_no_ar: 'dia',
}

/** Miniatura com o estado j do mockup: `<img onError>` troca por ícone com `role=img` e "Miniatura não carregou". */
export function MiniaturaPainel({ src }: { src: string | null }): ReactElement {
  const [falhou, setFalhou] = useState(false)
  if (!src || falhou) {
    return <span className="pe-th falha" role="img" aria-label={src ? 'Miniatura não carregou' : 'Sem miniatura'}><Ic n="img" /></span>
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="pe-th"><img src={src} alt="" aria-hidden="true" onError={() => setFalhou(true)} /></span>
}

export interface OpcaoVersaoProps {
  painel: PainelEscolha
  opcao: OpcaoEscolha
  fase: FaseFrase
  marcada: boolean
  /** radios travados (escrevendo, conferindo, sem rede, guardado) */
  travada: boolean
  onMarcar: (id: string) => void
  radioRef?: Ref<HTMLInputElement>
}

export function OpcaoVersao({ painel, opcao, fase, marcada, travada, onMarcar, radioRef }: OpcaoVersaoProps): ReactElement {
  const bloqueada = opcao.bloqueio !== null
  const desabilitada = travada || bloqueada
  return (
    <label className={`pe-opt${travada ? ' trava' : ''}${opcao.bloqueio === 'sem_original' ? ' bloq' : ''}`} data-versao={opcao.letra}>
      <input
        ref={radioRef} type="radio" name="pe-versao" value={opcao.id} checked={marcada} disabled={desabilitada}
        aria-label={`${opcao.original ? 'Original' : 'Versão'} ${opcao.letra}`}
        onChange={() => { if (!desabilitada) onMarcar(opcao.id) }}
      />
      <MiniaturaPainel src={opcao.miniatura} />
      <span className="pe-ot">
        <span className="pe-nm">
          <span className="pe-ch" aria-hidden="true">{opcao.letra}</span>
          {opcao.original ? 'Original' : `Versão ${opcao.letra}`} · {opcao.ctr === null ? <span className="pe-nao">CTR não medido</span> : <span className="tabular-nums">{opcao.ctrTexto}</span>}
        </span>
        <span className="pe-tt">{opcao.titulo ?? ''}</span>
      </span>
      {opcao.textoBloqueio ? <p className="pe-bloqtxt">{opcao.textoBloqueio}</p> : null}
      {opcao.selos.length > 0 ? (
        <span className="pe-tags">
          {opcao.selos.map(s => (
            <span key={s} className={`pe-selo ${CLASSE_SELO[s]}`}><Ic n={ICONE_SELO[s]} />{textoDoSelo(painel, opcao, s, fase)}</span>
          ))}
        </span>
      ) : null}
    </label>
  )
}
