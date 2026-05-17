interface ProgressItem {
  label: string
  value: number
  color: string
  suffix?: string
}

interface Props {
  items: ProgressItem[]
  showPercentage?: boolean
}

export function ProgressBarList({ items, showPercentage }: Props) {
  const maxValue = Math.max(...items.map(i => i.value), 1)

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-cms-text-muted">{item.label}</span>
            <span className="font-bold tabular-nums text-cms-text">
              {showPercentage ? `${item.value}%` : item.value.toLocaleString()}
              {item.suffix ? ` ${item.suffix}` : ''}
            </span>
          </div>
          <div className="h-[5px] overflow-hidden rounded-full bg-cms-border">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${(item.value / maxValue) * 100}%`,
                background: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
