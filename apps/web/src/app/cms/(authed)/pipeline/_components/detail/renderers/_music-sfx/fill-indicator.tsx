'use client'

interface FillIndicatorProps {
  filled: number
  total: 3
  status: 'green' | 'amber' | 'red' | 'dim'
}

const STATUS_COLORS: Record<FillIndicatorProps['status'], string> = {
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  dim: '#5a6b7f',
}

export function FillIndicator({ filled, total, status }: FillIndicatorProps) {
  const color = STATUS_COLORS[status]

  return (
    <span
      className="inline-flex items-center gap-1"
      role="img"
      aria-label={`${filled} de ${total} slots preenchidos`}
    >
      <span className="inline-flex gap-[3px]">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full"
            style={i < filled
              ? { background: color }
              : { background: 'rgba(255,255,255,0.08)', border: '1px dashed rgba(59,130,246,0.3)' }
            }
          />
        ))}
      </span>
      <span className="text-[9px] font-medium" style={{ color }}>{filled}/{total}</span>
    </span>
  )
}
