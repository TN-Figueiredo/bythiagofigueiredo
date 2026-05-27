'use client'

interface VideoStatsCardProps {
  viewCount: number
  retentionCurve: number[]
  trafficSources: { browse: number; search: number; suggested: number; other: number }
}

export function VideoStatsCard({ viewCount, retentionCurve, trafficSources }: VideoStatsCardProps) {
  const totalTraffic = trafficSources.browse + trafficSources.search + trafficSources.suggested + trafficSources.other

  return (
    <div className="space-y-3 rounded-md border border-cms-border p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-cms-text-muted">Views</span>
        <span className="font-medium text-cms-text">{viewCount.toLocaleString('pt-BR')}</span>
      </div>

      {retentionCurve.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] text-cms-text-muted">Retenção</div>
          <div className="flex h-8 items-end gap-px">
            {retentionCurve.map((val, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-indigo-500/60"
                style={{ height: `${val}%` }}
              />
            ))}
          </div>
        </div>
      )}

      {totalTraffic > 0 && (
        <div className="text-[10px] text-cms-text-muted">
          <div>Browse: {trafficSources.browse}% | Search: {trafficSources.search}%</div>
          <div>Suggested: {trafficSources.suggested}% | Other: {trafficSources.other}%</div>
        </div>
      )}
    </div>
  )
}
