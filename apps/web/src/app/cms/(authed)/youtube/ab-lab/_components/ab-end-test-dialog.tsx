'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { AbTestWithVariants } from '@/lib/youtube/ab-types'
import { endAbTest } from '../actions'

interface AbEndTestDialogProps {
  test: AbTestWithVariants
  onClose: () => void
}

type EndOption = 'leading' | 'original' | 'archive'

export function AbEndTestDialog({ test, onClose }: AbEndTestDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<EndOption>('leading')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const originalVariant = test.variants.find((v) => v.is_original)
  const nonOriginalVariants = test.variants.filter((v) => !v.is_original)

  const leadingVariant =
    nonOriginalVariants.length > 0 ? nonOriginalVariants[0] : originalVariant

  const confidenceThreshold = test.config.confidence_threshold
  const hasLowConfidence = false

  const confirmLabel =
    selected === 'leading'
      ? 'Apply & End'
      : selected === 'original'
        ? 'Keep Original & End'
        : 'Archive Test'

  function handleConfirm() {
    startTransition(async () => {
      if (selected === 'leading' && leadingVariant && !leadingVariant.is_original) {
        await endAbTest(test.id, leadingVariant.id)
      } else if (selected === 'original' && originalVariant) {
        await endAbTest(test.id, originalVariant.id)
      } else {
        await endAbTest(test.id)
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-cms-text">End Test</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--cms-radius)] text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {hasLowConfidence && (
          <div className="mb-4 rounded-[var(--cms-radius)] border border-amber-600/40 bg-amber-900/20 px-4 py-3">
            <p className="text-xs font-medium text-amber-400">
              Confidence is below the {Math.round(confidenceThreshold * 100)}% threshold. Results may not be statistically significant.
            </p>
          </div>
        )}

        <p className="mb-4 text-xs text-cms-text-muted">Choose how to end this test:</p>

        <div className="space-y-2">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-[var(--cms-radius)] border p-3 transition-colors ${
              selected === 'leading'
                ? 'border-cms-accent bg-cms-accent/10'
                : 'border-cms-border hover:bg-cms-surface-hover'
            }`}
          >
            <input
              type="radio"
              name="end-option"
              value="leading"
              checked={selected === 'leading'}
              onChange={() => setSelected('leading')}
              className="mt-0.5 accent-[var(--cms-accent)]"
            />
            <div className="flex flex-1 items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-cms-text">Apply leading variant</p>
                <p className="text-xs text-cms-text-dim">
                  Set the best-performing thumbnail as permanent
                </p>
              </div>
              {leadingVariant?.blob_url && (
                <img
                  src={leadingVariant.blob_url}
                  alt={leadingVariant.label}
                  width={60}
                  height={34}
                  className="shrink-0 rounded object-cover"
                />
              )}
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-[var(--cms-radius)] border p-3 transition-colors ${
              selected === 'original'
                ? 'border-cms-accent bg-cms-accent/10'
                : 'border-cms-border hover:bg-cms-surface-hover'
            }`}
          >
            <input
              type="radio"
              name="end-option"
              value="original"
              checked={selected === 'original'}
              onChange={() => setSelected('original')}
              className="mt-0.5 accent-[var(--cms-accent)]"
            />
            <div className="flex flex-1 items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-cms-text">Keep original</p>
                <p className="text-xs text-cms-text-dim">Restore the original thumbnail</p>
              </div>
              {originalVariant?.blob_url && (
                <img
                  src={originalVariant.blob_url}
                  alt="original"
                  width={60}
                  height={34}
                  className="shrink-0 rounded object-cover"
                />
              )}
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-[var(--cms-radius)] border p-3 transition-colors ${
              selected === 'archive'
                ? 'border-cms-accent bg-cms-accent/10'
                : 'border-cms-border hover:bg-cms-surface-hover'
            }`}
          >
            <input
              type="radio"
              name="end-option"
              value="archive"
              checked={selected === 'archive'}
              onChange={() => setSelected('archive')}
              className="mt-0.5 accent-[var(--cms-accent)]"
            />
            <div>
              <p className="text-sm font-medium text-cms-text">Archive without applying</p>
              <p className="text-xs text-cms-text-dim">End the test and keep whatever is live now</p>
            </div>
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-[var(--cms-radius)] border border-cms-border bg-transparent px-4 py-2 text-sm font-medium text-cms-text hover:bg-cms-surface-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? 'Ending…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
