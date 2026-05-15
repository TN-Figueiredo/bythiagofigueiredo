'use client'

import type { SectionStatus } from '@/lib/posts/types'

interface SectionBarProps {
  label: string
  status: SectionStatus
  statusText?: string
  isDirty: boolean
  isSaving: boolean
  onSave: () => void
}

const STATUS_COLORS: Record<SectionStatus, { bg: string; text: string }> = {
  done: { bg: 'rgba(34,197,94,0.1)', text: '#22c55e' },
  warn: { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b' },
  empty: { bg: 'rgba(139,148,158,0.1)', text: '#8b949e' },
}

export function SectionBar({ label, status, statusText, isDirty, isSaving, onSave }: SectionBarProps) {
  const colors = STATUS_COLORS[status]
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 rounded-lg"
      style={{ background: 'var(--gem-surface, #0d1118)', border: '1px solid var(--gem-border, #1a2030)' }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ background: 'rgba(20,184,166,0.1)', color: '#14b8a6' }}
        >
          {label}
        </span>
        {statusText && (
          <span
            className="text-[10px] px-2 py-0.5 rounded"
            style={{ background: colors.bg, color: colors.text }}
          >
            {statusText}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {isDirty && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#f59e0b' }} />
            <span className="text-[10px]" style={{ color: '#f59e0b' }}>Alterações não salvas</span>
          </div>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || !isDirty}
          className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-md transition-all"
          style={{
            border: isDirty ? '1px solid var(--gem-accent, #818cf8)' : '1px solid var(--gem-border, #1a2030)',
            color: isDirty ? 'var(--gem-accent, #818cf8)' : 'var(--gem-dim, #3d4654)',
            opacity: isSaving ? 0.6 : 1,
            cursor: isSaving || !isDirty ? 'default' : 'pointer',
          }}
        >
          {isSaving ? 'Salvando...' : 'Salvar'}
          {!isSaving && (
            <kbd
              className="text-[9px] px-1 py-0.5 rounded"
              style={{ background: 'var(--gem-well, #0f1620)', color: 'var(--gem-dim, #3d4654)' }}
            >
              {isMac ? '⌘S' : 'Ctrl+S'}
            </kbd>
          )}
        </button>
      </div>
    </div>
  )
}
