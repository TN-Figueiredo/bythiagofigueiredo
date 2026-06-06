'use client'

import { Columns3, ArrowLeftRight, Maximize, Replace, Trash2, MoreHorizontal } from 'lucide-react'
import type { ImageAlignment } from '../types'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface BlogImageToolbarProps {
  alignment: ImageAlignment
  naturalWidth: number | null
  onAlignmentChange: (alignment: ImageAlignment) => void
  onReplace: () => void
  onDelete: () => void
}

/* ------------------------------------------------------------------ */
/*  Width mode config                                                 */
/* ------------------------------------------------------------------ */

const WIDTH_MODES = [
  { key: 'column', label: 'Coluna', icon: Columns3, minWidth: 0 },
  { key: 'wide', label: 'Largo', icon: ArrowLeftRight, minWidth: 900 },
  { key: 'full', label: 'Total', icon: Maximize, minWidth: 1200 },
] as const

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function BlogImageToolbar({
  alignment,
  naturalWidth,
  onAlignmentChange,
  onReplace,
  onDelete,
}: BlogImageToolbarProps) {
  return (
    <div
      data-testid="blog-image-toolbar"
      className="absolute top-2 right-2 flex items-center gap-1 rounded-lg px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100"
      style={{
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Width mode buttons */}
      {WIDTH_MODES.map(({ key, label, icon: Icon, minWidth }) => {
        const disabled = naturalWidth !== null && naturalWidth < minWidth
        const active = alignment === key

        return (
          <button
            key={key}
            type="button"
            data-testid={`img-width-${key}`}
            disabled={disabled}
            title={label}
            onClick={() => onAlignmentChange(key)}
            className="flex items-center justify-center rounded p-1.5 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-30"
            style={{
              background: active ? 'rgba(255,255,255,0.2)' : 'transparent',
            }}
          >
            <Icon size={14} />
          </button>
        )
      })}

      {/* Separator */}
      <div className="mx-0.5 h-4 w-px bg-white/20" />

      {/* Replace */}
      <button
        type="button"
        data-testid="img-replace-btn"
        title="Substituir"
        onClick={onReplace}
        className="flex items-center justify-center rounded p-1.5 text-white transition-colors hover:bg-white/20"
      >
        <Replace size={14} />
      </button>

      {/* Delete */}
      <button
        type="button"
        data-testid="img-delete-btn"
        title="Excluir"
        onClick={onDelete}
        className="flex items-center justify-center rounded p-1.5 text-white transition-colors hover:bg-red-500/60"
      >
        <Trash2 size={14} />
      </button>

      {/* More (placeholder) */}
      <button
        type="button"
        data-testid="img-more-btn"
        title="Mais opções"
        className="flex items-center justify-center rounded p-1.5 text-white transition-colors hover:bg-white/20"
      >
        <MoreHorizontal size={14} />
      </button>
    </div>
  )
}
