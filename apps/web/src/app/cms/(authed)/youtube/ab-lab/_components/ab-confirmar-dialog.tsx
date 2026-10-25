'use client'

// Confirmação de Aplicar / Voltar à original no teste v2 concluído (S8-F4 T12, T7). Mesma casca `.etd` da troca "mesmo assim".
import { useRef } from 'react'
import { CascaEtd } from './ab-confirmar-troca-dialog'
import { ICONE_ERRO } from './etd-icone-erro'
import './ab-end-test-dialog.css'

export interface AbConfirmarDialogProps {
  titulo: string
  lead: string
  /** Segunda linha (opcional): "O desfecho ainda é provisório." etc. */
  nota?: string | null
  rotuloConfirmar: string
  enviando: boolean
  /** Recusa da action: o diálogo continua aberto com a mensagem. */
  erro: string | null
  /** Botão seguro extra da recusa (ex.: "Recarregar"). */
  acaoSegura?: { rotulo: string; onClick: () => void } | null
  onVoltar: () => void
  onConfirmar: () => void
}

export function AbConfirmarDialog({ titulo, lead, nota, rotuloConfirmar, enviando, erro, acaoSegura, onVoltar, onConfirmar }: AbConfirmarDialogProps) {
  const voltarRef = useRef<HTMLButtonElement>(null)
  return (
    <CascaEtd
      titulo={titulo}
      onVoltar={onVoltar}
      voltarRef={voltarRef}
      travado={enviando}
      ids={{ titulo: 'etd-v-t', lead: 'etd-v-d', nota: 'etd-v-n' }}
      rodape={
        <>
          {acaoSegura ? <button type="button" className="etd-btn" onClick={acaoSegura.onClick}>{acaoSegura.rotulo}</button> : null}
          <button type="button" className="etd-btn over" disabled={enviando} onClick={onConfirmar}>{rotuloConfirmar}</button>
        </>
      }
    >
      <p className="etd-lead" id="etd-v-d">{lead}</p>
      <p className="etd-tiny" id="etd-v-n">{nota ?? ''}</p>
      {erro ? <div className="etd-msg err" role="alert">{ICONE_ERRO}<div>{erro}</div></div> : null}
    </CascaEtd>
  )
}
