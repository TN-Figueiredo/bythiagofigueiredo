'use client'

import type { SaveState } from './use-autosave'

interface AutosaveIndicatorProps {
  state: SaveState
  lastSavedAt: Date | null
  onRetry?: () => void
}

const STATE_CONFIG: Record<SaveState, { dotClass: string; textColor: string; label: string }> = {
  saving: { dotClass: 'bg-[#eab308] animate-pulse', textColor: 'text-[#eab308]', label: 'Saving...' },
  saved: { dotClass: 'bg-[#22c55e]', textColor: 'text-[#4b5563]', label: 'Saved' },
  unsaved: { dotClass: 'bg-[#6b7280]', textColor: 'text-[#6b7280]', label: 'Unsaved' },
  error: { dotClass: 'bg-[#ef4444]', textColor: 'text-[#ef4444]', label: 'Save failed' },
  offline: { dotClass: 'bg-[#f97316]', textColor: 'text-[#f97316]', label: 'Offline — saved locally' },
}

export function AutosaveIndicator({ state, lastSavedAt, onRetry }: AutosaveIndicatorProps) {
  const config = STATE_CONFIG[state]
  return (
    <div className={`flex items-center gap-1.5 text-[10px] ${config.textColor}`}>
      <span className={`h-[5px] w-[5px] rounded-full ${config.dotClass}`} />
      {state === 'error' && onRetry ? (
        <button type="button" onClick={onRetry} className="underline decoration-dotted hover:decoration-solid">
          Save failed — retry
        </button>
      ) : (
        <span>
          {config.label}
          {state === 'saved' && lastSavedAt && (
            <> {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
          )}
        </span>
      )}
    </div>
  )
}
