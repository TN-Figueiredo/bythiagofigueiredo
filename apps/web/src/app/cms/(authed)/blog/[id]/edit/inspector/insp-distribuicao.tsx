'use client'

import { useEditorState, useEditorDispatch, useEditorVersion } from '../context'
import { imageStats } from '../helpers'

/* ------------------------------------------------------------------ */
/*  Status dot color + label                                          */
/* ------------------------------------------------------------------ */

function statusIndicator(published: boolean, dirty: boolean) {
  if (!published) {
    return {
      dot: 'bg-neutral-400',
      label: 'Rascunho · não publicado',
    }
  }
  if (dirty) {
    return {
      dot: 'bg-amber-500',
      label: 'Publicado · alterações pendentes',
    }
  }
  return {
    dot: 'bg-green-500',
    label: 'Publicado · no ar',
  }
}

/* ------------------------------------------------------------------ */
/*  InspDistribuicao                                                   */
/* ------------------------------------------------------------------ */

export function InspDistribuicao() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()

  if (!version) return null

  const lang = state.activeLang
  const { published, dirty, publishedAt, updatedAt, slug, body } = version

  const { dot, label } = statusIndicator(published, dirty)
  const stats = imageStats(body ?? { type: 'doc', content: [] }, version.coverReady)

  return (
    <section
      data-testid="insp-distribuicao"
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
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Distribuição
      </h3>

      <div className="mt-3 space-y-3">
        {/* ---- Status indicator ---- */}
        <div className="flex items-center gap-2" data-testid="dist-status">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
          <span className="text-sm text-neutral-700 dark:text-neutral-300">
            {label}
          </span>
        </div>

        {/* ---- URL ---- */}
        {published && (
          <div data-testid="dist-url">
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              URL
            </label>
            <span className="break-all text-xs text-neutral-600 dark:text-neutral-400">
              /blog/{lang}/{slug}
            </span>
          </div>
        )}

        {/* ---- Dates ---- */}
        {published && (
          <div data-testid="dist-dates" className="space-y-1 text-xs text-neutral-500 dark:text-neutral-400">
            {publishedAt && <div>Publicado em {publishedAt}</div>}
            {updatedAt && <div>Atualizado em {updatedAt}</div>}
          </div>
        )}

        {/* ---- Images count ---- */}
        <div data-testid="dist-images">
          <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Imagens
          </label>
          <span
            className={`text-xs font-medium ${
              stats.done < stats.total
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            {stats.done}/{stats.total}
          </span>
        </div>

        {/* ---- Update button ---- */}
        {published && dirty && (
          <button
            type="button"
            data-testid="dist-update"
            className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
            onClick={() =>
              dispatch({
                type: 'UPDATE_PUBLISHED',
                publishedAt: new Date().toISOString(),
              })
            }
          >
            Atualizar publicação
          </button>
        )}
      </div>
    </section>
  )
}
