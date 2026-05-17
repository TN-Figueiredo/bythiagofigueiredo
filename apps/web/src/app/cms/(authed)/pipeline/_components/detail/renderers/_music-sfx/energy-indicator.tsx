interface EnergyIndicatorProps {
  level: number
}

const DOT_COLORS = ['#22c55e', '#22c55e', '#eab308', '#f97316', '#ef4444']

export function EnergyIndicator({ level }: EnergyIndicatorProps) {
  const clamped = Math.max(1, Math.min(5, Math.round(level)))
  return (
    <span className="inline-flex items-center gap-[3px]" role="img" aria-label={`Energia ${clamped} de 5`}>
      <span className="text-[8px]" style={{ color: '#f59e0b' }} aria-hidden="true">⚡</span>
      <span className="inline-flex items-center" style={{ letterSpacing: '1px' }}>
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className="inline-block w-[5px] h-[5px] rounded-full"
            style={{
              background: i < clamped ? DOT_COLORS[i] : 'rgba(255,255,255,0.08)',
            }}
          />
        ))}
      </span>
      <span className="text-[8px] font-medium" style={{ color: '#5a6b7f' }}>
        {clamped}/5
      </span>
    </span>
  )
}
