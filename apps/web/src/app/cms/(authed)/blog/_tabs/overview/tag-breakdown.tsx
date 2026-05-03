'use client'

import type { OverviewTabData } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'

interface TagBreakdownProps {
  data: OverviewTabData['tagBreakdown']
  strings?: BlogHubStrings
}

export function TagBreakdown({ data, strings }: TagBreakdownProps) {
  const s = strings?.overview
  const sorted = [...data].sort((a, b) => b.count - a.count)
  const maxCount = sorted[0]?.count ?? 1

  if (sorted.length === 0) {
    return (
      <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {s?.tagBreakdown ?? 'Posts by Tag'}
        </h3>
        <p className="text-xs text-gray-600">{strings?.empty.noData ?? 'No data yet'}</p>
      </div>
    )
  }

  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {s?.tagBreakdown ?? 'Posts by Tag'}
      </h3>
      <div className="flex flex-col gap-2.5">
        {sorted.map((row) => {
          const pct = maxCount > 0 ? (row.count / maxCount) * 100 : 0
          const isUntagged = !row.tagId
          const barColor = isUntagged ? '#374151' : row.tagColor
          return (
            <div key={row.tagId ?? 'untagged'} className="flex items-center gap-3">
              <div className="flex w-24 shrink-0 items-center gap-1.5 overflow-hidden">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: barColor }}
                />
                <span className="truncate text-[10px] text-gray-300">
                  {isUntagged ? (s?.untagged ?? 'Untagged') : row.tagName}
                </span>
              </div>
              <div className="flex flex-1 items-center gap-2">
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: barColor }}
                  />
                </div>
                <span className="w-7 shrink-0 text-right text-[10px] tabular-nums font-semibold text-gray-400">
                  {row.count}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
