'use client'

import type { OverviewTabData } from '../../_hub/hub-types'
import { KpiStrip } from './kpi-strip'
import { EngagementFunnel } from './engagement-funnel'
import { DeliverabilityPanel } from './deliverability-panel'
import { HealthGauge } from './health-gauge'
import { TopEditions } from './top-editions'
import { ActivityFeed } from '../../_shared/activity-feed'
import { SummaryBar } from '../../_shared/summary-bar'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'

interface OverviewTabProps {
  data: OverviewTabData
}

export function OverviewTab({ data }: OverviewTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <SectionErrorBoundary sectionName="KPI strip">
        <KpiStrip kpis={data.kpis} sparklines={data.sparklines} />
      </SectionErrorBoundary>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionErrorBoundary sectionName="Health gauge">
          <HealthGauge score={data.healthScore} dimensions={data.healthDimensions} />
        </SectionErrorBoundary>
        <SectionErrorBoundary sectionName="Engagement funnel">
          <EngagementFunnel funnel={data.funnel} />
        </SectionErrorBoundary>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionErrorBoundary sectionName="Deliverability">
          <DeliverabilityPanel data={data.deliverability} />
        </SectionErrorBoundary>
        <SectionErrorBoundary sectionName="Top editions">
          <TopEditions editions={data.topEditions} />
        </SectionErrorBoundary>
      </div>

      {data.activityFeed.length > 0 && (
        <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Recent Activity</h3>
          <ActivityFeed events={data.activityFeed} />
        </div>
      )}

      <SummaryBar
        stats={`${data.kpis.totalSubscribers.toLocaleString()} subscribers · ${data.kpis.editionsSent} editions sent · ${data.kpis.avgOpenRate.toFixed(1)}% avg open rate`}
        shortcuts={[
          { key: 'N', label: 'New' },
          { key: '1-5', label: 'Tab' },
        ]}
      />
    </div>
  )
}
