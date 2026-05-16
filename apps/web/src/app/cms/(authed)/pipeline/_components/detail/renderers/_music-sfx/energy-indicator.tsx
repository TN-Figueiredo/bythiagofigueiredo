interface EnergyIndicatorProps {
  level: number
}

export function EnergyIndicator({ level }: EnergyIndicatorProps) {
  const clamped = Math.max(1, Math.min(5, Math.round(level)))
  return (
    <span className="inline-flex items-center gap-px" title={`Energy ${clamped}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className="inline-block w-[5px] h-[5px] rounded-full"
          style={{
            background: i < clamped ? '#818cf8' : 'rgba(255,255,255,0.1)',
          }}
        />
      ))}
    </span>
  )
}
