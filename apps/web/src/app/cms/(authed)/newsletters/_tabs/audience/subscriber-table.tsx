'use client'

import type { SubscriberRow } from '../../_hub/hub-types'

interface SubscriberTableProps {
  rows: SubscriberRow[]
  total: number
  page: number
}

const STATUS_COLORS: Record<SubscriberRow['status'], string> = {
  active: 'bg-green-500/20 text-green-400',
  at_risk: 'bg-amber-500/20 text-amber-400',
  bounced: 'bg-red-500/20 text-red-400',
  unsubscribed: 'bg-gray-500/20 text-gray-400',
  anonymized: 'bg-gray-700/20 text-gray-500',
}

export function SubscriberTable({ rows, total, page }: SubscriberTableProps) {
  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-800">
              <th scope="col" className="px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">Subscriber</th>
              <th scope="col" className="px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">Types</th>
              <th scope="col" className="px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">Engagement</th>
              <th scope="col" className="px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 text-[8px] font-bold text-gray-400">
                      {r.initials}
                    </span>
                    <span className="text-[11px] text-gray-300">{r.emailMasked}</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    {r.types.map((t) => (
                      <span key={t.id} className="rounded-full px-1.5 py-0.5 text-[8px] text-white" style={{ backgroundColor: t.color }}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-800">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${r.engagementScore}%` }} />
                    </div>
                    <span className="text-[9px] tabular-nums text-gray-500">{r.engagementScore}</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[8px] font-medium ${STATUS_COLORS[r.status]}`}>
                    {r.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-gray-800 px-4 py-2">
        <span className="text-[9px] text-gray-500">Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} of {total}</span>
      </div>
    </div>
  )
}
