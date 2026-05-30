'use client'

import type { DestId } from '@/lib/social/destinations'
import { DESTINATIONS } from '@/lib/social/destinations'

interface DestCardProps {
  destId: DestId
  isOn: boolean
  isFocused: boolean
  onToggle: (destId: DestId) => void
  onFocus: (destId: DestId) => void
}

export function DestCard({ destId, isOn, isFocused, onToggle, onFocus }: DestCardProps) {
  const dest = DESTINATIONS[destId]

  return (
    <div
      role="option"
      aria-selected={isFocused}
      tabIndex={0}
      onClick={() => onFocus(destId)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocus(destId) } }}
      className={`relative flex flex-col gap-2 rounded-xl border-2 p-3 text-left transition-all cursor-pointer ${
        isFocused
          ? 'border-current shadow-sm'
          : 'border-cms-border'
      } ${!isOn ? 'opacity-[0.62]' : ''}`}
      style={{ color: isFocused ? dest.tint : undefined }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: dest.tint }}
          >
            {dest.sublabel.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-cms-text">{dest.label}</p>
            <p className="text-xs text-cms-text-muted">{dest.sublabel}</p>
          </div>
        </div>

        <input
          type="checkbox"
          checked={isOn}
          onChange={(e) => {
            e.stopPropagation()
            onToggle(destId)
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-cms-border accent-current"
          aria-label={`${isOn ? 'Desativar' : 'Ativar'} ${dest.label} ${dest.sublabel}`}
        />
      </div>

      {dest.badge && (
        <span className={`self-start rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
          dest.badge === 'default' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
        }`}>
          {dest.badge === 'default' ? 'padrao' : 'raro'}
        </span>
      )}

      <p className="text-xs leading-relaxed text-cms-text-dim">{dest.truth}</p>
    </div>
  )
}
