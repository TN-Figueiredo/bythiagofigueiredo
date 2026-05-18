'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import type { SocialTemplate } from '@/lib/social/template-schemas'
import type { SocialPostData } from '@/lib/social/story-types'
import { StoryEditor } from './story-editor'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EditorTemplate = {
  id: string
  name: string
  thumbnailUrl: string | null
  aspectRatio: string
  composition?: CardComposition
}

interface SiteBrand {
  logoUrl: string | null
  primaryColor: string
  defaultLocale: string
  supportedLocales: string[]
}

/**
 * Callbacks receive postId as first arg so pages can close over it (edit page)
 * or pass a client-generated UUID (new story page).
 */
interface StoryEditorShellProps {
  siteId: string
  postId: string
  initialSlides: CardComposition[]
  initialCaption?: string
  brand: SiteBrand
  templates: SocialTemplate[]
  sourceContentType?: string | null
  onExport: (blob: Blob, metadata: { format: 'png'; scale: number; width: number; height: number }) => Promise<{ url: string } | null>
  onSaveTemplate: (name: string, composition: CardComposition, thumbnail: Blob) => Promise<void>
  onDeleteTemplate: (id: string) => Promise<void>
  onImageUpload: (file: File) => Promise<string>
  onSaveDraft: (postId: string, slides: unknown[], content?: { caption?: string }) => Promise<{ ok: boolean; error?: string; data?: { id: string } }>
  onPublishNow: (postId: string, slides: unknown[], content?: { caption?: string }) => Promise<{ ok: boolean; error?: string; data?: { id: string } }>
  onSchedule: (postId: string, slides: unknown[], scheduledAt: string, content?: { caption?: string }) => Promise<{ ok: boolean; error?: string; data?: { id: string } }>
}

function toEditorTemplates(templates: SocialTemplate[]): EditorTemplate[] {
  return templates
    .filter((t) => t.aspect_ratio === '9:16')
    .map((t) => ({
      id: t.id,
      name: t.name,
      thumbnailUrl: t.thumbnail_url ?? null,
      aspectRatio: t.aspect_ratio,
      composition: t.composition as CardComposition | undefined,
    }))
}

// ---------------------------------------------------------------------------
// StoryEditorShell
//
// Wraps StoryEditor with a floating top bar for save/publish/back actions.
// Receives action callbacks as props from the server component (page.tsx).
// ---------------------------------------------------------------------------

