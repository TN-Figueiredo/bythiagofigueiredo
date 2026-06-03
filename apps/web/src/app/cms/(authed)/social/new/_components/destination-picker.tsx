'use client'

import { useState } from 'react'
import { DESTINATIONS, DEST_IDS, type DestId } from '@/lib/social/destinations'
import { PlatformIcon } from '../../_components/shared/platform-icon'

interface DestinationPickerProps {
  initialOn?: Record<DestId, boolean>
  onToggle?: (id: DestId) => void
  onFocus?: (id: DestId) => void
  focused?: DestId
}

const DEFAULT_ON: Record<DestId, boolean> = {
  ig_story: true,
  yt_community: false,
  fb_page: true,
  ig_feed: false,
  bsky_feed: false,
}

export function DestinationPicker({ initialOn, onToggle, onFocus, focused: controlledFocused }: DestinationPickerProps) {
  const [internalDestsOn, setInternalDestsOn] = useState<Record<DestId, boolean>>(initialOn ?? DEFAULT_ON)
  const [internalFocused, setInternalFocused] = useState<DestId>(controlledFocused ?? 'ig_story')

  // Fully controlled when parent provides onToggle + initialOn
  const isControlled = !!(onToggle && initialOn)
  const destsOn = isControlled ? initialOn : internalDestsOn
  const focused = isControlled && controlledFocused != null ? controlledFocused : internalFocused

  const activeCount = DEST_IDS.filter(id => destsOn[id]).length

  function handleToggle(id: DestId) {
    if (isControlled) {
      onToggle(id)
    } else {
      const wasOn = destsOn[id]
      const next = { ...destsOn, [id]: !wasOn }
      setInternalDestsOn(next)
      onToggle?.(id)

      if (wasOn && focused === id) {
        const nextActive = DEST_IDS.find(d => d !== id && next[d])
        if (nextActive) {
          setInternalFocused(nextActive)
          onFocus?.(nextActive)
        }
      }
    }
  }

  function handleFocus(id: DestId) {
    if (!isControlled) setInternalFocused(id)
    onFocus?.(id)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-[14px]">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-cms-text-dim">
          Onde vai publicar
        </span>
        <span className="text-[11.5px] text-cms-text-dim/60">
          {activeCount} destino{activeCount !== 1 ? 's' : ''} · clique pra editar
        </span>
      </div>

      {/* Cards */}
      <div className="flex gap-[10px] flex-wrap mb-[26px]">
        {DEST_IDS.map(id => {
          const dest = DESTINATIONS[id]
          const isOn = destsOn[id]
          const isFocused = focused === id

          return (
            <div
              key={id}
              onClick={() => {
                if (!isOn) { handleToggle(id) }
                handleFocus(id)
              }}
              className="relative flex-1 cursor-pointer transition-[border-color,opacity] duration-150"
              style={{
                minWidth: 168,
                borderRadius: 12,
                padding: '13px 14px',
                border: isOn && isFocused
                  ? `1.5px solid ${dest.tint}`
                  : isOn
                    ? '1.5px solid var(--line-strong, var(--color-cms-border))'
                    : '1.5px solid var(--line, var(--color-cms-border))',
                background: isOn && isFocused
                  ? `${dest.tint}1a`
                  : isOn
                    ? 'var(--surface-2, var(--color-cms-surface))'
                    : 'var(--surface, var(--color-cms-surface))',
                opacity: isOn ? 1 : 0.62,
              }}
            >
              {/* Row: icon + text + checkbox */}
              <div className="flex items-center gap-[10px]">
                <div
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
                  style={{
                    background: isOn && isFocused ? dest.tint : 'var(--surface-3, rgba(255,255,255,0.06))',
                  }}
                >
                  <PlatformIcon provider={dest.provider} size={18} variant={isOn && isFocused ? 'solid' : 'outline'} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-cms-text">
                    {dest.label}
                    {dest.badge && (
                      <span
                        className="inline-flex items-center rounded-full px-[9px] py-[3px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em]"
                        style={{
                          background: dest.badge === 'default'
                            ? `${dest.tint}22`
                            : 'var(--amber-soft, rgba(245,158,11,0.15))',
                          color: dest.badge === 'default'
                            ? dest.tint
                            : 'var(--amber, #f59e0b)',
                        }}
                      >
                        {dest.badge === 'default' ? 'padrão' : 'raro'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-cms-text-dim">
                    {dest.sublabel} · {dest.width}×{dest.height}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleToggle(id) }}
                  className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px]"
                  style={{
                    border: isOn
                      ? `1.5px solid ${dest.tint}`
                      : '1.5px solid var(--line-strong, var(--color-cms-border))',
                    background: isOn ? dest.tint : 'transparent',
                    color: '#1a120c',
                  }}
                  aria-label={`${isOn ? 'Desativar' : 'Ativar'} ${dest.label} ${dest.sublabel}`}
                >
                  {isOn && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Truth text */}
              <div className="mt-[9px] flex gap-1.5 text-[11px] leading-[1.45] text-cms-text-dim/60">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-px" style={{ color: dest.badge === 'rare' ? 'var(--amber, #f59e0b)' : 'var(--ink-faint, currentColor)' }}>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5" />
                  <path d="M12 8h.01" />
                </svg>
                {dest.truth}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
