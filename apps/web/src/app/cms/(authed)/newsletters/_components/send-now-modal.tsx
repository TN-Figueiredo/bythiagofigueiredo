'use client'

import { useRef, useEffect } from 'react'

interface SendNowModalProps {
  open: boolean
  subject: string
  recipientCount: number
  senderName: string
  senderEmail: string
  onConfirm: () => void
  onCancel: () => void
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function SendNowModal({ open, subject, recipientCount, senderName, senderEmail, onConfirm, onCancel }: SendNowModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return

    const focusable = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    focusable?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel()
        return
      }
      if (e.key !== 'Tab') return
      const focusableEls = dialog!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      const first = focusableEls[0]
      const last = focusableEls[focusableEls.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-now-modal-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
      >
        <h3 id="send-now-modal-title" className="text-lg font-semibold text-gray-900">Send Now</h3>
        <p className="mt-2 text-sm text-gray-600">This will immediately start sending to all subscribers. This cannot be undone.</p>

        <div className="mt-4 rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subject</span>
            <span className="font-medium text-gray-900 truncate max-w-[200px]">{subject}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Recipients</span>
            <span className="font-medium text-gray-900">{recipientCount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">From</span>
            <span className="font-medium text-gray-900">{senderName} &lt;{senderEmail}&gt;</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            Send to {recipientCount.toLocaleString()} subscribers
          </button>
        </div>
      </div>
    </div>
  )
}
