'use client'

import type { Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from './platform-icon'

interface MinimalConnection {
  provider: Provider
  account_name: string | null
}

interface PlatformSelectorProps {
  selected: Provider[]
  onChange: (providers: Provider[]) => void
  connections: MinimalConnection[]
  disabled?: Provider[]
  disabledReason?: Record<string, string>
}

export function PlatformSelector({
  selected,
  onChange,
  connections,
  disabled = [],
  disabledReason = {},
}: PlatformSelectorProps) {
  function toggle(provider: Provider) {
    if (disabled.includes(provider)) return
    if (selected.includes(provider)) {
      onChange(selected.filter(p => p !== provider))
    } else {
      onChange([...selected, provider])
    }
  }

  const providers = [...new Set(connections.map(c => c.provider))]

  return (
    <div className="flex flex-wrap gap-2">
      {providers.map(provider => {
        const isSelected = selected.includes(provider)
        const isDisabled = disabled.includes(provider)
        return (
          <button
            key={provider}
            type="button"
            onClick={() => toggle(provider)}
            disabled={isDisabled}
            title={isDisabled ? disabledReason[provider] : undefined}
            aria-label={`Toggle ${platformLabel(provider)}`}
            aria-pressed={isSelected}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors
              ${isSelected ? 'bg-cms-accent/15 text-cms-accent ring-1 ring-cms-accent/30' : 'bg-cms-surface text-cms-text-muted hover:bg-cms-surface-hover'}
              ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <PlatformIcon provider={provider} size="sm" />
            {platformLabel(provider)}
          </button>
        )
      })}
    </div>
  )
}
