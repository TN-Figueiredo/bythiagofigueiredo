interface KpiCardProps {
  label: string
  value: string
  trend?: { direction: 'up' | 'down'; pct: number }
}

export function KpiCard({ label, value, trend }: KpiCardProps) {
  return (
    <div aria-label={`${label}: ${value}`} className="rounded-lg border border-cms-border bg-cms-surface p-4">
      <p className="text-xs font-medium text-cms-text-muted">{label}</p>
      <div className="mt-1 flex items-end gap-2">
        <span className="text-2xl font-bold text-cms-text">{value}</span>
        {trend && (
          <span className={`text-xs font-medium ${trend.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>
            {trend.direction === 'up' ? '↑' : '↓'} {trend.pct}%
          </span>
        )}
      </div>
    </div>
  )
}
