'use client'

import type { OverviewTabData } from '../../_hub/hub-types'

interface TopEditionsProps {
  editions: OverviewTabData['topEditions']
}

export function TopEditions({ editions }: TopEditionsProps) {
  if (editions.length === 0) return null

  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Top Editions (30d)</h3>
      <div className="space-y-1">
        {editions.map((e, i) => (
          <div key={e.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-gray-800/50">
            <span className="text-[10px] font-bold tabular-nums text-gray-600">{i + 1}</span>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.typeColor }} />
            <span className="min-w-0 flex-1 truncate text-[11px] text-gray-300">{e.subject}</span>
            <span className="text-[10px] tabular-nums text-gray-500">{e.opens} opens</span>
            <span className="text-[10px] tabular-nums text-gray-500">{e.clicks} clicks</span>
          </div>
        ))}
      </div>
    </div>
  )
}
