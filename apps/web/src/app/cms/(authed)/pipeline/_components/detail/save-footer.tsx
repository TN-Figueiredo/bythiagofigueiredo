'use client'

interface SaveFooterProps {
  isDirty: boolean
  rev: number
  updatedAt?: string
}

export function SaveFooter({ isDirty, rev, updatedAt }: SaveFooterProps) {
  return (
    <div
      className="flex justify-between items-center px-4 py-1.5 text-[10px]"
      style={{
        borderTop: isDirty ? '2px solid var(--gem-warn)' : '1px solid var(--gem-border)',
        background: 'rgba(26,29,40,0.6)',
      }}
    >
      <span className="flex items-center gap-1">
        <span
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{
            background: isDirty ? 'var(--gem-warn)' : 'var(--gem-done)',
            animation: isDirty ? 'pulse 1.5s infinite' : 'none',
          }}
        />
        <span style={{ color: isDirty ? 'var(--gem-warn)' : 'var(--gem-done)' }}>
          {isDirty ? 'Alterações não salvas' : 'Salvo'}
        </span>
      </span>
      <span style={{ color: 'var(--gem-dim)' }}>
        rev.{rev}
        {updatedAt && ` · ${new Date(updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
        {isDirty && <span className="ml-1 px-1 rounded" style={{ border: '1px solid var(--gem-border)', fontFamily: 'monospace', fontSize: '8px' }}>⌘S</span>}
      </span>
    </div>
  )
}