export function StoryEditorShell({
  postId,
  initialSlides,
  initialCaption,
  brand,
  templates,
  sourceContentType,
  onExport,
  onSaveTemplate,
  onDeleteTemplate,
  onImageUpload,
  onSaveDraft,
  onPublishNow,
  onSchedule,
}: StoryEditorShellProps) {
  const router = useRouter()
  const [showPublish, setShowPublish] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const postData: SocialPostData = {
    title: sourceContentType ? `Story — ${sourceContentType}` : 'Story manual',
    description: initialCaption,
    logoUrl: brand.logoUrl ?? undefined,
  }

  // Keep a snapshot of the latest slides so save/publish always have the current state
  const latestSlidesRef = useRef<CardComposition[]>(initialSlides)
  const handleSlidesChange = useCallback((updated: CardComposition[]) => {
    latestSlidesRef.current = updated
  }, [])

  // ---------------------------------------------------------------------------
  // Salvar Rascunho (top bar button)
  // ---------------------------------------------------------------------------
  const handleSaveDraftClick = useCallback(async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const result = await onSaveDraft(postId, latestSlidesRef.current, {
        caption: initialCaption,
      })
      if (result.ok) {
        setSaveMessage({ type: 'ok', text: 'Rascunho salvo!' })
      } else {
        setSaveMessage({ type: 'error', text: result.error ?? 'Erro ao salvar.' })
      }
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }, [onSaveDraft, postId, initialCaption])

  function handlePublishSuccess() {
    setShowPublish(false)
    router.push('/cms/social/stories')
  }

  // Bind postId into the publish dialog callbacks (dialog doesn't know postId)
  const boundOnSaveDraft = useCallback(
    (slides: unknown[], content?: { caption?: string }) => onSaveDraft(postId, slides, content),
    [onSaveDraft, postId],
  )
  const boundOnPublishNow = useCallback(
    (slides: unknown[], content?: { caption?: string }) => onPublishNow(postId, slides, content),
    [onPublishNow, postId],
  )
  const boundOnSchedule = useCallback(
    (slides: unknown[], scheduledAt: string, content?: { caption?: string }) =>
      onSchedule(postId, slides, scheduledAt, content),
    [onSchedule, postId],
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      {/* Floating top bar — sits above the StoryEditor (which is fixed inset-0) */}
      <div
        className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-950/95 px-4 py-2 backdrop-blur-sm"
        style={{ height: 44 }}
      >
        {/* Left: Back */}
        <button
          type="button"
          onClick={() => router.push('/cms/social/stories')}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
          aria-label="Voltar à galeria"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Voltar
        </button>

        {/* Center: save status */}
        {saveMessage && (
          <span
            className={`text-xs font-medium ${
              saveMessage.type === 'ok' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {saveMessage.text}
          </span>
        )}

        {/* Right: Save + Publish */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDraftClick}
            disabled={isSaving}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Salvando…' : 'Salvar Rascunho'}
          </button>
          <button
            type="button"
            onClick={() => setShowPublish(true)}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
          >
            Publicar
          </button>
        </div>
      </div>

      {/* StoryEditor (fixed inset-0 — the top bar floats above it) */}
      <div style={{ paddingTop: 44 }} className="h-screen">
        <StoryEditor
          initialSlides={initialSlides}
          postData={postData}
          templates={toEditorTemplates(templates)}
          onExport={onExport}
          onSaveTemplate={onSaveTemplate}
          onDeleteTemplate={onDeleteTemplate}
          onImageUpload={onImageUpload}
          onSlidesChange={handleSlidesChange}
        />
      </div>

      {/* Publish dialog */}
      {showPublish && (
        <PublishDialogShell
          slides={latestSlidesRef.current}
          caption={initialCaption}
          onClose={() => setShowPublish(false)}
          onSuccess={handlePublishSuccess}
          onSaveDraft={boundOnSaveDraft}
          onPublishNow={boundOnPublishNow}
          onSchedule={boundOnSchedule}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// PublishDialogShell
//
// An inline publish dialog that calls prop callbacks instead of importing
// server actions directly (security pattern: no direct server action imports
// in client components — receive them as props from server component pages).
// ---------------------------------------------------------------------------

type SlideStatus = 'pending' | 'publishing' | 'done' | 'failed'

interface PublishDialogShellProps {
  slides: CardComposition[]
  caption?: string
  onClose: () => void
  onSuccess: () => void
  onSaveDraft: (slides: unknown[], content?: { caption?: string }) => Promise<{ ok: boolean; error?: string; data?: { id: string } }>
  onPublishNow: (slides: unknown[], content?: { caption?: string }) => Promise<{ ok: boolean; error?: string; data?: { id: string } }>
  onSchedule: (slides: unknown[], scheduledAt: string, content?: { caption?: string }) => Promise<{ ok: boolean; error?: string; data?: { id: string } }>
}

function PublishDialogShell({
  slides,
  caption,
  onClose,
  onSuccess,
  onSaveDraft,
  onPublishNow,
  onSchedule,
}: PublishDialogShellProps) {
  const [mode, setMode] = useState<'idle' | 'publishing' | 'done' | 'error'>('idle')
  const [scheduledAt, setScheduledAt] = useState('')
  const [slideStatuses, setSlideStatuses] = useState<SlideStatus[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, setIsPending] = useState(false)

  const content = caption ? { caption } : undefined

  async function handlePublishNow() {
    const initial: SlideStatus[] = Array.from({ length: slides.length }, () => 'pending')
    setSlideStatuses(initial)
    setMode('publishing')
    setIsPending(true)

    try {
      for (let i = 0; i < slides.length; i++) {
        setSlideStatuses((prev) => {
          const next = [...prev]
          next[i] = 'publishing'
          return next
        })
        await new Promise((r) => setTimeout(r, 300 + i * 150))
      }

      const result = await onPublishNow(slides, content)

      if (result.ok) {
        setSlideStatuses(Array.from({ length: slides.length }, () => 'done'))
        setMode('done')
        setTimeout(onSuccess, 1200)
      } else {
        setSlideStatuses(Array.from({ length: slides.length }, () => 'failed'))
        setErrorMessage(result.error ?? 'Erro ao publicar.')
        setMode('error')
      }
    } finally {
      setIsPending(false)
    }
  }

  async function handleSchedule() {
    if (!scheduledAt) return
    setIsPending(true)
    try {
      const result = await onSchedule(slides, scheduledAt, content)
      if (result.ok) {
        setMode('done')
        setTimeout(onSuccess, 1200)
      } else {
        setErrorMessage(result.error ?? 'Erro ao agendar.')
        setMode('error')
      }
    } finally {
      setIsPending(false)
    }
  }

  async function handleSaveDraft() {
    setIsPending(true)
    try {
      const result = await onSaveDraft(slides, content)
      if (result.ok) {
        setMode('done')
        setTimeout(onSuccess, 1200)
      } else {
        setErrorMessage(result.error ?? 'Erro ao salvar.')
        setMode('error')
      }
    } finally {
      setIsPending(false)
    }
  }

  const isPublishing = mode === 'publishing'
  const isDone = mode === 'done'
  const isError = mode === 'error'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Publicar Story"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
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

        {isDone ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12l6 6L20 6" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-medium text-neutral-200">Operação concluída!</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
              <p className="text-sm font-medium text-red-400">Erro</p>
              {errorMessage && <p className="mt-1 text-xs text-red-300">{errorMessage}</p>}
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
            <div className="flex flex-wrap gap-2" role="list" aria-label="Progresso por slide">
              {slideStatuses.map((status, i) => {
                const colors: Record<SlideStatus, string> = {
                  pending:    'bg-neutral-700 border-neutral-600 text-neutral-400',
                  publishing: 'bg-blue-500/20 border-blue-500 text-blue-300 animate-pulse',
                  done:       'bg-green-500/20 border-green-500 text-green-400',
                  failed:     'bg-red-500/20 border-red-500 text-red-400',
                }
                return (
                  <div
                    key={i}
                    role="listitem"
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
                  <span className="block text-xs text-amber-400 mt-0.5">não nativo Instagram</span>
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
                <span className="block text-xs text-neutral-500 mt-0.5">Salva para publicar depois</span>
              </span>
            </button>

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
