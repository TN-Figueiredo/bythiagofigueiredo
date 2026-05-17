import { getSiteContext } from '@/lib/cms/site-context'
import { fetchLinksTabData } from '@/lib/analytics/links-queries'
import { LinksTable } from './links-table'
import { LinksReferrers } from './links-referrers'
import type { PeriodInput } from '../types'

interface Props {
  periodInput: PeriodInput
}

export async function LinksTab({ periodInput }: Props) {
  const { siteId } = await getSiteContext()
  const data = await fetchLinksTabData(siteId, periodInput)

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {data.kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-cms-border bg-cms-surface p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-cms-text-muted">{kpi.label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-cms-text">
              {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Links table */}
      <LinksTable links={data.links} />

      {/* Two column layout: Campaigns + Referrers */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* UTM Campaign Attribution */}
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-cms-text">UTM Campaign Attribution</h3>
          {data.campaigns.length === 0 ? (
            <p className="text-xs text-cms-text-muted">No UTM campaigns tracked in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-cms-border text-left text-cms-text-muted">
                    <th scope="col" className="pb-2 font-medium">Campaign</th>
                    <th scope="col" className="pb-2 font-medium">Medium</th>
                    <th scope="col" className="pb-2 text-right font-medium">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.map((c) => (
                    <tr key={`${c.campaign}-${c.medium}`} className="border-b border-cms-border/50">
                      <td className="py-2 font-medium text-cms-text">{c.campaign}</td>
                      <td className="py-2 text-cms-text-muted">{c.medium}</td>
                      <td className="py-2 text-right tabular-nums font-bold text-cms-text">{c.clicks.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Referrer Domains */}
        <LinksReferrers referrers={data.referrers} />
      </div>
    </div>
  )
}
