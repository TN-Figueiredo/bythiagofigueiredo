'use client'

import { useCallback, type ChangeEvent } from 'react'
import { useEditorState, useEditorDispatch, useEditorVersion } from '../context'

/* ------------------------------------------------------------------ */
/*  StageIdeia — read-only briefing with editable title               */
/* ------------------------------------------------------------------ */

export function StageIdeia() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()

  const { shared, activeLang } = state
  const isFresh = version?.fresh ?? true

  /* ---- Title handler ---- */

  const handleTitleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      dispatch({ type: 'SET_TITLE', title: e.target.value })
    },
    [dispatch],
  )

  /* ---- Derived values ---- */

  const langLabel = activeLang === 'pt' ? '\u{1F1E7}\u{1F1F7} PT-BR' : '\u{1F1EC}\u{1F1E7} EN'
  const category = shared.category || '—'
  const readTime =
    version && version.readTime > 0
      ? `${version.readTime} min de leitura`
      : 'rascunho novo'
  const wordCount = (version?.words ?? 0).toLocaleString('pt-BR')

  /* ---- Render ---- */

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      {/* Hook */}
      <section>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Hook
        </p>
        {isFresh ? (
          <p className="text-[19px] leading-relaxed text-zinc-400">
            Defina o hook para esta versão
          </p>
        ) : (
          <p className="text-[19px] leading-relaxed text-zinc-200">
            {shared.hook}
          </p>
        )}
      </section>

      {/* Synopsis */}
      <section>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Sinopse
        </p>
        {isFresh ? (
          <p className="text-base leading-relaxed text-zinc-400">
            Defina a sinopse para esta versão
          </p>
        ) : (
          <p className="text-base leading-relaxed text-zinc-300">
            {shared.synopsis}
          </p>
        )}
      </section>

      {/* Editable title */}
      <section>
        <textarea
          value={version?.title ?? ''}
          onChange={handleTitleChange}
          placeholder="Título do post"
          rows={1}
          className="w-full resize-none border-0 bg-transparent text-[38px] font-semibold leading-tight text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-0"
          style={{ fontWeight: 600 }}
        />
      </section>

      {/* Meta line */}
      <section className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
        <span>{langLabel}</span>
        <span className="text-zinc-600">&middot;</span>
        <span>{category}</span>
        <span className="text-zinc-600">&middot;</span>
        <span>{readTime}</span>
        <span className="text-zinc-600">&middot;</span>
        <span>{wordCount} palavras</span>
      </section>
    </div>
  )
}
