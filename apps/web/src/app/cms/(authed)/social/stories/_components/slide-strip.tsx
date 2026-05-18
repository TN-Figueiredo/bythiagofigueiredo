'use client'
import { useCallback } from 'react'
import type { CardComposition } from '@tn-figueiredo/links/qr'

// ---------------------------------------------------------------------------
// Pure helper functions (exported for unit tests)
// ---------------------------------------------------------------------------

export const MAX_SLIDES = 10

/** Move a slide from `from` index to `to` index. */
export function reorderSlides(slides: CardComposition[], from: number, to: number): CardComposition[] {
  if (from === to || from < 0 || to < 0 || from >= slides.length || to >= slides.length) {
    return slides
  }
  const result = [...slides]
  const spliced = result.splice(from, 1)
  if (spliced.length === 0 || spliced[0] === undefined) return slides
  result.splice(to, 0, spliced[0])
  return result
}

/** Duplicate slide at `index`, inserting the copy right after. Returns unchanged array if already at MAX_SLIDES. */
export function duplicateSlide(slides: CardComposition[], index: number): CardComposition[] {
  if (slides.length >= MAX_SLIDES) return slides
  const result = [...slides]
  const copy: CardComposition = JSON.parse(JSON.stringify(result[index]))
  result.splice(index + 1, 0, copy)
  return result
}

/** Remove slide at `index`. Returns unchanged array if only one slide remains. */
export function removeSlide(slides: CardComposition[], index: number): CardComposition[] {
  if (slides.length <= 1) return slides
  const result = [...slides]
  result.splice(index, 1)
  return result
}

/** Append a blank 9:16 slide. */
export function addEmptySlide(slides: CardComposition[]): CardComposition[] {
  if (slides.length >= MAX_SLIDES) return slides
  const blank: CardComposition = {
    version: 1,
    canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
    background: { type: 'solid', color: '#0a0a0a' },
    elements: [],
  }
  return [...slides, blank]
}

// ---------------------------------------------------------------------------
// SlideStrip React component
// ---------------------------------------------------------------------------

interface SlideStripProps {
  slides: CardComposition[]
  activeIndex: number
  onSelect: (index: number) => void
  onReorder: (slides: CardComposition[]) => void
  onDuplicate: (index: number) => void
  onRemove: (index: number) => void
  onAdd: () => void
}

export function SlideStrip({
  slides,
  activeIndex,
  onSelect,
  onReorder,
  onDuplicate,
  onRemove,
  onAdd,
}: SlideStripProps) {
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.dataTransfer.setData('text/plain', String(index))
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, toIndex: number) => {
    e.preventDefault()
    const fromIndex = Number(e.dataTransfer.getData('text/plain'))
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      onReorder(reorderSlides(slides, fromIndex, toIndex))
    }
  }, [slides, onReorder])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <div
      className="flex flex-col gap-2 w-[88px] shrink-0 overflow-y-auto py-3 px-2 bg-neutral-950 border-r border-neutral-800"
      role="list"
      aria-label="Story slides"
    >
      {slides.map((slide, index) => (
        <SlideThumb
          key={index}
          slide={slide}
          index={index}
          isActive={index === activeIndex}
          totalSlides={slides.length}
          onSelect={onSelect}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        />
      ))}

      {slides.length < MAX_SLIDES && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center justify-center w-full h-[52px] rounded border border-dashed border-neutral-700 text-neutral-500 hover:border-neutral-500 hover:text-neutral-300 text-xs transition-colors"
          aria-label="Add slide"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single slide thumbnail
// ---------------------------------------------------------------------------

interface SlideThumbProps {
  slide: CardComposition
  index: number
  isActive: boolean
  totalSlides: number
  onSelect: (index: number) => void
  onDuplicate: (index: number) => void
  onRemove: (index: number) => void
  onDragStart: (e: React.DragEvent<HTMLDivElement>, index: number) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>, index: number) => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
}

function SlideThumb({
  slide,
  index,
  isActive,
  totalSlides,
  onSelect,
  onDuplicate,
  onRemove,
  onDragStart,
  onDrop,
  onDragOver,
}: SlideThumbProps) {
  const bg = slide.background
  const thumbBg = bg.type === 'solid' ? bg.color : bg.type === 'gradient' ? bg.stops?.[0]?.color ?? '#0a0a0a' : '#0a0a0a'

  return (
    <div
      className={`relative group rounded border cursor-pointer transition-colors ${isActive ? 'border-blue-500' : 'border-neutral-700 hover:border-neutral-500'}`}
      style={{ width: '68px', height: '120px' }}
      role="listitem"
      draggable
      tabIndex={0}
      aria-label={`Slide ${index + 1}${isActive ? ', selected' : ''}`}
      aria-selected={isActive}
      onClick={() => onSelect(index)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(index) } }}
      onDragStart={e => onDragStart(e, index)}
      onDrop={e => onDrop(e, index)}
      onDragOver={onDragOver}
    >
      {/* Thumbnail preview */}
      <div
        className="w-full h-full rounded overflow-hidden flex items-center justify-center"
        style={{ background: thumbBg }}
      >
        <span className="text-[10px] text-neutral-400 font-medium select-none">{index + 1}</span>
      </div>

      {/* Action buttons — shown on hover/active */}
      <div className="absolute inset-x-0 bottom-0 flex justify-between px-1 pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          className="flex items-center justify-center w-6 h-6 rounded bg-neutral-900/90 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title="Duplicate slide"
          aria-label={`Duplicate slide ${index + 1}`}
          onClick={e => { e.stopPropagation(); onDuplicate(index) }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <rect x="1" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
            <rect x="3" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        </button>
        <button
          type="button"
          className="flex items-center justify-center w-6 h-6 rounded bg-neutral-900/90 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Remove slide"
          aria-label={`Remove slide ${index + 1}`}
          disabled={totalSlides <= 1}
          onClick={e => { e.stopPropagation(); onRemove(index) }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
