'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'

export interface BroadcastDialogProps {
  slug: string
  /** Live pending-recipient count; 0 disables confirm. */
  recipientCount: number
  /** Bridged to the launchWaitlist action (a stub returning not_implemented until Fase 2). */
  onConfirm: (waitlistSlug: string) => Promise<{ ok: boolean; error?: string }>
  onClose: () => void
}

export function BroadcastDialog({ slug, recipientCount, onConfirm, onClose }: BroadcastDialogProps) {
  const [typed, setTyped] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const canConfirm = recipientCount > 0 && typed.trim() === slug && !pending

  const confirm = async () => {
    if (!canConfirm) return
    setPending(true)
    const res = await onConfirm(slug)
    setPending(false)
    if (!res.ok) {
      setNotice(
        res.error === 'not_implemented'
          ? 'Broadcast delivery ships in the next phase — nothing was sent.'
          : 'Could not start the broadcast.',
      )
    }
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Launch broadcast"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[var(--cms-radius)] bg-cms-bg p-5 shadow-xl"
      >
        <h2 className="text-sm font-semibold text-cms-text">Launch broadcast</h2>
        <p className="mt-1 text-sm text-cms-text-muted">
          This will notify <span className="font-semibold text-cms-text">{recipientCount}</span> pending{' '}
          {recipientCount === 1 ? 'signup' : 'signups'}. This can’t be undone.
        </p>

        <label className="mt-4 block">
          <span className="text-sm text-cms-text">
            Type the slug <span className="font-mono">{slug}</span> to confirm
          </span>
          <input
            data-testid="broadcast-confirm-slug"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={slug}
            className="mt-1 w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-2 font-mono text-sm text-cms-text outline-none focus:border-cms-accent"
          />
        </label>

        {notice && (
          <p role="status" aria-live="polite" className="mt-3 text-sm text-cms-text-muted">
            {notice}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--cms-radius)] px-4 py-2 text-sm text-cms-text-muted hover:bg-cms-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className="rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover disabled:cursor-not-allowed disabled:bg-cms-surface disabled:text-cms-text-muted"
          >
            Send broadcast
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
