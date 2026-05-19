'use client'

import { useState, useCallback, useRef } from 'react'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import type { SocialTemplate } from '@/lib/social/template-schemas'
import type { SourceContentResult } from '@/lib/social/actions/stories'
import { generateSlideCompositions } from '@/lib/social/story-slides'
import { StoryEditorShell } from '../../_components/story-editor-shell'
import { ContentPickerModal } from './content-picker-modal'
import { GenerationOptions } from './generation-options'
import type { SlideCount, TemplateStyle } from './generation-options'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ComposerMode = 'choose' | 'pick-content' | 'options' | 'editor'

interface SiteBrand {
  logoUrl: string | null
  primaryColor: string
  defaultLocale: string
  supportedLocales: string[]
}

interface StoryComposerProps {
  siteId: string
  brand: SiteBrand
  templates: Array<SocialTemplate>
  initialContent?: SourceContentResult | null
  onSearchContent: (siteId: string, type: string, search: string) => Promise<{ ok: boolean; data?: SourceContentResult[]; error?: string }>
  onExport: (blob: Blob, metadata: { format: 'png'; scale: number; width: number; height: number }) => Promise<{ url: string } | null>
  onSaveTemplate: (name: string, composition: CardComposition, thumbnail: Blob) => Promise<void>
  onDeleteTemplate: (id: string) => Promise<void>
  onImageUpload: (file: File) => Promise<string>
  onVideoUpload: (file: File) => Promise<string>
  /** postId is the first arg — the page wrapper closes over siteId; shell injects postId */
  onSaveDraft: (postId: string, slides: unknown[], content?: { caption?: string }) => Promise<{ ok: boolean; error?: string; data?: { id: string } }>
  onPublishNow: (postId: string, slides: unknown[], content?: { caption?: string }) => Promise<{ ok: boolean; error?: string; data?: { id: string } }>
  onSchedule: (postId: string, slides: unknown[], scheduledAt: string, content?: { caption?: string }) => Promise<{ ok: boolean; error?: string; data?: { id: string } }>
}

// ---------------------------------------------------------------------------
// StoryComposer
// ---------------------------------------------------------------------------

