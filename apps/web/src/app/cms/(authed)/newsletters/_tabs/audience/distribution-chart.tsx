'use client'

import type { AudienceTabData } from '../../_hub/hub-types'

interface DistributionChartProps {
  distribution: AudienceTabData['distribution']
}

export function DistributionChart({ distribution }: DistributionChartProps) {
  const maxCount = Math.max(...distribution.map((d) => d.count), 1)

  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Distribution by Type</h3>
      <div className="space-y-2">
        {distribution.map((d) => (
          <div key={d.typeId} className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.typeColor }} />
            <span className="w-24 truncate text-[10px] text-gray-300">{d.typeName}</span>
            <div className="flex-1">
              <div
                className="h-4 rounded transition-all"
                style={{ width: `${(d.count / maxCount) * 100}%`, backgroundColor: d.typeColor, opacity: 0.6 }}
              />
            </div>
            <span className="w-10 text-right text-[10px] tabular-nums text-gray-400">{d.count}</span>
            <span className="w-10 text-right text-[9px] tabular-nums text-gray-600">{d.share.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
