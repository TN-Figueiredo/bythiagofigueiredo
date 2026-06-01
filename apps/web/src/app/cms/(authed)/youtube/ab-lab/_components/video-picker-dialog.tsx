'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import type { WizardVideo } from './ab-create-wizard'

export interface EligibleVideo {
  id: string
  title: string
  thumbnailUrl: string | null
  durationSeconds: number
  channelHandle: string
  hasActiveTest: boolean
  previousLift: number | null
  sourcePipelineId: string | null
}

interface VideoPickerDialogProps {
  eligibleVideos: EligibleVideo[]
  onSelect: (video: WizardVideo) => void
  onClose: () => void
}

export function VideoPickerDialog({ eligibleVideos, onSelect, onClose }: VideoPickerDialogProps) {
  const [search, setSearch] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)

  // --- Escape key ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // --- Focus trap ---
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    function trap(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    el.addEventListener('keydown', trap)
    first?.focus()
    return () => el.removeEventListener('keydown', trap)
  }, [])

  const filtered = eligibleVideos.filter(
    (v) =>
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      v.channelHandle.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      style={{ backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Selecionar video"
        className="flex flex-col mx-4 animate-ab-fade-up"
        style={{
          width: 'min(900px, 100%)',
          maxHeight: 'calc(100vh - 80px)',
          background: 'var(--cms-surface)',
          border: '1px solid var(--cms-border, #332D25)',
          borderRadius: 18,
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-[16px] py-[20px] px-[24px] shrink-0"
          style={{ borderBottom: '1px solid var(--cms-border, #332D25)' }}
        >
          <div>
            <h2 className="text-[18px] font-bold text-cms-text m-0">Selecionar video</h2>
            <p className="text-[12.5px] text-cms-text-dim mt-[3px] m-0">
              Escolha um video para criar um novo teste A/B.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-cms-text-dim p-[4px] shrink-0"
            style={{ background: 'transparent', border: 'none' }}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-[24px] pt-[16px] pb-[8px] shrink-0">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-cms-text-dim"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Buscar videos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent"
            />
          </div>
        </div>

        {/* Video list */}
        <div className="flex-1 overflow-y-auto px-[24px] pb-[24px] pt-[8px]">
          <div className="space-y-2">
            {filtered.length === 0 && (
              <p className="text-sm text-cms-text-dim py-8 text-center">
                {eligibleVideos.length === 0 ? 'Nenhum video disponivel.' : 'Nenhum video encontrado.'}
              </p>
            )}
            {filtered.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={v.hasActiveTest}
                onClick={() =>
                  onSelect({
                    id: v.id,
                    title: v.title,
                    thumbnailUrl: v.thumbnailUrl,
                    sourcePipelineId: v.sourcePipelineId,
                  })
                }
                className="w-full flex items-center gap-3 p-3 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface hover:bg-cms-surface-hover transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
              >
                <div className="w-24 h-[54px] rounded bg-cms-bg shrink-0 overflow-hidden">
                  {v.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.thumbnailUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-cms-text-dim text-xs">
                      Sem thumb
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-cms-text truncate">{v.title}</p>
                  <p className="text-2xs text-cms-text-muted">{v.channelHandle}</p>
                  {v.hasActiveTest && (
                    <p className="text-2xs text-amber-400 mt-0.5">Teste ativo em andamento</p>
                  )}
                  {v.previousLift != null && (
                    <p className="text-2xs text-cms-text-dim mt-0.5">
                      Lift anterior: {v.previousLift > 0 ? '+' : ''}{v.previousLift.toFixed(1)}%
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end py-[16px] px-[24px] shrink-0"
          style={{ borderTop: '1px solid var(--cms-border, #332D25)', background: 'var(--cms-bg-side)' }}
        >
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center py-[9px] px-[15px] text-[13.5px] font-semibold rounded-[9px] whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text-dim"
            style={{ border: '1px solid var(--cms-border, #332D25)' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
