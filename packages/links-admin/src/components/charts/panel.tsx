import type { CSSProperties, ReactNode } from 'react'

export interface PanelProps {
  title: string
  icon?: string
  right?: ReactNode
  children: ReactNode
  style?: CSSProperties
}

export function Panel({ title, icon, right, children, style }: PanelProps) {
  return (
    <div
      data-panel
      style={{
        padding: 18,
        borderRadius: 14,
        border: '1px solid var(--line, rgba(255,255,255,0.08))',
        background: 'var(--surface, #161410)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {icon && (
          <span
            data-panel-icon
            style={{ fontSize: 15, color: 'var(--accent, #F2683C)' }}
          >
            {icon.slice(0, 2)}
          </span>
        )}
        <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, color: 'var(--ink, #ECE6DA)' }}>
          {title}
        </span>
        {right}
      </div>
      {children}
    </div>
  )
}
