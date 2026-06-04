'use client'

import { useMemo } from 'react'
import type { JSONContent } from '@tiptap/core'
import { imageStats } from '../helpers'
import {
  useEditorState,
  useEditorDispatch,
  useEditorVersion,
} from '../context'

/* ------------------------------------------------------------------ */
/*  Internal: extract blogImage nodes from body tree                   */
/* ------------------------------------------------------------------ */

interface ImageNode {
  id: string
  status: string
  alt: string
}

function collectImageNodes(node: JSONContent): ImageNode[] {
  const results: ImageNode[] = []
  if (node.type === 'blogImage' && node.attrs) {
    results.push({
      id: (node.attrs.id as string) ?? '',
      status: (node.attrs.status as string) ?? 'empty',
      alt: (node.attrs.alt as string) ?? '',
    })
  }
  if (node.content) {
    for (const child of node.content) results.push(...collectImageNodes(child))
  }
  return results
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const LANG_LABEL: Record<string, string> = {
  pt: 'PT-BR',
  en: 'EN',
}

const BADGE_EMPTY = {
  label: 'aguardando',
  className:
    'inline-flex items-center rounded-full bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-400',
} as const

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  done: {
    label: 'no ar',
    className:
      'inline-flex items-center rounded-full bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-400',
  },
  empty: BADGE_EMPTY,
  uploading: {
    label: 'enviando',
    className:
      'inline-flex items-center rounded-full bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-400',
  },
  processing: {
    label: 'processando',
    className:
      'inline-flex items-center rounded-full bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-400',
  },
}

function statusBadge(status: string): { label: string; className: string } {
  return STATUS_BADGE[status] ?? BADGE_EMPTY
}

/* ------------------------------------------------------------------ */
/*  StageImagens                                                       */
/* ------------------------------------------------------------------ */

export function StageImagens() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()

  const lang = state.activeLang

  const images = useMemo(
    () => collectImageNodes(version?.body ?? { type: 'doc' }),
    [version?.body],
  )

  const stats = useMemo(
    () => imageStats(version?.body ?? { type: 'doc' }, version?.coverReady ?? false),
    [version?.body, version?.coverReady],
  )

  const coverReady = version?.coverReady ?? false
  const coverImageUrl = version?.coverImageUrl ?? null

  /* Total = content images + cover (1) */
  const totalWithCover = stats.total + 1
  const doneWithCover = stats.done + (coverReady ? 1 : 0)
  const allDone = doneWithCover === totalWithCover

  /* Cover counts as 1, content images counted separately */
  const coverCount = 1
  const contentCount = stats.total

  if (!version) return null

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      {/* ---- Compact header ---- */}
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
          IMAGENS · {LANG_LABEL[lang] ?? lang.toUpperCase()}
        </p>
        {version.title && (
          <p className="mt-1 truncate text-[20px] text-zinc-400">
            {version.title}
          </p>
        )}
      </header>

      {/* ---- Summary bar ---- */}
      <div
        data-testid="img-summary"
        className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3"
      >
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-zinc-200">
            {doneWithCover}/{totalWithCover} imagens prontas
          </p>
          <p className="text-xs text-zinc-400">
            {coverCount} capa · {contentCount} no conteúdo
          </p>
        </div>
        {allDone ? (
          <span className="text-sm font-medium text-emerald-400">
            Tudo pronto
          </span>
        ) : (
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_STAGE', stage: 'imagens' })}
            className="rounded-md bg-amber-600/20 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-600/30"
          >
            Verificar pendente
          </button>
        )}
      </div>

      {/* ---- Cover section ---- */}
      <section data-testid="img-cover" className="space-y-3">
        <p className="text-sm font-medium text-zinc-300">
          Capa &amp; thumbnail · 1200×675
        </p>
        <div className="flex items-center gap-4 rounded-lg border border-zinc-700 bg-zinc-900/60 p-4">
          {/* Thumbnail or placeholder */}
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt="Capa"
              className="h-16 w-28 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-16 w-28 items-center justify-center rounded-md border border-dashed border-zinc-600 bg-zinc-800/50">
              <svg
                className="h-6 w-6 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
            </div>
          )}

          {/* Status badge */}
          <div className="flex-1">
            <span className={statusBadge(coverReady ? 'done' : 'empty').className}>
              {statusBadge(coverReady ? 'done' : 'empty').label}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {coverImageUrl ? (
              <button
                type="button"
                className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                Trocar
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Galeria
                </button>
                <button
                  type="button"
                  className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Upload
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ---- Content images section ---- */}
      <section data-testid="img-content" className="space-y-3">
        <p className="text-sm font-medium text-zinc-300">
          No conteúdo · {images.length}
        </p>

        {images.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-700 px-4 py-6 text-center text-sm text-zinc-500">
            Nenhuma imagem no conteúdo
          </p>
        ) : (
          <div className="space-y-2">
            {images.map((img, idx) => {
              const badge = statusBadge(img.status)
              return (
                <div
                  key={img.id || idx}
                  className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3"
                >
                  {/* ID badge */}
                  <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400">
                    {img.id || `img-${idx + 1}`}
                  </span>

                  {/* Status badge */}
                  <span className={badge.className}>{badge.label}</span>

                  {/* Alt text */}
                  <span className="flex-1 truncate text-sm text-zinc-300">
                    {img.alt || (
                      <span className="italic text-zinc-500">sem alt</span>
                    )}
                  </span>

                  {/* Position hint */}
                  <span className="text-xs text-zinc-500">
                    parágrafo {idx + 1}
                  </span>

                  {/* Navigate to rascunho */}
                  <button
                    type="button"
                    data-testid={`img-nav-${img.id || `img-${idx + 1}`}`}
                    onClick={() =>
                      dispatch({ type: 'SET_STAGE', stage: 'rascunho' })
                    }
                    className="rounded-md px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    →
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ---- Hint text ---- */}
      <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/30 px-4 py-3">
        <p className="text-xs text-zinc-500">
          Essas imagens vêm dos blocos do rascunho. Adicione ou remova no
          editor de Rascunho.
        </p>
      </div>
    </div>
  )
}
