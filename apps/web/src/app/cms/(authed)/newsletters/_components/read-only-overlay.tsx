'use client'

interface ReadOnlyOverlayProps {
  status: string
}

const STATUS_MESSAGES: Record<string, string> = {
  sending: 'This edition is currently being sent and cannot be edited.',
  sent: 'This edition has been sent. Create a duplicate to make changes.',
  failed: 'This edition failed to send. Revert to draft to edit.',
  cancelled: 'This edition was cancelled. Revert to draft to edit.',
}

export function ReadOnlyOverlay({ status }: ReadOnlyOverlayProps) {
  const message = STATUS_MESSAGES[status]
  if (!message) return null

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-white/80 backdrop-blur-[1px] pt-20">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-6 py-4 shadow-sm max-w-md text-center">
        <p className="text-sm font-medium text-amber-800">{message}</p>
      </div>
    </div>
  )
}
