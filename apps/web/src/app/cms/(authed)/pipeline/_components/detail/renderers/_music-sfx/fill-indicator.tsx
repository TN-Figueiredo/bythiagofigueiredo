import { RESOLVE_COLORS } from './types'

interface FillIndicatorProps {
  filled: number
  total: number
  status: 'green' | 'amber' | 'red' | 'dim'
}

const STATUS_COLORS: Record<FillIndicatorProps['status'], string> = {
  green: RESOLVE_COLORS.LOCAL.color,
  amber: RESOLVE_COLORS.PENDING_MATCH.color,
  red: '#ef4444',
  dim: '#5a6b7f',
}

export function FillIndicator({ filled, total, status }: FillIndicatorProps) {
  const color = STATUS_COLORS[status]

  return (
    <span
      className="inline-flex items-center gap-1"
      role="img"
      aria-label={`${filled} de ${total} músicas encontradas — status: ${status === 'green' ? 'completo' : status === 'amber' ? 'parcial' : status === 'red' ? 'insuficiente' : 'pendente'}`}
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
      <span className="text-[10px] font-medium" style={{ color }}>{filled}/{total}</span>
    </span>
  )
}
