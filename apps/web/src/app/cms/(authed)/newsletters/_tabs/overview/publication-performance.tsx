'use client'

import type { OverviewTabData } from '../../_hub/hub-types'
import type { NewsletterHubStrings } from '../../_i18n/types'
import { SparklineSvg } from '../../_shared/sparkline-svg'

interface Props {
  data: OverviewTabData['publicationPerformance']
  strings?: NewsletterHubStrings
}

export function PublicationPerformance({ data, strings }: Props) {
  if (data.length === 0) return null

  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{strings?.overview.publicationPerformance ?? 'Publication Performance'}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-800 text-[9px] font-medium uppercase tracking-wider text-gray-500">
              <th className="pb-2 pr-4">{strings?.overview.type ?? 'Type'}</th>
              <th className="pb-2 pr-4 text-right">{strings?.overview.subs ?? 'Subs'}</th>
              <th className="pb-2 pr-4 text-right">{strings?.overview.sentCount ?? 'Sent'}</th>
              <th className="pb-2 pr-4 text-right">{strings?.overview.openPct ?? 'Open %'}</th>
              <th className="pb-2 pr-4 text-right">{strings?.overview.clickPct ?? 'Click %'}</th>
              <th className="pb-2 text-right">{strings?.overview.trend ?? 'Trend'}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.typeId} className="border-b border-gray-800/50 last:border-0">
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.typeColor }} />
                    <span className="text-[11px] text-gray-300">{row.typeName}</span>
                    {row.paused && <span className="rounded bg-yellow-500/20 px-1 py-0.5 text-[8px] text-yellow-400">{strings?.status.paused ?? 'Paused'}</span>}
                  </div>
                </td>
                <td className="py-2 pr-4 text-right text-[11px] tabular-nums text-gray-300">{row.subscribers.toLocaleString()}</td>
                <td className="py-2 pr-4 text-right text-[11px] tabular-nums text-gray-300">{row.editionsSent}</td>
                <td className="py-2 pr-4 text-right text-[11px] tabular-nums text-gray-300">{row.openRate.toFixed(1)}%</td>
                <td className="py-2 pr-4 text-right text-[11px] tabular-nums text-gray-300">{row.clickRate.toFixed(1)}%</td>
                <td className="py-2 text-right">
                  <SparklineSvg data={row.sparkline} color={row.typeColor} width={48} height={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
