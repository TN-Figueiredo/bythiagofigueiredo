'use client'

import React, { useState, useCallback } from 'react'
import { Copy, Check, CheckCircle2, ChevronLeft, ChevronRight, Download } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlideInfo {
  /** Rendered/exported image URL for download. May be undefined if canvas not yet exported. */
  imageUrl?: string
  /** Index label (1-based) */
  index: number
}

interface ReadyToPostProps {
  postId: string
  title: string
  /** Multi-slide image URLs. Falls back to single imageUrl if provided. */
  slides?: SlideInfo[]
  /** @deprecated Pass slides instead */
  imageUrl?: string
  shortUrl: string
  status: 'publishing' | 'completed' | string
  onMarkAsPosted: (postId: string) => Promise<{ ok: boolean }>
}

// ---------------------------------------------------------------------------
// ReadyToPost
// ---------------------------------------------------------------------------

export function ReadyToPost({
  postId,
  title,
  slides,
  imageUrl,
  shortUrl,
  status,
  onMarkAsPosted,
}: ReadyToPostProps) {
  // Normalise to slides array
  const allSlides: SlideInfo[] = slides && slides.length > 0
    ? slides
    : imageUrl
      ? [{ imageUrl, index: 1 }]
      : []

  const total = allSlides.length
  const [currentIndex, setCurrentIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [marking, setMarking] = useState(false)
  const [marked, setMarked] = useState(status === 'completed')
  const [downloading, setDownloading] = useState(false)

  const activeSlide = allSlides[currentIndex]
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < total - 1

  // Strip protocol for display
  const displayUrl = shortUrl.replace(/^https?:\/\//, '')

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shortUrl)
      setCopied(true)
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: browser doesn't support clipboard
    }
  }, [shortUrl])

  const handleMarkAsPosted = useCallback(async () => {
    setMarking(true)
    try {
      const result = await onMarkAsPosted(postId)
      if (result.ok) {
        setMarked(true)
      }
    } finally {
      setMarking(false)
    }
  }, [postId, onMarkAsPosted])

  /** Download all slides that have a resolved imageUrl */
  const handleDownloadAll = useCallback(async () => {
    const downloadable = allSlides.filter((s) => s.imageUrl)
    if (downloadable.length === 0) return

    setDownloading(true)
    try {
      for (const slide of downloadable) {
        const url = slide.imageUrl!
        // Fetch the image and trigger download via blob URL
        const res = await fetch(url)
        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = `story-slide-${slide.index}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(blobUrl)
        // Small delay between downloads so the browser doesn't block them
        await new Promise((r) => setTimeout(r, 300))
      }
    } catch {
      // Download failed — user can save images manually
    } finally {
      setDownloading(false)
    }
  }, [allSlides])

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center">
      {/* Minimal header */}
      <div className="w-full max-w-md px-4 py-3 flex items-center justify-between">
        <span className="text-[13px] text-neutral-400 font-medium">
          Story Pronta
          {total > 1 && (
            <span className="ml-2 text-neutral-600">· {total} slides</span>
          )}
        </span>
        {marked && (
          <span className="flex items-center gap-1 text-[12px] text-green-400">
            <CheckCircle2 size={14} />Publicado
          </span>
        )}
      </div>

      {/* Story preview with carousel */}
      <div className="w-full max-w-[270px] mx-auto mb-4 relative">
        {activeSlide?.imageUrl ? (
          <img
            src={activeSlide.imageUrl}
            alt={`Slide ${currentIndex + 1} de ${total}`}
            className="w-full rounded-xl shadow-2xl"
            style={{ aspectRatio: '9/16', objectFit: 'cover' }}
          />
        ) : (
          // Placeholder when no image URL available yet
          <div
            className="w-full rounded-xl bg-neutral-800 flex flex-col items-center justify-center gap-2"
            style={{ aspectRatio: '9/16' }}
            aria-label={`Slide ${currentIndex + 1}`}
          >
            <div className="rounded-full bg-neutral-700 p-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-neutral-400">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 9h18M9 21V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-xs text-neutral-500">Slide {currentIndex + 1}</p>
          </div>
        )}

        {/* Left/right navigation arrows */}
        {hasPrev && (
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => i - 1)}
            aria-label="Slide anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm hover:bg-black/70 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => i + 1)}
            aria-label="Próximo slide"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm hover:bg-black/70 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Dot indicators + slide counter */}
      {total > 1 && (
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="flex items-center gap-1.5">
            {allSlides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                aria-label={`Ir para slide ${i + 1}`}
                className={[
                  'rounded-full transition-all duration-200',
                  i === currentIndex
                    ? 'w-4 h-1.5 bg-white'
                    : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/50',
                ].join(' ')}
              />
            ))}
          </div>
          <p className="text-[11px] text-neutral-500 tabular-nums">
            Slide {currentIndex + 1} de {total}
          </p>
        </div>
      )}

      {/* Title */}
      <p className="text-sm text-neutral-300 font-medium text-center px-4 mb-4 max-w-md">
        {title}
      </p>

      {/* Short URL copy section */}
      <div className="w-full max-w-md px-4 mb-6">
        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
          <span className="flex-1 text-sm font-mono text-cyan-400 truncate">{displayUrl}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 text-[12px] text-neutral-300 hover:bg-neutral-700 transition-colors"
            aria-label={copied ? 'Copiado' : 'Copiar URL'}
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="w-full max-w-md px-4 mb-6">
        <ol className="space-y-3">
          {[
            { step: 1, text: 'Baixe as imagens usando o botão abaixo' },
            { step: 2, text: 'Abra o Instagram e crie uma nova Story' },
            { step: 3, text: 'Envie as imagens da galeria (na ordem certa)' },
            { step: 4, text: 'Adicione um Link Sticker e cole a URL curta' },
          ].map(({ step, text }) => (
            <li key={step} className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-neutral-800 text-neutral-400 text-[12px] font-bold flex items-center justify-center">
                {step}
              </span>
              <span className="text-[13px] text-neutral-400 pt-0.5">{text}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Download + Mark as posted buttons */}
      <div className="w-full max-w-md px-4 pb-8 space-y-3">
        {/* Download all images */}
        {allSlides.some((s) => s.imageUrl) && (
          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-800 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 transition-colors border border-neutral-700"
            aria-label="Baixar todas as imagens"
          >
            <Download size={16} />
            {downloading
              ? 'Baixando...'
              : total > 1
                ? `Baixar ${total} Imagens`
                : 'Baixar Imagem'}
          </button>
        )}

        {/* Mark as published */}
        {!marked ? (
          <button
            type="button"
            onClick={handleMarkAsPosted}
            disabled={marking}
            className="w-full py-3 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-50 transition-colors"
            aria-label="Marcar como publicado"
          >
            {marking ? 'Atualizando...' : 'Marquei como Publicado'}
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-900/30 border border-green-800/50">
            <CheckCircle2 size={16} className="text-green-400" />
            <span className="text-sm text-green-400 font-medium">Story marcada como publicada</span>
          </div>
        )}
      </div>
    </div>
  )
}
