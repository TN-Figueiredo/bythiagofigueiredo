'use client'

import { Download } from 'lucide-react'

type RangeId = '7d' | '30d' | '90d' | '1y'

const RANGE_OPTIONS: Array<{ id: RangeId; label: string }> = [
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: '90d', label: '90 dias' },
  { id: '1y', label: '1 ano' },
]

const RANGE_DAYS: Record<RangeId, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }

interface RangeTabsProps {
  value: RangeId
  onChange: (id: RangeId) => void
  onExport?: () => void
  exporting?: boolean
}

function formatDateRange(rangeId: RangeId): string {
  const days = RANGE_DAYS[rangeId]
  const end = new Date()
  const start = new Date(end.getTime() - days * 86_400_000)
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
  return `${fmt(start)} → ${fmt(end)}`
}

export function RangeTabs({ value, onChange, onExport, exporting }: RangeTabsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      {/* Left: period label */}
      <span style={{ fontSize: '12.5px', color: 'var(--ink-dim)' }}>
        Comparando com período anterior · <span className="mono">{formatDateRange(value)}</span>
      </span>

      {/* Right: range tabs + CSV */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div
          role="radiogroup"
          aria-label="Periodo de analise"
          style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 9, padding: 3, gap: 2 }}
        >
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={value === o.id}
              onClick={() => onChange(o.id)}
              style={{
                padding: '6px 13px',
                borderRadius: 7,
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 600,
                background: value === o.id ? 'var(--accent)' : 'transparent',
                color: value === o.id ? 'var(--pb-ink-on-accent, #1A140C)' : 'var(--ink-dim)',
                cursor: 'pointer',
                transition: '0.15s',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        {onExport && (
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '6px 11px', fontSize: '12.5px', fontWeight: 600,
              borderRadius: 9, border: '1px solid var(--line-strong)',
              background: 'transparent', color: 'var(--ink-dim)',
              letterSpacing: '-0.01em', whiteSpace: 'nowrap', transition: '0.15s',
              cursor: 'pointer', opacity: exporting ? 0.5 : 1,
            }}
          >
            <Download size={14} strokeWidth={1.7} />
            CSV
          </button>
        )}
      </div>
    </div>
  )
}
