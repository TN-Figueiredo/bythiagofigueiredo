'use client'

import { useState } from 'react'
import type { CardComposition } from '@tn-figueiredo/links/qr'

interface StoryPreviewProps {
  slides: CardComposition[]
  shortUrl?: string
  caption?: string
  rateBudget?: { remaining: number }
}

const BUDGET_TOTAL = 100

export function StoryPreview({ slides, shortUrl, caption, rateBudget }: StoryPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const total = slides.length
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < total - 1

  function goPrev() {
    if (hasPrev) setCurrentIndex((i) => i - 1)
  }

  function goNext() {
    if (hasNext) setCurrentIndex((i) => i + 1)
  }

  const budgetRemaining = rateBudget?.remaining ?? BUDGET_TOTAL
  const budgetColor = budgetRemaining <= 10 ? 'text-red-400' : 'text-green-400'
  const budgetBarColor = budgetRemaining <= 10 ? 'bg-red-500' : 'bg-green-500'
  const budgetPercent = Math.round((budgetRemaining / BUDGET_TOTAL) * 100)

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      {/* Phone frame */}
      <div
        className="mx-auto shrink-0 rounded-[2rem] border-4 border-neutral-700 bg-neutral-900 shadow-2xl"
        style={{ width: 280 }}
        aria-label="Pré-visualização da Story"
      >
        {/* Slide indicator dots */}
        <div className="flex items-center gap-1 px-3 pt-3 pb-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIndex(i)}
              aria-label={`Slide ${i + 1}`}
              className={[
                'flex-1 h-1 rounded-full transition-all duration-200',
                i === currentIndex
                  ? 'bg-white'
                  : 'bg-white/30 hover:bg-white/50',
              ].join(' ')}
            />
          ))}
        </div>

        {/* Content area — 9:16 aspect ratio */}
        <div
          className="relative mx-2 overflow-hidden rounded-xl bg-neutral-800"
          style={{ aspectRatio: '9 / 16' }}
        >
          {slides[currentIndex] ? (
            <div className="flex h-full items-center justify-center">
              {/* Slide thumbnail placeholder — actual canvas rendering happens in editor */}
              <div className="flex flex-col items-center gap-2 px-4 text-center">
                <div className="rounded-full bg-neutral-700 p-3">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    className="text-neutral-400"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M3 9h18M9 21V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-neutral-300">
                  Slide {currentIndex + 1}
                </p>
                {(slides[currentIndex] as { background?: { type?: string; color?: string } })?.background?.color && (
                  <div
                    className="h-8 w-8 rounded-md border border-neutral-600"
                    style={{
                      background: (slides[currentIndex] as { background?: { type?: string; color?: string } }).background?.type === 'solid'
                        ? (slides[currentIndex] as { background?: { color?: string } }).background?.color
                        : undefined,
                    }}
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-neutral-500">Sem conteúdo</p>
            </div>
          )}

          {/* Navigation arrows — overlay */}
          {hasPrev && (
            <button
              type="button"
              onClick={goPrev}
              aria-label="Slide anterior"
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={goNext}
              aria-label="Próximo slide"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Slide counter */}
        <p className="py-2 text-center text-[11px] text-neutral-500 tabular-nums">
          Slide {currentIndex + 1} de {total}
        </p>
      </div>

      {/* Info panel */}
      <div className="flex flex-1 flex-col gap-4 min-w-0">
        {/* Caption */}
        {caption && (
          <section aria-label="Legenda">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Legenda
            </p>
            <p className="text-sm leading-relaxed text-neutral-300 break-words whitespace-pre-wrap">
              {caption}
            </p>
          </section>
        )}

        {/* Short URL */}
        {shortUrl && (
          <section aria-label="URL curta">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              URL Curta
            </p>
            <a
              href={shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-sm text-blue-400 hover:underline"
            >
              {shortUrl}
            </a>
          </section>
        )}

        {/* API budget */}
        <section aria-label="Cota de API">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Cota de API Instagram
          </p>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-700">
              <div
                className={`h-full rounded-full transition-all duration-500 ${budgetBarColor}`}
                style={{ width: `${budgetPercent}%` }}
                role="progressbar"
                aria-valuenow={budgetRemaining}
                aria-valuemin={0}
                aria-valuemax={BUDGET_TOTAL}
              />
            </div>
            <span className={`text-xs font-semibold tabular-nums ${budgetColor}`}>
              {budgetRemaining}/{BUDGET_TOTAL}
            </span>
          </div>
          {budgetRemaining <= 10 && (
            <p className="mt-1 text-[11px] text-red-400">
              Atenção: cota de API quase esgotada.
            </p>
          )}
        </section>

        {/* Slide count summary */}
        <section aria-label="Resumo de slides">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Slides
          </p>
          <p className="text-sm text-neutral-300">
            {total} {total === 1 ? 'slide' : 'slides'} no total
          </p>
        </section>
      </div>
    </div>
  )
}
