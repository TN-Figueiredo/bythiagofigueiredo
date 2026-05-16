'use client'

import { useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import type { MediaAsset } from '@/lib/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface MediaLightboxProps {
  asset: MediaAsset | null
  currentIndex: number
  totalCount: number
  onPrev: () => void
  onNext: () => void
  onClose: () => void
  t: MediaGalleryStrings
}

export function MediaLightbox({
  asset,
  currentIndex,
  totalCount,
  onPrev,
  onNext,
  onClose,
  t,
}: MediaLightboxProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const prevRef = useRef<HTMLButtonElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const propsRef = useRef({ onClose, onPrev, onNext, currentIndex, totalCount })
  propsRef.current = { onClose, onPrev, onNext, currentIndex, totalCount }

  useEffect(() => {
    if (!asset) return
    previousFocusRef.current = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => closeBtnRef.current?.focus())
    const handler = (e: KeyboardEvent) => {
      const { onClose: close, onPrev: prev, onNext: next, currentIndex: idx, totalCount: total } = propsRef.current
      if (e.key === 'Escape') { close(); return }
      if (e.key === 'ArrowLeft' && idx > 0) { prev(); return }
      if (e.key === 'ArrowRight' && idx < total - 1) { next(); return }
      if (e.key === 'Tab') {
        const btns = [closeBtnRef.current, prevRef.current, nextRef.current].filter(Boolean) as HTMLElement[]
        if (!btns.length) return
        const i = btns.indexOf(document.activeElement as HTMLElement)
        e.preventDefault()
        if (e.shiftKey) btns[i <= 0 ? btns.length - 1 : i - 1]?.focus()
        else btns[i >= btns.length - 1 ? 0 : i + 1]?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
      previousFocusRef.current?.focus()
    }
  }, [asset])

  if (!asset) return null

  const isSvg = asset.mimeType === 'image/svg+xml'
  const counter = t.lightbox.counter
    .replace('{current}', String(currentIndex + 1))
    .replace('{total}', String(totalCount))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.modal.title}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
      style={{ background: 'repeating-conic-gradient(#1a1a2e 0% 25%, #0e0e1a 0% 50%) 0 0 / 20px 20px' }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div
        className="relative z-10 max-h-[85vh] max-w-[85vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {isSvg ? (
          <img
            src={asset.blobUrl}
            alt={asset.altText ?? ''}
            className="max-h-[85vh] max-w-[85vw] object-contain"
          />
        ) : (
          <Image
            src={asset.blobUrl}
            alt={asset.altText ?? ''}
            width={asset.width ?? 800}
            height={asset.height ?? 600}
            className="max-h-[85vh] max-w-[85vw] object-contain"
            priority
          />
        )}
      </div>

      <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
        <span className="rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur-sm tabular-nums">
          {counter}
        </span>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          className="rounded-full bg-black/50 p-2 text-white backdrop-blur-sm hover:bg-black/70"
          aria-label={t.lightbox.close}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {currentIndex > 0 && (
        <button
          ref={prevRef}
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          className="absolute left-4 z-20 rounded-full bg-black/50 p-3 text-white backdrop-blur-sm hover:bg-black/70"
          aria-label={t.lightbox.previous}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {currentIndex < totalCount - 1 && (
        <button
          ref={nextRef}
          type="button"
          onClick={(e) => { e.stopPropagation(); onNext() }}
          className="absolute right-4 z-20 rounded-full bg-black/50 p-3 text-white backdrop-blur-sm hover:bg-black/70"
          aria-label={t.lightbox.next}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 backdrop-blur-sm">
        <p className="text-xs text-white">
          {asset.filename}
          {asset.width && asset.height && (
            <span className="ml-2 text-white/60">{asset.width} × {asset.height}</span>
          )}
        </p>
      </div>
    </div>
  )
}
