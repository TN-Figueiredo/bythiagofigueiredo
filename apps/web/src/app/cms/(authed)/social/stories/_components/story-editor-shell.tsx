'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import type { SocialTemplate } from '@/lib/social/template-schemas'
import type { SocialPostData } from '@/lib/social/story-types'
import { StoryEditor } from './story-editor'
import type { StoryEditorHandle } from './story-editor'
import { PublishDialog } from './publish-dialog'

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
  onVideoUpload: (file: File) => Promise<string>
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
      composition: (t.composition && typeof t.composition === 'object' && 'version' in t.composition)
        ? t.composition as CardComposition
        : undefined,
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
  onVideoUpload,
  onSaveDraft,
  onPublishNow,
  onSchedule,
}: StoryEditorShellProps) {
  const router = useRouter()
  const storyEditorRef = useRef<StoryEditorHandle>(null)
  const [publishSlides, setPublishSlides] = useState<CardComposition[] | null>(null)
  const [caption, setCaption] = useState(initialCaption)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const postData: SocialPostData = {
    title: sourceContentType ? `Story — ${sourceContentType}` : 'Story manual',
    description: caption,
    logoUrl: brand.logoUrl ?? undefined,
  }

  const getLatestSlides = useCallback((): CardComposition[] => {
    return storyEditorRef.current?.getCommittedSlides() ?? initialSlides
  }, [initialSlides])

  // ---------------------------------------------------------------------------
  // Salvar Rascunho (top bar button)
  // ---------------------------------------------------------------------------
  const handleSaveDraftClick = useCallback(async () => {
    const slides = getLatestSlides()
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const result = await onSaveDraft(postId, slides, { caption })
      if (result.ok) {
        setSaveMessage({ type: 'ok', text: 'Rascunho salvo!' })
      } else {
        setSaveMessage({ type: 'error', text: result.error ?? 'Erro ao salvar.' })
      }
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }, [getLatestSlides, onSaveDraft, postId, caption])

  const handlePublishSuccess = useCallback(() => {
    setPublishSlides(null)
    router.push('/cms/social/stories')
  }, [router])

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
            onClick={() => setPublishSlides(getLatestSlides())}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
          >
            Publicar
          </button>
        </div>
      </div>

      {/* StoryEditor — positioned below the floating top bar */}
      <div className="fixed top-[44px] left-0 right-0 bottom-0">
        <StoryEditor
          ref={storyEditorRef}
          initialSlides={initialSlides}
          postData={postData}
          templates={toEditorTemplates(templates)}
          onExport={onExport}
          onSaveTemplate={onSaveTemplate}
          onDeleteTemplate={onDeleteTemplate}
          onImageUpload={onImageUpload}
          onVideoUpload={onVideoUpload}
        />
      </div>

      {/* Publish dialog */}
      {publishSlides && (
        <PublishDialog
          slides={publishSlides}
          caption={caption}
          onClose={() => setPublishSlides(null)}
          onSuccess={handlePublishSuccess}
          onSaveDraft={boundOnSaveDraft}
          onPublishNow={boundOnPublishNow}
          onSchedule={boundOnSchedule}
        />
      )}
    </>
  )
}

