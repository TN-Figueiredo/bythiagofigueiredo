'use client'

import type { OverviewTabData } from '../../_hub/hub-types'
import type { NewsletterHubStrings } from '../../_i18n/types'

interface Props {
  data: OverviewTabData['subscriberGrowth']
  strings?: NewsletterHubStrings
}

export function SubscriberGrowthChart({ data, strings }: Props) {
  if (data.length === 0) return null

  const max = Math.max(...data.map((d) => d.count), 1)
  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{strings?.overview.subscriberGrowth ?? 'Subscriber Growth (30d)'}</h3>
        <span className="text-[10px] tabular-nums text-gray-400">+{total} total</span>
      </div>
      <div className="flex items-end gap-[2px]" style={{ height: 64 }} role="img" aria-label={`Subscriber growth chart: ${total} new subscribers in 30 days`}>
        {data.map((d) => {
          const pct = (d.count / max) * 100
          return (
            <div key={d.date} className="group relative flex-1" style={{ height: '100%' }}>
              <div
                className="absolute bottom-0 w-full rounded-t bg-indigo-500 transition-all group-hover:bg-indigo-400"
                style={{ height: `${Math.max(4, pct)}%` }}
              />
              <div className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 rounded bg-gray-800 px-1.5 py-0.5 text-[8px] tabular-nums text-gray-300 whitespace-nowrap group-hover:block">
                {d.date.slice(5)} · {d.count}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-[8px] text-gray-600">
        <span>{data[0]?.date.slice(5)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  )
}
