'use client'

import type { SaveState } from './use-autosave'

const STATE_CONFIG: Record<SaveState, { dot: string; text: string }> = {
  saving: { dot: 'bg-yellow-400 animate-pulse', text: 'Saving...' },
  saved: { dot: 'bg-green-400', text: 'Saved' },
  unsaved: { dot: 'bg-gray-400', text: 'Unsaved changes' },
  error: { dot: 'bg-red-400', text: 'Save failed' },
  offline: { dot: 'bg-orange-400', text: 'Offline — saved locally' },
}

interface AutosaveIndicatorProps {
  state: SaveState
  lastSavedAt: Date | null
}

export function AutosaveIndicator({ state, lastSavedAt }: AutosaveIndicatorProps) {
  const config = STATE_CONFIG[state]
  return (
    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary,#6b7280)]">
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      <span>{config.text}</span>
      {state === 'saved' && lastSavedAt && (
        <span className="text-[var(--text-tertiary,#9ca3af)]">
          {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  )
}
