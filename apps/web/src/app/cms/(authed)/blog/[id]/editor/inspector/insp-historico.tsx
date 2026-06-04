'use client'

import { useEditorState } from '../context'

/* ------------------------------------------------------------------ */
/*  InspHistorico                                                      */
/* ------------------------------------------------------------------ */

export function InspHistorico() {
  const state = useEditorState()
  const { history } = state.shared

  return (
    <section
      data-testid="insp-historico"
      className="border-b border-neutral-100 p-4 dark:border-neutral-800"
    >
      {/* Header */}
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Histórico
        {history.length > 0 && (
          <span
            data-testid="hist-count"
            className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-neutral-100 px-1.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
          >
            {history.length}
          </span>
        )}
      </h3>

      <div className="mt-3">
        {history.length === 0 ? (
          <p className="text-xs text-neutral-400" data-testid="hist-empty">
            Sem histórico
          </p>
        ) : (
          <ol data-testid="hist-timeline" className="space-y-2">
            {history.map((entry, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                <div className="text-xs">
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    Etapa → {entry.to}
                  </span>
                  <div className="text-neutral-400">{entry.date}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
