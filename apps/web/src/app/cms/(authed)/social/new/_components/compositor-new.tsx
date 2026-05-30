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
  const [selectedDay, setSelectedDay] = useState(1)
  const [selectedTime, setSelectedTime] = useState('19:00')
  const [hasContent, setHasContent] = useState(false)

  const activeCount = DEST_IDS.filter(id => destsOn[id]).length
  const canPublish = activeCount > 0 && hasContent

  function handleToggle(id: DestId) {
    const wasOn = destsOn[id]
    const next = { ...destsOn, [id]: !wasOn }
    setDestsOn(next)

    if (!wasOn) {
      setFocused(id)
    } else if (focused === id) {
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
      <DestCompositor key={focused} focusedDest={focused} destsOn={destsOn} onContentChange={setHasContent} />

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-20 -mx-[30px] mt-auto border-t border-cms-border" style={{ background: 'rgba(16,14,11,0.92)', backdropFilter: 'blur(12px)' }}>
        {/* Schedule picker (visible when "Agendar" is selected) */}
        {schedMode === 'schedule' && (
          <div className="flex flex-wrap items-start gap-7 border-b border-cms-border px-[30px] py-[14px]">
            <div>
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-cms-text-dim">Dia</div>
              <div className="flex gap-1.5">
                {['Hoje', 'Amanhã', 'Qua 31', 'Qui 1', 'Sex 2'].map((d, i) => (
                  <button key={d} type="button" onClick={() => setSelectedDay(i)} className={`cursor-pointer rounded-lg border px-3 py-[7px] text-[12.5px] font-semibold transition-colors ${selectedDay === i ? 'border-cms-accent bg-cms-accent/10 text-cms-accent' : 'border-cms-border bg-cms-surface text-cms-text-dim hover:border-cms-text/30'}`}>{d}</button>
                ))}
              </div>
            </div>
            <div className="min-w-[240px] flex-1">
              <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-cms-text-dim">
                Horário
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-cms-accent"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>
                <span className="font-normal normal-case tracking-normal text-cms-text-dim/60" style={{ fontFamily: 'Inter, sans-serif' }}>destaque = melhor horário das suas contas</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['08:00', '09:00', '12:30', '13:00', '18:00', '19:00', '20:00'].map((t) => {
                  const isSelected = selectedTime === t
                  const isBest = ['08:00', '09:00', '12:30', '13:00', '18:00', '20:00'].includes(t)
                  return (
                    <button key={t} type="button" onClick={() => setSelectedTime(t)} className={`relative cursor-pointer rounded-lg border px-[11px] py-[7px] font-mono text-xs font-semibold transition-colors ${isSelected ? 'border-cms-accent bg-cms-accent text-[#1a120c]' : isBest ? 'border-[rgba(242,104,60,0.4)] bg-cms-accent/10 text-cms-accent hover:bg-cms-accent/20' : 'border-cms-border bg-cms-surface text-cms-text-dim hover:border-cms-text/30'}`}>
                      {t}
                      {isBest && !isSelected && <span className="absolute -right-1 -top-1 h-[7px] w-[7px] rounded-full bg-cms-accent" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Queue info (visible when "Fila" is selected) */}
        {schedMode === 'queue' && (
          <div className="flex flex-wrap items-center gap-2.5 border-b border-cms-border px-[30px] py-3 text-[12.5px] text-cms-text-dim">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-cms-accent"><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></svg>
            Próximos slots livres da fila:
            <span className="font-mono font-semibold text-cms-text">amanhã 09:00</span>
            <span className="text-cms-text-dim/40">·</span>
            <span className="font-mono font-semibold text-cms-text">amanhã 19:00</span>
            <span className="text-cms-text-dim/40">·</span>
            <span className="font-mono font-semibold text-cms-text">qui 13:00</span>
          </div>
        )}

        {/* Main footer row */}
        <div className="flex items-center gap-4 flex-wrap px-[30px] py-[14px]">
          <div className="inline-flex rounded-[9px] p-[3px] gap-[2px]" style={{ background: 'var(--surface-2, var(--color-cms-surface))' }}>
            {(['now', 'schedule', 'queue'] as const).map(mode => (
              <button key={mode} type="button" onClick={() => setSchedMode(mode)} className={`inline-flex items-center gap-1.5 rounded-[7px] border-none px-[13px] py-1.5 text-[12.5px] font-semibold transition-colors ${schedMode === mode ? 'bg-cms-accent text-[#1a120c]' : 'bg-transparent text-cms-text-dim'}`}>
                {mode === 'now' ? 'Agora' : mode === 'schedule' ? 'Agendar' : 'Fila'}
              </button>
            ))}
          </div>

          <span className="text-xs text-cms-text-dim inline-flex items-center gap-1.5">
            {schedMode === 'now' ? (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-cms-accent"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg> Publica imediatamente nas {activeCount} contas</>
            ) : schedMode === 'schedule' ? (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg> {['Hoje', 'Amanhã', 'Qua 31', 'Qui 1', 'Sex 2'][selectedDay]} · <b className="font-mono text-cms-text">{selectedTime}</b></>
            ) : (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></svg> Entra na fila · próximo slot amanhã 09:00</>
            )}
          </span>

          <div className="ml-auto flex gap-2.5">
            <button type="button" disabled={!hasContent} className="inline-flex items-center gap-[7px] rounded-[9px] border border-cms-border px-[15px] py-[9px] text-[13.5px] font-semibold text-cms-text-dim transition-colors hover:text-cms-text disabled:opacity-40 disabled:pointer-events-none">
              Salvar rascunho
            </button>
            <button type="button" disabled={!canPublish} className="inline-flex items-center gap-[7px] rounded-[9px] border px-[15px] py-[9px] text-[13.5px] font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none" style={{ background: schedMode === 'now' ? 'var(--green, #22c55e)' : 'var(--color-cms-accent, #E8823C)', borderColor: schedMode === 'now' ? 'var(--green, #22c55e)' : 'var(--color-cms-accent, #E8823C)', color: schedMode === 'now' ? 'rgb(12,26,18)' : '#1a120c' }}>
              {schedMode === 'now' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3L3 10l7 3 3 7z" /></svg>}
              {schedMode === 'schedule' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v16H4z" /><path d="M4 9h16" /><path d="M8 3v4" /><path d="M16 3v4" /></svg>}
              {schedMode === 'queue' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v16H4z" /><path d="M4 9h16" /><path d="M8 3v4" /><path d="M16 3v4" /></svg>}
              {schedMode === 'now' ? 'Publicar' : schedMode === 'schedule' ? 'Agendar' : 'Adicionar à fila'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