export function StoryComposer({
  siteId,
  brand,
  templates,
  initialContent,
  onSearchContent,
  onExport,
  onSaveTemplate,
  onDeleteTemplate,
  onImageUpload,
  onVideoUpload,
  onSaveDraft,
  onPublishNow,
  onSchedule,
}: StoryComposerProps) {
  const [mode, setMode] = useState<ComposerMode>(initialContent ? 'options' : 'choose')
  const [selectedContent, setSelectedContent] = useState<SourceContentResult | null>(
    initialContent ?? null,
  )
  const [locale, setLocale] = useState(brand.defaultLocale)
  const [slideCount, setSlideCount] = useState<SlideCount>(3)
  const [templateStyle, setTemplateStyle] = useState<TemplateStyle>('gradient')
  const [initialSlides, setInitialSlides] = useState<CardComposition[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  // Stable post ID for this composition session (new story)
  const postIdRef = useRef<string>(crypto.randomUUID())

  // ---------------------------------------------------------------------------
  // Content picker → options
  // ---------------------------------------------------------------------------
  const handleContentSelect = useCallback((item: SourceContentResult) => {
    setSelectedContent(item)
    setMode('options')
  }, [])

  // ---------------------------------------------------------------------------
  // Generate slides and enter editor
  // ---------------------------------------------------------------------------
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    try {
      const title = selectedContent?.title ?? 'Nova Story'
      const slides = generateSlideCompositions({
        title,
        excerpt: selectedContent?.excerpt
          ?? (selectedContent ? `Confira: ${selectedContent.title}` : 'Swipe para ver mais'),
        coverImageUrl: selectedContent?.coverImageUrl ?? null,
        logoUrl: brand.logoUrl,
        primaryColor: brand.primaryColor,
        slideCount,
        style: templateStyle,
        locale,
      })
      setInitialSlides(slides)
      setMode('editor')
    } finally {
      setIsGenerating(false)
    }
  }, [selectedContent, brand.logoUrl, brand.primaryColor, slideCount, templateStyle, locale])

  // ---------------------------------------------------------------------------
  // Blank canvas — go directly to editor with 1 empty slide
  // ---------------------------------------------------------------------------
  const handleBlankCanvas = useCallback(() => {
    const blankSlide: CardComposition = {
      version: 1,
      canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
      background: { type: 'solid', color: '#0a0a0a' },
      elements: [],
    }
    setInitialSlides([blankSlide])
    setSelectedContent(null)
    setMode('editor')
  }, [])

  // ---------------------------------------------------------------------------
  // Render: editor mode — delegates to StoryEditorShell (includes top bar)
  // ---------------------------------------------------------------------------
  if (mode === 'editor') {
    return (
      <StoryEditorShell
        siteId={siteId}
        postId={postIdRef.current}
        initialSlides={initialSlides}
        brand={brand}
        templates={templates}
        sourceContentType={selectedContent?.type ?? null}
        onExport={onExport}
        onSaveTemplate={onSaveTemplate}
        onDeleteTemplate={onDeleteTemplate}
        onImageUpload={onImageUpload}
        onVideoUpload={onVideoUpload}
        onSaveDraft={onSaveDraft}
        onPublishNow={onPublishNow}
        onSchedule={onSchedule}
      />
    )
  }

  // ---------------------------------------------------------------------------
  // Render: choose / pick-content / options modes
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col items-center justify-start min-h-[60vh] pt-16 px-6">
      {/* ── choose ── */}
      {mode === 'choose' && (
        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="text-center mb-2">
            <h2 className="text-lg font-semibold text-neutral-100">Nova Story</h2>
            <p className="text-sm text-neutral-400 mt-1">
              Escolha como criar seus slides
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMode('pick-content')}
            className="flex flex-col items-start gap-1.5 w-full px-5 py-4 rounded-xl border border-neutral-700 bg-neutral-800 hover:border-blue-500 hover:bg-blue-500/5 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="16" height="16" rx="3" stroke="#60a5fa" strokeWidth="1.5"/>
                <path d="M5 6h8M5 9h6M5 12h7" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="text-sm font-semibold text-neutral-100">Do CMS</span>
            </div>
            <p className="text-xs text-neutral-400 pl-[26px]">
              Gere slides automaticamente a partir de um post, newsletter ou campanha
            </p>
          </button>

          <button
            type="button"
            onClick={handleBlankCanvas}
            className="flex flex-col items-start gap-1.5 w-full px-5 py-4 rounded-xl border border-neutral-700 bg-neutral-800 hover:border-neutral-500 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="16" height="16" rx="3" stroke="#a1a1aa" strokeWidth="1.5"/>
                <path d="M9 5v8M5 9h8" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="text-sm font-semibold text-neutral-100">Do Zero</span>
            </div>
            <p className="text-xs text-neutral-400 pl-[26px]">
              Canvas em branco — crie seus slides manualmente
            </p>
          </button>
        </div>
      )}

      {/* ── options ── */}
      {mode === 'options' && (
        <GenerationOptions
          selectedContent={selectedContent}
          defaultLocale={brand.defaultLocale}
          supportedLocales={brand.supportedLocales}
          locale={locale}
          slideCount={slideCount}
          templateStyle={templateStyle}
          isGenerating={isGenerating}
          onLocaleChange={setLocale}
          onSlideCountChange={setSlideCount}
          onTemplateStyleChange={setTemplateStyle}
          onGenerate={handleGenerate}
          onBack={() => setMode(selectedContent ? 'pick-content' : 'choose')}
        />
      )}

      {/* ── content picker modal ── */}
      {mode === 'pick-content' && (
        <>
          {/* Background overlay allows going back by clicking outside */}
          <ContentPickerModal
            siteId={siteId}
            onSelect={handleContentSelect}
            onClose={() => setMode('choose')}
            onSearch={onSearchContent}
          />
        </>
      )}
    </div>
  )
}
