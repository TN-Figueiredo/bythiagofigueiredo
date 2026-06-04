'use client'

import {
  useEditorState,
  useEditorDispatch,
  useEditorVersion,
} from '../context'

/* ------------------------------------------------------------------ */
/*  Character counter helper                                          */
/* ------------------------------------------------------------------ */

function charStatus(
  count: number,
  ideal: [number, number],
): { label: string; color: string } {
  if (count === 0) return { label: 'vazio', color: 'dim' }
  if (count < ideal[0]) return { label: 'curto', color: 'warn' }
  if (count <= ideal[1]) return { label: 'ideal', color: 'ok' }
  return { label: 'pode truncar', color: 'warn' }
}

const COLOR_MAP: Record<string, string> = {
  dim: 'text-zinc-400',
  warn: 'text-amber-500',
  ok: 'text-emerald-500',
}

const LANG_LABEL: Record<string, string> = {
  pt: 'PT-BR',
  en: 'EN',
}

/* ------------------------------------------------------------------ */
/*  StageSeo                                                          */
/* ------------------------------------------------------------------ */

export function StageSeo() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()

  if (!version) return null

  const lang = state.activeLang
  const titleStatus = charStatus(version.metaTitle.length, [40, 60])
  const descStatus = charStatus(version.metaDesc.length, [120, 160])

  /* SERP preview values */
  const serpTitle =
    version.metaTitle || version.title || 'Sem título'
  const serpDesc =
    version.metaDesc || version.excerpt || 'Sem descrição'
  const serpUrl = `bythiagofigueiredo.com/blog/${lang}/${version.slug || '...'}`

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      {/* ---- Compact header ---- */}
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
          SEO · {LANG_LABEL[lang] ?? lang.toUpperCase()}
        </p>
        {version.title && (
          <p className="mt-1 truncate text-[20px] text-zinc-400">
            {version.title}
          </p>
        )}
      </header>

      {/* ---- Meta title ---- */}
      <div className="space-y-1">
        <label
          htmlFor="seo-meta-title"
          className="text-sm font-medium text-zinc-300"
        >
          Meta título
        </label>
        <input
          id="seo-meta-title"
          type="text"
          value={version.metaTitle}
          onChange={(e) =>
            dispatch({
              type: 'SET_FIELD',
              field: 'metaTitle',
              value: e.target.value,
            })
          }
          placeholder="Título para buscadores"
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <p
          data-testid="meta-title-counter"
          className={`text-xs ${COLOR_MAP[titleStatus.color]}`}
        >
          {version.metaTitle.length} — {titleStatus.label}
        </p>
      </div>

      {/* ---- Meta description ---- */}
      <div className="space-y-1">
        <label
          htmlFor="seo-meta-desc"
          className="text-sm font-medium text-zinc-300"
        >
          Meta descrição
        </label>
        <textarea
          id="seo-meta-desc"
          rows={3}
          value={version.metaDesc}
          onChange={(e) =>
            dispatch({
              type: 'SET_FIELD',
              field: 'metaDesc',
              value: e.target.value,
            })
          }
          placeholder="Descrição para buscadores"
          className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <p
          data-testid="meta-desc-counter"
          className={`text-xs ${COLOR_MAP[descStatus.color]}`}
        >
          {version.metaDesc.length} — {descStatus.label}
        </p>
      </div>

      {/* ---- Google SERP preview ---- */}
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
          Prévia Google
        </p>
        <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-4">
          <p
            data-testid="serp-url"
            className="text-xs text-emerald-600"
          >
            {serpUrl}
          </p>
          <p
            data-testid="serp-title"
            className="mt-0.5 text-lg font-medium text-blue-400 hover:underline"
          >
            {serpTitle}
          </p>
          <p className="mt-1 text-sm text-zinc-400 line-clamp-2">
            {serpDesc}
          </p>
        </div>
      </div>
    </div>
  )
}
