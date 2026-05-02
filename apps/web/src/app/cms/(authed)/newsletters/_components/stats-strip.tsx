'use client'

interface StatsStripProps {
  stats: {
    delivered?: number
    openRate?: number
    clickRate?: number
    bounces?: number
    pending?: number
  }
  variant: 'sent' | 'failed'
}

interface StatItem {
  label: string
  value: string
  color: string
}

export function StatsStrip({ stats, variant }: StatsStripProps) {
  const items: StatItem[] = []

  if (stats.delivered !== undefined) {
    items.push({ label: 'Delivered', value: stats.delivered.toLocaleString(), color: '#f3f4f6' })
  }
  if (variant === 'failed' && stats.pending !== undefined) {
    items.push({ label: 'Pending', value: stats.pending.toLocaleString(), color: '#f87171' })
  }
  if (stats.openRate !== undefined) {
    items.push({ label: 'Open Rate', value: `${stats.openRate}%`, color: '#4ade80' })
  }
  if (stats.clickRate !== undefined) {
    items.push({ label: 'Click Rate', value: `${stats.clickRate}%`, color: '#818cf8' })
  }
  if (stats.bounces !== undefined) {
    items.push({ label: 'Bounces', value: stats.bounces.toLocaleString(), color: '#fbbf24' })
  }

  return (
    <div className="flex items-center gap-6 px-5 py-3 border-b border-[#1f2937] bg-[#030712]">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-[#6b7280]">{item.label}</span>
          <span className="text-sm font-semibold tabular-nums" style={{ color: item.color }}>{item.value}</span>
        </div>
      ))}
    </div>
  )
}
