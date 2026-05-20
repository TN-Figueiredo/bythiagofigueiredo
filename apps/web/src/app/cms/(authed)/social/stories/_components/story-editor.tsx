'use client'
import { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import { SocialCanvasEditor } from '@/app/cms/(authed)/social/new/_components/canvas-editor'
import type { SocialCanvasEditorRef, SocialCanvasEditorProps } from '@/app/cms/(authed)/social/new/_components/canvas-editor'
import { SlideStrip, addEmptySlide, duplicateSlide, removeSlide, reorderSlides } from './slide-strip'
import { CmsDataTab } from './cms-data-tab'
import type { SocialPostData } from '@/lib/social/story-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StoryEditorTemplates = SocialCanvasEditorProps['templates']

export interface StoryEditorHandle {
  getCommittedSlides(): CardComposition[]
}

interface StoryEditorProps {
  initialSlides: CardComposition[]
  postData: SocialPostData
  templates: StoryEditorTemplates
  onExport: SocialCanvasEditorProps['onExport']
  onSaveTemplate: SocialCanvasEditorProps['onSaveTemplate']
  onDeleteTemplate: SocialCanvasEditorProps['onDeleteTemplate']
  onImageUpload: SocialCanvasEditorProps['onImageUpload']
  onVideoUpload: SocialCanvasEditorProps['onVideoUpload']
  /** Called whenever any slide is updated — useful for autosave */
  onSlidesChange?: (slides: CardComposition[]) => void
}

// ---------------------------------------------------------------------------
// StoryEditor
//
// Orchestrates multi-slide composition:
//   - SlideStrip (left rail) for navigation / reorder / add / remove
//   - SocialCanvasEditor (center) for editing the active slide
//   - CmsDataTab (right sidebar tab) for inserting CMS tokens
//
// Keyboard shortcuts:
//   PageDown / Ctrl+ArrowRight → next slide
//   PageUp  / Ctrl+ArrowLeft  → prev slide
//   Ctrl+Shift+D → duplicate current slide
// ---------------------------------------------------------------------------

export const StoryEditor = forwardRef<StoryEditorHandle, StoryEditorProps>(function StoryEditor({
  initialSlides,
  postData,
  templates,
  onExport,
  onSaveTemplate,
  onDeleteTemplate,
  onImageUpload,
  onVideoUpload,
  onSlidesChange,
}, ref) {
  const [slides, setSlides] = useState<CardComposition[]>(initialSlides)
  const [slideIds, setSlideIds] = useState<string[]>(() => initialSlides.map(() => crypto.randomUUID()))
  const [activeIndex, setActiveIndex] = useState(0)
  const [copiedToClipboard, setCopiedToClipboard] = useState(false)
  const editorRef = useRef<SocialCanvasEditorRef>(null)
  // Track whether CMS data tab is shown in the right sidebar
  const [showCmsTab, setShowCmsTab] = useState(false)

  // Keep a ref to slides so keyboard handler is always up to date
  const slidesRef = useRef(slides)
  slidesRef.current = slides
  const activeIndexRef = useRef(activeIndex)
  activeIndexRef.current = activeIndex

  // Notify parent on slide changes
  useEffect(() => {
    onSlidesChange?.(slides)
  }, [slides, onSlidesChange])

  // ---------------------------------------------------------------------------
  // Flush the live canvas state into the slides array.
  // Single implementation used by both internal navigation and the imperative handle.
  // ---------------------------------------------------------------------------
  const flushActiveSlide = useCallback((): CardComposition[] => {
    const composition = editorRef.current?.getComposition()
    if (!composition) return slidesRef.current
    const updated = [...slidesRef.current]
    updated[activeIndexRef.current] = composition
    setSlides(updated)
    return updated
  }, [])

  useImperativeHandle(ref, () => ({
    getCommittedSlides: flushActiveSlide,
  }), [flushActiveSlide])

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  const goToSlide = useCallback((index: number) => {
    flushActiveSlide()
    setActiveIndex(index)
  }, [flushActiveSlide])

  // ---------------------------------------------------------------------------
  // Slide operations
  // ---------------------------------------------------------------------------
  const handleReorder = useCallback((_reordered: CardComposition[], fromIndex?: number, toIndex?: number) => {
    const committed = flushActiveSlide()
    if (fromIndex !== undefined && toIndex !== undefined) {
      setSlides(reorderSlides(committed, fromIndex, toIndex))
      setSlideIds(prev => {
        const updated = [...prev]
        const spliced = updated.splice(fromIndex, 1)
        if (spliced[0] !== undefined) updated.splice(toIndex, 0, spliced[0])
        return updated
      })
    }
    setActiveIndex(0)
  }, [flushActiveSlide])

  const handleDuplicate = useCallback((index: number) => {
    flushActiveSlide()
    setSlides(prev => {
      const updated = duplicateSlide(prev, index)
      return updated
    })
    setSlideIds(prev => {
      const updated = [...prev]
      updated.splice(index + 1, 0, crypto.randomUUID())
      return updated
    })
    setActiveIndex(index + 1)
  }, [flushActiveSlide])

  const handleRemove = useCallback((index: number) => {
    flushActiveSlide()
    setSlides(prev => {
      if (prev.length <= 1) return prev
      const newSlides = removeSlide(prev, index)
      setActiveIndex(ai => Math.min(ai, Math.max(0, newSlides.length - 1)))
      return newSlides
    })
    setSlideIds(prev => {
      if (prev.length <= 1) return prev
      const updated = [...prev]
      updated.splice(index, 1)
      return updated
    })
  }, [flushActiveSlide])

  const handleAdd = useCallback(() => {
    flushActiveSlide()
    setSlides(prev => {
      const newSlides = addEmptySlide(prev)
      setActiveIndex(newSlides.length - 1)
      return newSlides
    })
    setSlideIds(prev => [...prev, crypto.randomUUID()])
  }, [flushActiveSlide])

  // ---------------------------------------------------------------------------
  // CMS data token insertion — forward to active editor
  // ---------------------------------------------------------------------------
  const handleInsertText = useCallback((text: string) => {
    // Copy to clipboard — the template token system handles the insert
    // natively via the `{{token}}` template placeholders.
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedToClipboard(true)
      setTimeout(() => setCopiedToClipboard(false), 2000)
    }).catch(() => null)
  }, [])

  const handleInsertImage = useCallback((url: string) => {
    editorRef.current?.addImageElement(url)
  }, [])

  const handleSetBackground = useCallback((url: string) => {
    editorRef.current?.setBackground(url)
  }, [])

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
      // Don't intercept keys when focus is inside the canvas editor or Konva stage
      if (target.closest('[data-canvas-editor]') || target.closest('.konvajs-content')) return

      const cmd = e.metaKey || e.ctrlKey
      const idx = activeIndexRef.current
      const slides = slidesRef.current

      // Ctrl+Shift+D → duplicate current slide
      if (cmd && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        handleDuplicate(idx)
        return
      }

      // PageDown → next slide (no modifiers)
      if (!cmd && !e.shiftKey && e.key === 'PageDown') {
        if (idx < slides.length - 1) {
          e.preventDefault()
          goToSlide(idx + 1)
        }
        return
      }

      // PageUp → prev slide (no modifiers)
      if (!cmd && !e.shiftKey && e.key === 'PageUp') {
        if (idx > 0) {
          e.preventDefault()
          goToSlide(idx - 1)
        }
        return
      }

      // Ctrl+ArrowRight → next slide (Ctrl required to avoid conflict with canvas element nudging)
      if (cmd && !e.shiftKey && e.key === 'ArrowRight') {
        if (idx < slides.length - 1) {
          e.preventDefault()
          goToSlide(idx + 1)
        }
        return
      }

      // Ctrl+ArrowLeft → prev slide
      if (cmd && !e.shiftKey && e.key === 'ArrowLeft') {
        if (idx > 0) {
          e.preventDefault()
          goToSlide(idx - 1)
        }
        return
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [goToSlide, handleDuplicate])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const activeComposition = slides[activeIndex]

  return (
    <div className="flex h-full bg-neutral-950">
      {/* Left: slide strip */}
      <SlideStrip
        slides={slides}
        slideIds={slideIds}
        activeIndex={activeIndex}
        onSelect={goToSlide}
        onReorder={handleReorder}
        onDuplicate={handleDuplicate}
        onRemove={handleRemove}
        onAdd={handleAdd}
      />

      {/* Center: canvas editor (takes all remaining space) */}
      <div className="flex-1 min-w-0 relative">
        <SocialCanvasEditor
          key={slideIds[activeIndex]}
          ref={editorRef}
          embedded
          aspectRatio="9:16"
          templates={templates}
          postData={postData}
          onExport={onExport}
          onSaveTemplate={onSaveTemplate}
          onDeleteTemplate={onDeleteTemplate}
          onImageUpload={onImageUpload}
          onVideoUpload={onVideoUpload}
          initialComposition={activeComposition}
          hideAspectRatioSelector
        />
      </div>

      {/* Right: CMS data toggle + tab */}
      <div className="flex flex-col w-[200px] shrink-0 border-l border-neutral-800 bg-neutral-950">
        <button
          type="button"
          onClick={() => setShowCmsTab(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 text-[11px] font-medium border-b border-neutral-800 transition-colors ${
            showCmsTab ? 'text-blue-400 bg-blue-500/10' : 'text-neutral-400 hover:text-neutral-200'
          }`}
          aria-expanded={showCmsTab}
          aria-label="Dados do CMS"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1" />
            <path d="M3 4h6M3 6h4M3 8h5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
          CMS Data
        </button>

        {/* Clipboard feedback */}
        {copiedToClipboard && (
          <div className="mx-2 mt-2 rounded bg-green-900/50 border border-green-700/50 px-2 py-1 text-[10px] text-green-300 text-center">
            Copiado!
          </div>
        )}

        {showCmsTab && (
          <div className="flex-1 overflow-y-auto">
            <CmsDataTab
              postData={postData}
              onInsertText={handleInsertText}
              onInsertImage={handleInsertImage}
              onSetBackground={handleSetBackground}
            />
          </div>
        )}

        {!showCmsTab && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[10px] text-neutral-600 text-center px-2">
              Clique em CMS Data para inserir dados do seu post
            </p>
          </div>
        )}

        {/* Slide counter */}
        <div className="border-t border-neutral-800 px-3 py-2 flex items-center justify-between">
          <span className="text-[10px] text-neutral-500">Slide</span>
          <span className="text-[10px] font-medium text-neutral-300 tabular-nums">
            {activeIndex + 1} / {slides.length}
          </span>
        </div>
      </div>
    </div>
  )
})

// Re-export ref type for consumers
export type { SocialCanvasEditorRef }
