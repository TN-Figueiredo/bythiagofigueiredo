'use client'

import { useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { AbTestWithVariants } from '@/lib/youtube/ab-types'
import { pauseAbTest } from '../actions'

interface AbPauseDialogProps {
  test: AbTestWithVariants
  onClose: () => void
}

export function AbPauseDialog({ test, onClose }: AbPauseDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleConfirm() {
    startTransition(async () => {
      await pauseAbTest(test.id)
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
      <div className="relative w-full max-w-md rounded-lg border border-cms-border bg-cms-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-cms-text">Pause Test</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 text-sm text-cms-text-muted">
          <p>Pausing will restore the original thumbnail immediately.</p>
          <p>The current rotation cycle will be closed. All collected data is preserved.</p>
          <p>You can resume at any time — the test will continue from where it left off.</p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-cms-border bg-transparent px-4 py-2 text-sm font-medium text-cms-text hover:bg-cms-surface-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isPending ? 'Pausing…' : 'Pause Test'}
          </button>
        </div>
      </div>
    </div>
  )
}
