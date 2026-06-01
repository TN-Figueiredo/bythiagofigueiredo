'use client'

interface SaveFooterProps {
  isDirty: boolean
  rev: number
  updatedAt?: string
}

function relativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then
  if (diffMs < 0 || Number.isNaN(diffMs)) return ''

  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'agora'

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `há ${diffMin} min`

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `há ${diffHr} h`

  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function SaveFooter({ isDirty, rev, updatedAt }: SaveFooterProps) {
  const timeLabel = updatedAt ? relativeTime(updatedAt) : ''

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex justify-between items-center px-4 py-1.5 text-[10px]"
      style={{
        borderTop: '1px solid var(--gem-border)',
        background: 'var(--gem-surface, rgba(26,29,40,0.4))',
      }}
    >
      <span className="flex items-center gap-1">
        <span
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{
            background: isDirty ? 'var(--gem-warn)' : 'var(--gem-done)',
          }}
        />
        <span style={{ color: isDirty ? 'var(--gem-warn)' : 'var(--gem-done)' }}>
          {isDirty ? 'Alterações não salvas' : 'Salvo'}
        </span>
      </span>
      <span style={{ color: 'var(--gem-dim)' }}>
        {isDirty
          ? timeLabel
          : timeLabel
            ? `Salvo ${timeLabel}`
            : 'Salvo'}
      </span>
    </div>
  )
}
