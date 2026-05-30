'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { AbTestDraft } from '@/lib/youtube/ab-types'

export interface DraftsBlockProps {
  draft: AbTestDraft | null
  onContinue: (id: string) => void
}

export function DraftsBlock({ draft, onContinue }: DraftsBlockProps) {
  const [open, setOpen] = useState(true)

  if (!draft) return null

  return (
    <div className="rounded-lg border border-cms-border bg-cms-bg">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-cms-text-dim">
          Rascunhos
        </span>
        <ChevronDown
          size={14}
          className={`text-cms-text-dim transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="px-4 pb-4 flex items-start gap-3">
          {/* Thumbnail */}
          <div className="w-[86px] h-[48px] rounded overflow-hidden bg-cms-surface-hover shrink-0">
            {draft.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draft.thumbUrl}
                alt={draft.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-cms-text-dim text-2xs">
                Draft
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-cms-text truncate">{draft.name}</p>
            <p className="text-2xs text-cms-text-muted mt-0.5">
              Parou no passo {draft.step} de 5 &middot; {draft.createdAgo}
            </p>
            <button
              type="button"
              onClick={() => onContinue(draft.id)}
              className="mt-2 px-3 py-1 text-2xs font-medium rounded bg-cms-accent text-white hover:bg-cms-accent/90 transition-colors focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
            >
              Continuar configuração
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
