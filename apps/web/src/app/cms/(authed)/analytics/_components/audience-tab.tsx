import { getSiteContext } from '@/lib/cms/site-context'
import { fetchAudienceTabData } from '@/lib/analytics/audience-queries'
import { DonutChart } from './donut-chart'
import { ProgressBarList } from './progress-bar-list'
import { AudienceFunnel } from './audience-funnel'
import type { PeriodInput } from '../types'

interface Props {
  periodInput: PeriodInput
}

const COUNTRY_COLORS = ['#FF8240', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#818cf8', '#fb923c', '#4ade80', '#f472b6']
const DEVICE_COLORS = ['#60a5fa', '#34d399', '#fbbf24']

export async function AudienceTab({ periodInput }: Props) {
  const { siteId } = await getSiteContext()
  const data = await fetchAudienceTabData(siteId, periodInput)

  const countrySegments = data.countries.slice(0, 5).map((c, i) => ({
    label: c.country,
    value: c.percentage,
    color: COUNTRY_COLORS[i % COUNTRY_COLORS.length]!,
  }))

  const deviceSegments = data.devices.map((d, i) => ({
    label: d.device,
    value: d.percentage,
    color: DEVICE_COLORS[i % DEVICE_COLORS.length]!,
  }))

  const sourceItems = data.sources.map((s, i) => ({
    label: s.source,
    value: s.percentage,
    color: COUNTRY_COLORS[i % COUNTRY_COLORS.length]!,
  }))

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Donut charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-cms-text">Countries</h3>
          {countrySegments.length === 0 ? (
            <p className="text-xs text-cms-text-muted">No geographic data available.</p>
          ) : (
            <DonutChart segments={countrySegments} ariaLabel="Audience by country" />
          )}
        </div>
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-cms-text">Devices</h3>
          {deviceSegments.length === 0 ? (
            <p className="text-xs text-cms-text-muted">No device data available.</p>
          ) : (
            <DonutChart segments={deviceSegments} ariaLabel="Audience by device type" />
          )}
        </div>
      </div>

      {/* Traffic Sources */}
      <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-cms-text">Traffic Sources</h3>
        {sourceItems.length === 0 ? (
          <p className="text-xs text-cms-text-muted">No traffic source data available.</p>
        ) : (
          <ProgressBarList items={sourceItems} showPercentage />
        )}
      </div>

      {/* Cross-System Funnel */}
      <AudienceFunnel steps={data.funnel} />
    </div>
  )
}
