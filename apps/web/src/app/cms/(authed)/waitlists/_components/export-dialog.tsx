'use client'

import { createPortal } from 'react-dom'
import { useRef, useState } from 'react'
import { useDialogFocus } from './use-dialog-focus'
import type { ExportSignupsOpts } from '../actions'

export interface ExportDialogProps {
  slug: string
  /** Bridged to the exportWaitlistSignups server action by the connected island. */
  onExport: (opts: ExportSignupsOpts) => void
  onClose: () => void
  exporting?: boolean
  /** Inline error from a failed export (dialog stays open). */
  error?: string | null
}

export function ExportDialog({ slug, onExport, onClose, exporting = false, error = null }: ExportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'' | 'pending' | 'suppressed'>('')
  const [excludeSuppressed, setExcludeSuppressed] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useDialogFocus(dialogRef, onClose)

  const invalidRange = from !== '' && to !== '' && from > to

  const submit = () => {
    if (invalidRange) return
    onExport({
      status: status || undefined,
      // A status filter overrides the exclude-suppressed default.
      excludeSuppressed: status ? undefined : excludeSuppressed,
      from: from || undefined,
      to: to || undefined,
    })
  }

  const FIELD =
    'mt-1 w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-2 text-sm text-cms-text outline-none focus:border-cms-accent'

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Export signups"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[var(--cms-radius)] bg-cms-bg p-5 shadow-xl outline-none"
      >
        <h2 className="text-sm font-semibold text-cms-text">Export signups · {slug}</h2>

        <label className="mt-4 block">
          <span className="text-sm text-cms-text">Status</span>
          <select
            data-testid="export-status"
            className={FIELD}
            value={status}
            onChange={(e) => {
              const v = e.target.value
              setStatus(v === 'pending' || v === 'suppressed' ? v : '')
            }}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="suppressed">Suppressed</option>
          </select>
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-cms-text">From</span>
            <input type="date" className={FIELD} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm text-cms-text">To</span>
            <input type="date" className={FIELD} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-cms-text">
          <input
            data-testid="export-exclude-suppressed"
            type="checkbox"
            checked={excludeSuppressed}
            disabled={status !== ''}
            onChange={(e) => setExcludeSuppressed(e.target.checked)}
            className="accent-cms-accent"
          />
          Exclude suppressed rows
        </label>

        {invalidRange && (
          <p role="alert" className="mt-3 text-sm text-[var(--cms-rose,#f43f5e)]">
            The “From” date must be on or before the “To” date.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-[var(--cms-rose,#f43f5e)]">
            {error}
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
            onClick={submit}
            disabled={exporting || invalidRange}
            className="rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover disabled:opacity-60"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
