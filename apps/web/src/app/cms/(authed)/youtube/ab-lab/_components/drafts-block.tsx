'use client'

import { useState } from 'react'
import { ChevronDown, ArrowRight, Layers } from 'lucide-react'
import type { AbTestDraft } from '@/lib/youtube/ab-types'
import { TYPE_META } from './ab-constants'

export interface DraftsBlockProps {
  drafts: AbTestDraft[]
  onContinue: (id: string) => void
}

export function DraftsBlock({ drafts, onContinue }: DraftsBlockProps) {
  const [open, setOpen] = useState(true)

  if (drafts.length === 0) return null

  return (
    <div className="rounded-[14px] border border-cms-border bg-cms-surface overflow-hidden">
      {/* Header */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-[10px] w-full py-[14px] px-[18px] text-left cursor-pointer focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
      >
        <ChevronDown
          size={16}
          className="text-cms-text-dim transition-transform duration-200"
          style={{ transform: open ? 'none' : 'rotate(-90deg)' }}
          aria-hidden="true"
        />
        <span className="text-[14px] font-semibold text-cms-text">Rascunhos</span>
        <span className="inline-flex items-center px-[9px] py-[3px] rounded-full text-[10.5px] font-semibold tracking-[0.06em] uppercase text-cms-text-dim font-mono" style={{ background: 'var(--cms-surface-3, var(--cms-surface-hover))' }}>
          {drafts.length}
        </span>
      </button>

      {/* Draft rows */}
      {open && drafts.map(draft => (
        <div
          key={draft.id}
          className="flex items-center gap-[14px] border-t border-cms-border py-[12px] px-[14px]"
        >
          {/* Thumbnail */}
          <div className="w-[86px] shrink-0">
            {draft.thumbUrl ? (
              <div className="relative w-full aspect-video rounded-[7px] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.thumbUrl}
                  alt={draft.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className="relative w-full aspect-video rounded-[7px] overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgb(58,47,40), rgb(31,26,22))',
                  boxShadow: 'rgba(0,0,0,0.4) 0px 0px 60px inset',
                }}
              >
                <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.024) 0px, rgba(255,255,255,0.024) 2px, transparent 2px, transparent 9px)' }} />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-semibold text-cms-text whitespace-nowrap overflow-hidden text-ellipsis">
              {draft.name}
            </div>
            <div className="flex items-center gap-[8px] mt-[6px]">
              <span className="inline-flex items-center gap-[5px] px-[7px] py-[2px] rounded-full text-[9.5px] font-semibold tracking-[0.06em] uppercase text-cms-text-dim font-mono" style={{ background: 'var(--cms-surface-3, var(--cms-surface-hover))' }}>
                <Layers size={11} aria-hidden="true" />
                {TYPE_META[draft.type]?.label ?? draft.type}
              </span>
              <span className="text-[11.5px] text-cms-text-dim">
                Parou no passo {draft.step} de 5 · criado {draft.createdAgo}
              </span>
            </div>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={() => onContinue(draft.id)}
            className="inline-flex items-center gap-[7px] justify-center py-[6px] px-[11px] text-[12.5px] font-semibold rounded-[9px] border border-cms-accent whitespace-nowrap transition-[0.15s] tracking-[-0.01em] bg-cms-accent shrink-0 cursor-pointer"
            style={{ color: 'rgb(26, 18, 12)' }}
          >
            Continuar setup
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}
