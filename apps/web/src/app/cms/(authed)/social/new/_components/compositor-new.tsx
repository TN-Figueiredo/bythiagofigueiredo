'use client'

import { useState } from 'react'
import type { DestId } from '@/lib/social/destinations'
import { DEST_IDS } from '@/lib/social/destinations'
import { DestinationPicker } from './destination-picker'
import { DestCompositor } from './dest-compositor'

const DEFAULT_ON: Record<DestId, boolean> = {
  ig_story: true,
  yt_community: false,
  fb_page: true,
  ig_feed: false,
}

export function CompositorNew() {
  const [destsOn, setDestsOn] = useState<Record<DestId, boolean>>(DEFAULT_ON)
  const [focused, setFocused] = useState<DestId>('ig_story')
  const [schedMode, setSchedMode] = useState<'now' | 'schedule' | 'queue'>('now')

  const activeCount = DEST_IDS.filter(id => destsOn[id]).length

  function handleToggle(id: DestId) {
    const next = { ...destsOn, [id]: !destsOn[id] }
    setDestsOn(next)
    if (destsOn[id] && focused === id) {
      const nextActive = DEST_IDS.find((d) => d !== id && next[d])
      if (nextActive) setFocused(nextActive)
    }
  }

  return (
    <>
      <DestinationPicker
        initialOn={destsOn}
        onToggle={handleToggle}
        onFocus={setFocused}
        focused={focused}
      />
      <DestCompositor focusedDest={focused} destsOn={destsOn} />

      {/* Sticky footer */}
      <div className="sticky bottom-0 -mx-[30px] border-t border-cms-border" style={{ background: 'rgba(16,14,11,0.92)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-4 flex-wrap px-[30px] py-[14px]">
          {/* Schedule mode */}
          <div className="inline-flex rounded-[9px] p-[3px] gap-[2px]" style={{ background: 'var(--surface-2, var(--color-cms-surface))' }}>
            {(['now', 'schedule', 'queue'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setSchedMode(mode)}
                className={`inline-flex items-center gap-1.5 rounded-[7px] border-none px-[13px] py-1.5 text-[12.5px] font-semibold transition-colors ${
                  schedMode === mode
                    ? 'bg-cms-accent text-[#1a120c]'
                    : 'bg-transparent text-cms-text-dim'
                }`}
              >
                {mode === 'now' ? 'Agora' : mode === 'schedule' ? 'Agendar' : 'Fila'}
              </button>
            ))}
          </div>

          {/* Info */}
          <span className="text-xs text-cms-text-dim inline-flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-cms-accent">
              <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
            </svg>
            {schedMode === 'now'
              ? `Publica imediatamente nas ${activeCount} contas`
              : schedMode === 'schedule'
                ? 'Escolha data e horário'
                : 'Adiciona ao final da fila'}
          </span>

          {/* Actions */}
          <div className="ml-auto flex gap-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-[7px] rounded-[9px] border border-cms-border px-[15px] py-[9px] text-[13.5px] font-semibold text-cms-text-dim transition-colors hover:text-cms-text"
            >
              Salvar rascunho
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-[7px] rounded-[9px] border px-[15px] py-[9px] text-[13.5px] font-semibold transition-colors"
              style={{
                background: schedMode === 'now' ? 'var(--green, #22c55e)' : 'var(--color-cms-accent, #E8823C)',
                borderColor: schedMode === 'now' ? 'var(--green, #22c55e)' : 'var(--color-cms-accent, #E8823C)',
                color: schedMode === 'now' ? 'rgb(12,26,18)' : '#1a120c',
              }}
            >
              {schedMode === 'now' && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 3L3 10l7 3 3 7z" />
                </svg>
              )}
              {schedMode === 'now' ? 'Publicar' : schedMode === 'schedule' ? 'Agendar' : 'Adicionar à fila'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
