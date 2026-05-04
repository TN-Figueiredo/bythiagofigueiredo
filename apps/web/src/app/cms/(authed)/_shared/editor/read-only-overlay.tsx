'use client'

import { Lock } from 'lucide-react'

interface ReadOnlyOverlayProps {
  status: string
}

const STATUS_MESSAGES: Record<string, string> = {
  sending: 'Locked during send — this edition is being delivered.',
  sent: 'Read-only — this edition has been sent.',
  failed: 'This edition failed to send. Use Retry to resend to remaining subscribers.',
  cancelled: 'This edition was cancelled. Revert to draft to edit.',
}

export function ReadOnlyOverlay({ status }: ReadOnlyOverlayProps) {
  const message = STATUS_MESSAGES[status]
  if (!message) return null

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-[#030712]/80 backdrop-blur-[1px] pt-20">
      <div className="rounded-lg border border-[#374151] bg-[#111827] px-6 py-4 shadow-lg max-w-md text-center flex flex-col items-center gap-2">
        <Lock size={20} className="text-[#6b7280]" />
        <p className="text-sm font-medium text-[#9ca3af]">{message}</p>
      </div>
    </div>
  )
}
