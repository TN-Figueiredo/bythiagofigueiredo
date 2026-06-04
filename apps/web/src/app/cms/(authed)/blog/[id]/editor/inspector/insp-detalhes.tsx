'use client'

import { toast } from 'sonner'
import { useEditorState, useEditorDispatch, useEditorVersion } from '../context'
import { deriveSlug } from '../helpers'

/* ------------------------------------------------------------------ */
/*  Priority badge color                                              */
/* ------------------------------------------------------------------ */

function plevelColor(plevel: number): string {
  switch (plevel) {
    case 1:
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 2:
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    default:
      return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
  }
}

/* ------------------------------------------------------------------ */
/*  InspDetalhes                                                       */
/* ------------------------------------------------------------------ */

export function InspDetalhes() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()

  if (!version) return null

  const lang = state.activeLang
  const { shared } = state

  return (
    <section
      data-testid="insp-detalhes"
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
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
        Detalhes
      </h3>

      <div className="mt-3 space-y-3">
        {/* ---- Slug ---- */}
        <div data-testid="insp-slug">
          <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Slug
          </label>
          <div className="flex items-center rounded-md border border-neutral-200 bg-white text-sm dark:border-neutral-700 dark:bg-neutral-900">
            <span className="shrink-0 px-2 text-neutral-400 dark:text-neutral-600">
              /blog/{lang}/
            </span>
            <input
              type="text"
              value={version.slug}
              onChange={(e) =>
                dispatch({
                  type: 'SET_SLUG',
                  slug: deriveSlug(e.target.value),
                  touched: true,
                })
              }
              className="w-full bg-transparent px-1 py-1.5 text-sm outline-none"
              aria-label="Slug"
            />
          </div>
          {version.slugTouched && (
            <button
              type="button"
              className="mt-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
              onClick={() => {
                dispatch({
                  type: 'SET_SLUG',
                  slug: deriveSlug(version.title),
                  touched: false,
                })
                toast.info('Slug regenerado do titulo')
              }}
            >
              ↻ regenerar do titulo
            </button>
          )}
        </div>

        {/* ---- Excerpt ---- */}
        <div data-testid="insp-excerpt">
          <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Descricao
          </label>
          <textarea
            value={version.excerpt}
            onChange={(e) =>
              dispatch({ type: 'SET_EXCERPT', excerpt: e.target.value })
            }
            rows={3}
            className="w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-blue-600"
            aria-label="Excerpt"
          />
        </div>

        {/* ---- Priority badge ---- */}
        {shared.plevel !== null && (
          <div data-testid="insp-plevel">
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Prioridade
            </label>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${plevelColor(shared.plevel)}`}
            >
              P{shared.plevel}
            </span>
          </div>
        )}

        {/* ---- Category ---- */}
        {shared.category && (
          <div data-testid="insp-category">
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Categoria
            </label>
            <div className="flex items-center gap-1.5 text-sm text-neutral-700 dark:text-neutral-300">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
              {shared.category}
            </div>
          </div>
        )}

        {/* ---- Tags ---- */}
        {shared.tags.length > 0 && (
          <div data-testid="insp-tags">
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Tags
            </label>
            <div className="flex flex-wrap gap-1">
              {shared.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
