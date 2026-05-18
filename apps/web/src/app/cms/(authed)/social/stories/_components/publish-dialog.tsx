'use client'

import { useState, useTransition } from 'react'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import {
  saveStoryDraft,
  publishStoryNow,
  scheduleStory,
} from '@/lib/social/actions/story-publish'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SlideStatus = 'pending' | 'publishing' | 'done' | 'failed'

interface PublishDialogProps {
  siteId: string
  postId: string
  slides: CardComposition[]
  caption?: string
  onClose: () => void
  onSuccess?: (outcome: 'draft' | 'published' | 'scheduled') => void
}

// ---------------------------------------------------------------------------
// Per-slide progress indicator
// ---------------------------------------------------------------------------

function SlideProgressGrid({ statuses }: { statuses: SlideStatus[] }) {
  if (statuses.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label="Progresso por slide">
      {statuses.map((status, i) => {
        const colors: Record<SlideStatus, string> = {
          pending:    'bg-neutral-700 border-neutral-600 text-neutral-400',
          publishing: 'bg-blue-500/20 border-blue-500 text-blue-300 animate-pulse',
          done:       'bg-green-500/20 border-green-500 text-green-400',
          failed:     'bg-red-500/20 border-red-500 text-red-400',
        }
        const labels: Record<SlideStatus, string> = {
          pending:    'Pendente',
          publishing: 'Publicando',
          done:       'Pronto',
          failed:     'Falhou',
        }
        return (
          <div
            key={i}
            role="listitem"
            aria-label={`Slide ${i + 1}: ${labels[status]}`}
            className={[
              'flex h-8 w-8 items-center justify-center rounded border text-[10px] font-bold tabular-nums transition-all',
              colors[status],
            ].join(' ')}
          >
            {status === 'done' ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : status === 'failed' ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              i + 1
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PublishDialog
// ---------------------------------------------------------------------------

export function PublishDialog({
  siteId,
  postId,
  slides,
  caption,
  onClose,
  onSuccess,
}: PublishDialogProps) {
  const [mode, setMode] = useState<'idle' | 'publishing' | 'scheduling' | 'done' | 'error'>('idle')
  const [scheduledAt, setScheduledAt] = useState('')
  const [slideStatuses, setSlideStatuses] = useState<SlideStatus[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function initSlideStatuses(count: number): SlideStatus[] {
    return Array.from({ length: count }, () => 'pending')
  }

  // ---------------------------------------------------------------------------
  // Publicar Agora
  // ---------------------------------------------------------------------------
  function handlePublishNow() {
    const initial = initSlideStatuses(slides.length)
    setSlideStatuses(initial)
    setMode('publishing')

    startTransition(async () => {
      // Simulate per-slide progress feedback (server action publishes atomically)
      for (let i = 0; i < slides.length; i++) {
        setSlideStatuses((prev) => {
          const next = [...prev]
          next[i] = 'publishing'
          return next
        })
        // Small delay for visual feedback between slide indicators
        await new Promise((r) => setTimeout(r, 300 + i * 150))
      }

      const result = await publishStoryNow(siteId, postId, slides, caption ? { caption } : undefined)

      if (result.ok) {
        setSlideStatuses(Array.from({ length: slides.length }, () => 'done'))
        setMode('done')
        onSuccess?.('published')
      } else {
        setSlideStatuses(Array.from({ length: slides.length }, () => 'failed'))
        setErrorMessage(result.error)
        setMode('error')
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Agendar
  // ---------------------------------------------------------------------------
  function handleSchedule() {
    if (!scheduledAt) return

    startTransition(async () => {
      const result = await scheduleStory(siteId, postId, slides, scheduledAt, caption ? { caption } : undefined)

      if (result.ok) {
        setMode('done')
        onSuccess?.('scheduled')
      } else {
        setErrorMessage(result.error)
        setMode('error')
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Salvar Rascunho
  // ---------------------------------------------------------------------------
  function handleSaveDraft() {
    startTransition(async () => {
      const result = await saveStoryDraft(siteId, postId, slides, caption ? { caption } : undefined)

      if (result.ok) {
        setMode('done')
        onSuccess?.('draft')
      } else {
        setErrorMessage(result.error)
        setMode('error')
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const isPublishing = mode === 'publishing'
  const isDone = mode === 'done'
  const isError = mode === 'error'

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Publicar Story"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-100">Publicar Story</h2>
          {!isPublishing && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        {isDone ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12l6 6L20 6" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-medium text-neutral-200">Operação concluída com sucesso!</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              Fechar
            </button>
          </div>
        ) : isError ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
              <p className="text-sm font-medium text-red-400">Erro ao publicar</p>
              {errorMessage && (
                <p className="mt-1 text-xs text-red-300">{errorMessage}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setMode('idle'); setSlideStatuses([]) }}
              className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        ) : isPublishing ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-400">Publicando slides no Instagram...</p>
            <SlideProgressGrid statuses={slideStatuses} />
            <p className="text-[11px] text-neutral-600">
              Não feche esta janela enquanto a publicação estiver em andamento.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Publicar Agora */}
            <button
              type="button"
              onClick={handlePublishNow}
              disabled={isPending}
              className="flex w-full items-center gap-3 rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3.5 text-left transition-colors hover:border-neutral-600 hover:bg-neutral-700 disabled:opacity-50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 3l10 5-10 5V3z" fill="#60a5fa" />
                </svg>
              </span>
              <span>
                <span className="block text-sm font-medium text-neutral-200">Publicar Agora</span>
                <span className="block text-xs text-neutral-500 mt-0.5">
                  Publica imediatamente via API do Instagram
                </span>
              </span>
            </button>

            {/* Agendar */}
            <div className="rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3.5">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 shrink-0">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="#f59e0b" strokeWidth="1.2" />
                    <path d="M5 1v2M11 1v2M2 7h12" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </span>
                <span>
                  <span className="block text-sm font-medium text-neutral-200">Agendar</span>
                  <span className="inline-flex items-center gap-1 text-xs text-amber-400 mt-0.5">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M5 1v4l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    não nativo Instagram
                  </span>
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="flex-1 rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none"
                  aria-label="Data e hora de agendamento"
                />
                <button
                  type="button"
                  onClick={handleSchedule}
                  disabled={!scheduledAt || isPending}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
                >
                  Agendar
                </button>
              </div>
            </div>

            {/* Salvar Rascunho */}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isPending}
              className="flex w-full items-center gap-3 rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3.5 text-left transition-colors hover:border-neutral-600 hover:bg-neutral-700 disabled:opacity-50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-700 shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 2h8l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="#a3a3a3" strokeWidth="1.2" />
                  <path d="M5 2v3.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V2" stroke="#a3a3a3" strokeWidth="1.2" strokeLinecap="round" />
                  <rect x="4" y="9" width="8" height="5" rx=".5" stroke="#a3a3a3" strokeWidth="1.2" />
                </svg>
              </span>
              <span>
                <span className="block text-sm font-medium text-neutral-200">Salvar Rascunho</span>
                <span className="block text-xs text-neutral-500 mt-0.5">
                  Salva para publicar depois
                </span>
              </span>
            </button>

            {/* Cancel */}
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="mt-1 w-full rounded-lg py-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
