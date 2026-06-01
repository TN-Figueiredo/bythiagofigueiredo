'use client'

interface FreshnessDotProps {
  lastUpdated: string | null
  label: string
}

export function FreshnessDot({ lastUpdated, label }: FreshnessDotProps) {
  if (!lastUpdated) return null
  const elapsed = Date.now() - new Date(lastUpdated).getTime()
  const minutes = Math.floor(elapsed / 60_000)
  const hours = Math.floor(elapsed / 3_600_000)

  const color = minutes < 5 ? 'bg-green-400' : hours < 24 ? 'bg-amber-400' : 'bg-cms-text-dim'
  const text = minutes < 60
    ? `${minutes} min atrás`
    : hours < 48
      ? `${hours}h atrás`
      : `${Math.floor(hours / 24)}d atrás`

  return (
    <span className="inline-flex items-center gap-1 text-xs text-cms-text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}: {text}
    </span>
  )
}

/* ─── Per-metric freshness bar ─── */

interface FreshnessMetric {
  label: string
  lastUpdated: string | null
  confirmed?: boolean
}

export function FreshnessBar({ metrics }: { metrics: FreshnessMetric[] }) {
  return (
    <div className="flex items-center gap-2 text-xs text-cms-text-muted">
      {metrics.map((m, i) => (
        <span key={m.label} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-cms-text-dim">|</span>}
          <FreshnessDot lastUpdated={m.lastUpdated} label={m.label} />
          {m.confirmed && <span className="text-cms-text-dim">(confirmado)</span>}
        </span>
      ))}
    </div>
  )
}
