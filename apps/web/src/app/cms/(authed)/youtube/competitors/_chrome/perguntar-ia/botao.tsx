'use client'
// A5 · E17 degrau 1, Tarefa 10: o botão "Perguntar a uma IA" e, depois do primeiro clique, o diálogo. A ação do servidor chega por prop (`onGerar`);
// nenhum arquivo desta pasta importa o arquivo da ação. Desligado (CONTEXTO_IA_RULES.ligado falso) não desenha nada.
import { useRef } from 'react'
import { CONTEXTO_IA_RULES } from '@/lib/youtube/observatorio/contexto-ia/regras'
import type { PedidoDePacote, TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import type { RespostaDePacote } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { Dialogo } from './dialogo'
import * as F from './frases-do-dialogo'
import { Icones } from './info'
import { usePacote } from './use-pacote'
import './perguntar-ia.css'

export interface PropsPerguntarIa {
  tela: TelaId
  id?: string
  nomeDaTela: string
  exemplos: readonly string[]
  onGerar: (p: PedidoDePacote) => Promise<RespostaDePacote>
}

export function PerguntarIa(props: PropsPerguntarIa) {
  const h = usePacote({ tela: props.tela, id: props.id, onGerar: props.onGerar })
  const abridor = useRef<HTMLButtonElement>(null)
  const jaAbriu = useRef(false)
  if (!CONTEXTO_IA_RULES.ligado) return null
  if (h.estado.fase !== 'fechado') jaAbriu.current = true
  return (
    <>
      <button type="button" ref={abridor} className="btn pi-btn" id="pi-abre" aria-haspopup="dialog" onClick={h.abrir}>
        <Icones.ia /><span>{F.BOTAO}</span>
      </button>
      {jaAbriu.current && (
        <Dialogo
          nomeDaTela={props.nomeDaTela} exemplos={props.exemplos} estado={h.estado} copia={h.copia} pergunta={h.pergunta}
          onPergunta={h.setPergunta} onCopiar={h.copiar} onFechar={h.fechar} onTentarDeNovo={h.tentarDeNovo} abridor={abridor}
        />
      )}
    </>
  )
}
