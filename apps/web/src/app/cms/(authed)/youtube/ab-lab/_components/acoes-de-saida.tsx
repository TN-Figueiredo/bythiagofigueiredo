'use client'

import { useEffect, useState } from 'react'
import { Pause, Square } from 'lucide-react'
import type { AbTestActiveView } from '@/lib/youtube/ab-types'
import type { OpcaoEncerrar, ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import { useCanAdminSite } from '@/lib/cms/site-admin-context'
import { AbPauseDialog } from './ab-pause-dialog'
import { AbEndTestDialog, cancelarFocoDaFaixa } from './ab-end-test-dialog'
import { dadosDoDialogoEncerrar } from './encerrar-props'
import './ab-end-test-dialog.css'

export const BTN_SAIDA = 'inline-flex items-center gap-[7px] justify-center py-[6px] px-[11px] text-[12.5px] font-semibold rounded-[9px] border border-cms-border whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text-dim hover:text-cms-text focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none'

/**
 * Aviso de página (role="status") depois de um encerramento em que o YouTube recusou algum campo: 6 s, com fechar.
 * Compartilhado pelos detalhes que têm Encerrar (ativo e "teste começou").
 */
export function useAvisoDePagina() {
  const [aviso, setAviso] = useState<string | null>(null)
  useEffect(() => cancelarFocoDaFaixa, [])
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 6000)
    return () => clearTimeout(t)
  }, [aviso])
  const avisoNode = (
    <div role="status" aria-live="polite">
      {aviso ? (
        <p className="etd-aviso">
          <span>{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso">Fechar</button>
        </p>
      ) : null}
    </div>
  )
  return { setAviso, avisoNode }
}

export interface AcoesDeSaidaProps {
  view: AbTestActiveView
  /** `endAbTest` com o id do teste, montada no server component da página (nunca importada aqui). */
  encerrar: (o: OpcaoEncerrar) => Promise<ResultadoAcaoSaida>
  /** `pauseAbTest` com o id do teste, idem; recebe o `seqVisto`. */
  pausar: (seqVisto: number) => Promise<ResultadoAcaoSaida>
  onAviso: (texto: string) => void
}

/** Botões Pausar e Encerrar (Pausar some com o teste já pausado) e seus diálogos: o mesmo bloco nos dois detalhes. */
export function AcoesDeSaida({ view, encerrar, pausar, onAviso }: AcoesDeSaidaProps) {
  const [showPause, setShowPause] = useState(false)
  const [showEnd, setShowEnd] = useState(false)
  const canAdminSite = useCanAdminSite()
  return (
    <>
      {view.status !== 'paused' ? (
        <button type="button" onClick={() => setShowPause(true)} className={BTN_SAIDA}>
          <Pause size={14} aria-hidden="true" />
          Pausar
        </button>
      ) : null}
      <button type="button" onClick={() => setShowEnd(true)} className={BTN_SAIDA}>
        <Square size={14} aria-hidden="true" />
        Encerrar
      </button>
      {showPause && (
        <AbPauseDialog pausar={pausar} seqVisto={view.restoreSeq} onClose={() => setShowPause(false)} onAviso={onAviso} />
      )}
      {showEnd && (
        <AbEndTestDialog
          aberto
          onFechar={() => setShowEnd(false)}
          testeNome={view.videoTitle}
          {...dadosDoDialogoEncerrar(view)}
          podeDeixarVariante={canAdminSite}
          encerrar={encerrar}
          seqVisto={view.restoreSeq}
          onAviso={onAviso}
        />
      )}
    </>
  )
}
