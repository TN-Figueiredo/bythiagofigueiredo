interface FunnelStep {
  label: string
  value: number
  percentage: number
  color: string
}

interface DeliveryFunnelProps {
  steps: FunnelStep[]
}

export function DeliveryFunnel({ steps }: DeliveryFunnelProps) {
  const maxValue = steps[0]?.value ?? 1

  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <div key={step.label} className="flex items-center gap-3">
          <span className="text-[11px] text-cms-text-muted w-20 text-right shrink-0">{step.label}</span>
          <div className="flex-1 h-7 bg-cms-bg rounded overflow-hidden">
            <div
              className="h-full rounded flex items-center px-2 text-[10px] font-medium text-white transition-all"
              style={{ width: `${(step.value / maxValue) * 100}%`, backgroundColor: step.color, minWidth: '24px' }}
            >
              {step.value.toLocaleString()}
            </div>
          </div>
          <span className="text-[11px] text-cms-text-dim w-12 text-right">{step.percentage}%</span>
        </div>
      ))}
    </div>
  )
}
