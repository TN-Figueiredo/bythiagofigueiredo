'use client'

import { useRef } from 'react'
import { useModalFocusTrap } from '../../_shared/editor/use-modal-focus-trap'

interface SendNowModalProps {
  open: boolean
  subject: string
  recipientCount: number
  senderName: string
  senderEmail: string
  onConfirm: () => void
  onCancel: () => void
}

export function SendNowModal({ open, subject, recipientCount, senderName, senderEmail, onConfirm, onCancel }: SendNowModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useModalFocusTrap(dialogRef, open, onCancel)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-now-modal-title"
        className="w-full max-w-md rounded-xl bg-[#111827] border border-[#374151] p-6 shadow-2xl"
      >
        <h3 id="send-now-modal-title" className="text-lg font-semibold text-[#f3f4f6]">Send Now</h3>
        <p className="mt-2 text-sm text-[#9ca3af]">This will immediately start sending to all subscribers. This cannot be undone.</p>

        <div className="mt-4 rounded-lg bg-[#0a0f1a] border border-[#1f2937] p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#6b7280]">Subject</span>
            <span className="font-medium text-[#d1d5db] truncate max-w-[200px]">{subject}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6b7280]">Recipients</span>
            <span className="font-medium text-[#d1d5db]">{recipientCount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6b7280]">From</span>
            <span className="font-medium text-[#d1d5db]">{senderName} &lt;{senderEmail}&gt;</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium text-[#9ca3af] hover:bg-white/5">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-[#f59e0b] px-4 py-2 text-sm font-medium text-[#111827] hover:bg-[#eab308]"
          >
            Send to {recipientCount.toLocaleString()} subscribers
          </button>
        </div>
      </div>
    </div>
  )
}
