'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Template {
  id: string
  name: string
  aspect_ratio: '9:16' | '1:1' | '16:9'
  thumbnail_url: string | null
  is_default: boolean
}

interface TemplateCarouselProps {
  templates: Template[]
  selectedId: string | null
  onSelect: (templateId: string) => void
  isLoading?: boolean
}

// ---------------------------------------------------------------------------
// Aspect ratio to platform compatibility
// ---------------------------------------------------------------------------

export const PLATFORM_ASPECT_RATIOS: Record<string, string[]> = {
  facebook: ['16:9'],
  bluesky: ['16:9'],
  instagram: ['9:16', '1:1'],
  youtube: ['16:9'],
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateCarousel({
  templates,
  selectedId,
  onSelect,
  isLoading = false,
}: TemplateCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    updateScrollButtons()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollButtons, { passive: true })
    const ro = new ResizeObserver(updateScrollButtons)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollButtons)
      ro.disconnect()
    }
  }, [updateScrollButtons, templates])

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    const distance = 200
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    })
  }

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const idx = templates.findIndex((t) => t.id === selectedId)
      if (idx > 0) onSelect(templates[idx - 1]!.id)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      const idx = templates.findIndex((t) => t.id === selectedId)
      if (idx < templates.length - 1) onSelect(templates[idx + 1]!.id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 w-36 shrink-0 animate-pulse rounded-lg bg-cms-border/30"
          />
        ))}
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <p className="py-2 text-center text-xs text-cms-text-muted">
        Nenhum template disponivel para esta plataforma
      </p>
    )
  }

  return (
    <div className="relative" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Left arrow */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll('left')}
          aria-label="Previous templates"
          className="absolute -left-3 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-cms-border bg-cms-surface shadow-md"
        >
          <svg
            className="h-4 w-4 text-cms-text"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto py-1 scrollbar-none"
        role="listbox"
        aria-label="Template selection"
      >
        {templates.map((tmpl) => {
          const isSelected = tmpl.id === selectedId
          return (
            <button
              key={tmpl.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(tmpl.id)}
              className={`group relative shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/30'
                  : 'border-cms-border hover:border-cms-accent/50'
              }`}
            >
              {/* Thumbnail */}
              <div
                className={`flex items-center justify-center bg-cms-bg ${
                  tmpl.aspect_ratio === '9:16'
                    ? 'h-28 w-16'
                    : tmpl.aspect_ratio === '1:1'
                      ? 'h-24 w-24'
                      : 'h-16 w-28'
                }`}
              >
                {tmpl.thumbnail_url ? (
                  <img
                    src={tmpl.thumbnail_url}
                    alt={tmpl.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cms-accent/20 to-cms-accent/5">
                    <span className="text-[9px] font-medium text-cms-text-muted">
                      {tmpl.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Name label */}
              <div className="px-1.5 py-1">
                <p className="truncate text-[10px] font-medium text-cms-text">
                  {tmpl.name}
                </p>
              </div>

              {/* Default star */}
              {tmpl.is_default && (
                <span className="absolute right-1 top-1 text-[10px] text-amber-400">
                  ★
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Right arrow */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll('right')}
          aria-label="Next templates"
          className="absolute -right-3 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-cms-border bg-cms-surface shadow-md"
        >
          <svg
            className="h-4 w-4 text-cms-text"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}
    </div>
  )
}
