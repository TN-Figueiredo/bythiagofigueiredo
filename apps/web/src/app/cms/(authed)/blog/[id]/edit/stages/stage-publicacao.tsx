'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  useEditorState,
  useEditorDispatch,
  useEditorVersion,
} from '../context'
import { publishGate } from '../helpers'
import { ScheduleModal } from '@/app/cms/(authed)/blog/_tabs/editorial/schedule-modal'

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const LANG_LABEL: Record<string, string> = {
  pt: 'PT-BR',
  en: 'EN',
}

const CHECK_LABELS: Record<string, string> = {
  title: 'Título',
  content: 'Conteúdo',
  images: 'Imagens',
}

/* ------------------------------------------------------------------ */
/*  StagePublicacao                                                    */
/* ------------------------------------------------------------------ */

export function StagePublicacao() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()
  const [showSchedule, setShowSchedule] = useState(false)

  if (!version) return null

  const lang = state.activeLang
  const gate = publishGate(state, lang)

  const isPublished = version.published
  const isDirty = version.dirty

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      {/* ---- Compact header ---- */}
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
          PUBLICACAO · {LANG_LABEL[lang] ?? lang.toUpperCase()}
        </p>
        {version.title && (
          <p className="mt-1 truncate text-[20px] text-zinc-400">
            {version.title}
          </p>
        )}
      </header>

      {/* ---- Read-only title ---- */}
      <section>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Titulo
        </p>
        <p data-testid="pub-title" className="text-lg text-zinc-200">
          {version.title || 'Sem titulo'}
        </p>
      </section>

      {/* ---- Title alternatives ---- */}
      {version.titleAlts.length > 0 && (
        <section data-testid="title-alts">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Alternativas de titulo
          </p>
          <div className="flex flex-wrap gap-2">
            {version.titleAlts.map((alt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => dispatch({ type: 'SET_TITLE', title: alt })}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-xs font-medium">
                  {i + 1}
                </span>
                {alt}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---- Excerpt ---- */}
      <section>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Descricao
        </p>
        <p data-testid="pub-excerpt" className="text-sm leading-relaxed text-zinc-300">
          {version.excerpt || 'Sem descricao'}
        </p>
      </section>

      {/* ---- Tags ---- */}
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Tags
        </p>
        <div data-testid="pub-tags" className="flex flex-wrap gap-2">
          {state.shared.tags.length > 0 ? (
            state.shared.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-300"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="text-sm text-zinc-500">Sem tags</span>
          )}
        </div>
      </section>

      {/* ---- Publish gate ---- */}
      <section data-testid="pub-gate">
        {gate.passed ? (
          <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-4">
            <p className="mb-3 text-sm font-semibold text-emerald-400">
              Pronto para publicacao
            </p>
            <div className="flex flex-wrap gap-2">
              {gate.checks.map((check) => (
                <span
                  key={check.key}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/50 px-3 py-1 text-sm text-emerald-300"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {CHECK_LABELS[check.key] ?? check.key}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-4">
            <p className="mb-3 text-sm font-semibold text-amber-400">
              Itens pendentes para publicacao
            </p>
            <div className="flex flex-wrap gap-2">
              {gate.checks.map((check) =>
                check.ok ? (
                  <span
                    key={check.key}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/50 px-3 py-1 text-sm text-emerald-300"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {CHECK_LABELS[check.key] ?? check.key}
                  </span>
                ) : (
                  <button
                    key={check.key}
                    type="button"
                    onClick={() =>
                      dispatch({ type: 'SET_STAGE', stage: check.stage })
                    }
                    className="inline-flex items-center gap-1.5 rounded-full bg-red-900/50 px-3 py-1 text-sm text-red-300 transition-colors hover:bg-red-900/70"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    {CHECK_LABELS[check.key] ?? check.key}
                  </button>
                ),
              )}
            </div>
          </div>
        )}
      </section>

      {/* ---- Publish actions ---- */}
      <section data-testid="pub-actions">
        {!isPublished && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!gate.passed}
              onClick={() => setShowSchedule(true)}
              className="rounded-md border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Agendar
            </button>
            <button
              type="button"
              disabled={!gate.passed}
              onClick={() => {
                dispatch({ type: 'PUBLISH' })
                toast.success('Post publicado')
              }}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Publicar
            </button>
          </div>
        )}

        {isPublished && !isDirty && (
          <div className="flex items-center gap-3">
            <a
              href={`/blog/${lang}/${version.slug}`}
              className="rounded-md border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-400"
            >
              Ver post no site
            </a>
            <button
              type="button"
              className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
            >
              Compartilhar nas redes
            </button>
          </div>
        )}

        {isPublished && isDirty && (
          <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-4">
            <p className="mb-3 text-sm font-medium text-amber-300">
              Alteracoes nao publicadas
            </p>
            <button
              type="button"
              onClick={() => {
                dispatch({
                  type: 'UPDATE_PUBLISHED',
                  publishedAt: new Date().toISOString(),
                })
                toast.success('Post atualizado no site')
              }}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500"
            >
              Atualizar no site
            </button>
          </div>
        )}
      </section>

      {/* ---- Schedule Modal ---- */}
      <ScheduleModal
        isOpen={showSchedule}
        postTitle={version.title || 'Sem titulo'}
        siteTimezone={state.siteTimezone}
        onConfirm={(scheduledFor) => {
          dispatch({ type: 'SET_SHARED', field: 'status', value: 'scheduled' })
          dispatch({ type: 'SET_FIELD', field: 'publishedAt', value: scheduledFor })
          setShowSchedule(false)
        }}
        onCancel={() => setShowSchedule(false)}
      />
    </div>
  )
}
