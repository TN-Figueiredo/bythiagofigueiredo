'use client'

import { useEditorState } from '../context'
import { InspDetalhes } from './insp-detalhes'
import { InspDistribuicao } from './insp-distribuicao'
import { InspHistorico } from './insp-historico'
import { InspArquivar } from './insp-arquivar'

/* ------------------------------------------------------------------ */
/*  Inspector shell                                                   */
/* ------------------------------------------------------------------ */

export function Inspector() {
  const state = useEditorState()

  if (state.focus) return null

  return (
    <aside
      data-inspector=""
      data-testid="inspector"
      className="w-[340px] shrink-0 overflow-y-auto border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
    >
      <InspDetalhes />
      <InspDistribuicao />
      <InspHistorico />
      <InspArquivar />
    </aside>
  )
}
