'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useEditorDispatch } from '../context'

/* ------------------------------------------------------------------ */
/*  InspArquivar                                                       */
/* ------------------------------------------------------------------ */

export function InspArquivar() {
  const dispatch = useEditorDispatch()
  const [confirming, setConfirming] = useState(false)

  function handleArchive() {
    dispatch({ type: 'SET_SHARED', field: 'status', value: 'archived' })
    toast.info('Post arquivado')
    setConfirming(false)
  }

  return (
    <section
      data-testid="insp-arquivar"
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
          <rect x="2" y="3" width="20" height="5" rx="1" />
          <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
          <path d="M10 12h4" />
        </svg>
        Arquivar
      </h3>

      <div className="mt-3">
        {!confirming ? (
          <button
            type="button"
            data-testid="archive-btn"
            className="w-full rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 dark:border-red-900 dark:bg-neutral-900 dark:text-red-400 dark:hover:border-red-700 dark:hover:bg-red-950"
            onClick={() => setConfirming(true)}
          >
            Arquivar post
          </button>
        ) : (
          <div data-testid="archive-confirm" className="space-y-2">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Arquivar este post?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="archive-confirm-yes"
                className="flex-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                onClick={handleArchive}
              >
                Arquivar
              </button>
              <button
                type="button"
                data-testid="archive-confirm-cancel"
                className="flex-1 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                onClick={() => setConfirming(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
