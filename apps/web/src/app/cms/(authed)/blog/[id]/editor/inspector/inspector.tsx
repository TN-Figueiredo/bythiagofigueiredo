'use client'

import { useEditorState } from '../context'

/* ------------------------------------------------------------------ */
/*  Card slot config                                                  */
/* ------------------------------------------------------------------ */

const CARDS = [
  { id: 'insp-detalhes', title: 'Detalhes' },
  { id: 'insp-distribuicao', title: 'Distribuicao' },
  { id: 'insp-historico', title: 'Historico' },
  { id: 'insp-arquivar', title: 'Arquivar' },
] as const

/* ------------------------------------------------------------------ */
/*  Inspector shell                                                   */
/* ------------------------------------------------------------------ */

export function Inspector() {
  const state = useEditorState()

  if (state.focus) return null

  return (
    <aside
      data-inspector=""
      className="w-[340px] shrink-0 overflow-y-auto border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
    >
      {CARDS.map(({ id, title }) => (
        <section
          key={id}
          data-testid={id}
          className="border-b border-neutral-100 p-4 dark:border-neutral-800"
        >
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            {title}
          </h3>
          <div className="mt-2 text-xs text-neutral-400">—</div>
        </section>
      ))}
    </aside>
  )
}
