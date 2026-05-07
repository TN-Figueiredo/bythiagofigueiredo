'use client'

import { useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useModalFocusTrap } from './use-modal-focus-trap'

interface PublishSaveDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function PublishSaveDialog({ open, onConfirm, onCancel }: PublishSaveDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalFocusTrap(dialogRef, open, onCancel)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div ref={dialogRef} role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-[#111827] border border-[#374151] p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-full bg-amber-500/15 flex items-center justify-center">
            <AlertTriangle size={16} className="text-[#f59e0b]" />
          </div>
          <h3 className="text-base font-semibold text-[#f3f4f6]">Update published post?</h3>
        </div>
        <p className="text-sm text-[#9ca3af] mb-6">
          This post is live. Saving will update the published version immediately.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-[#9ca3af] hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  )
}
