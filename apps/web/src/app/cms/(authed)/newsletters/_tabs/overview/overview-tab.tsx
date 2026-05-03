'use client'

import type { OverviewTabData } from '../../_hub/hub-types'
import type { NewsletterHubStrings } from '../../_i18n/types'
import { KpiStrip } from './kpi-strip'
import { EngagementFunnel } from './engagement-funnel'
import { DeliverabilityPanel } from './deliverability-panel'
import { HealthGauge } from './health-gauge'
import { PublicationPerformance } from './publication-performance'
import { SubscriberGrowthChart } from './subscriber-growth-chart'
import { TopEditions } from './top-editions'
import { ActivityFeed } from '../../_shared/activity-feed'
import { SummaryBar } from '../../_shared/summary-bar'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'

interface OverviewTabProps {
  data: OverviewTabData
  typeFilter?: string | null
  strings?: NewsletterHubStrings
}

export function OverviewTab({ data, typeFilter, strings }: OverviewTabProps) {
  const s = strings

  const filteredPerformance = typeFilter
    ? data.publicationPerformance.filter((p) => p.typeId === typeFilter)
    : data.publicationPerformance

  const filteredTopEditions = typeFilter
    ? data.topEditions.filter((e) => e.typeId === typeFilter)
    : data.topEditions

  return (
    <div className="flex flex-col gap-4">
      <SectionErrorBoundary sectionName="KPI strip">
        <KpiStrip kpis={data.kpis} sparklines={data.sparklines} strings={s} />
      </SectionErrorBoundary>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SectionErrorBoundary sectionName="Health gauge">
          <HealthGauge score={data.healthScore} dimensions={data.healthDimensions} strings={s} />
        </SectionErrorBoundary>
        <SectionErrorBoundary sectionName="Engagement funnel">
          <EngagementFunnel funnel={data.funnel} strings={s} />
        </SectionErrorBoundary>
      </div>

      <SectionErrorBoundary sectionName="Publication performance">
        <PublicationPerformance data={filteredPerformance} strings={s} />
      </SectionErrorBoundary>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SectionErrorBoundary sectionName="Subscriber growth">
          <SubscriberGrowthChart data={data.subscriberGrowth} strings={s} />
        </SectionErrorBoundary>
        <SectionErrorBoundary sectionName="Top editions">
          <TopEditions editions={filteredTopEditions} strings={s} />
        </SectionErrorBoundary>
      </div>

      <SectionErrorBoundary sectionName="Deliverability">
        <DeliverabilityPanel data={data.deliverability} strings={s} />
      </SectionErrorBoundary>

      {data.activityFeed.length > 0 && (
        <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {s?.overview.recentActivity ?? 'Recent Activity'}
          </h3>
          <ActivityFeed events={data.activityFeed} showMoreLabel={s?.common.showMore} />
        </div>
      )}

      <SummaryBar
        stats={`${data.kpis.totalSubscribers.toLocaleString()} ${s?.kpi.totalSubscribers?.toLowerCase() ?? 'subscribers'} · ${data.kpis.editionsSent} ${s?.kpi.editionsSent?.toLowerCase() ?? 'editions sent'} · ${data.kpis.avgOpenRate.toFixed(1)}% ${s?.kpi.avgOpenRate?.toLowerCase() ?? 'avg open rate'}`}
        shortcuts={[
          { key: 'N', label: s?.actions.newEdition ?? 'New' },
          { key: '1-5', label: 'Tab' },
        ]}
      />
    </div>
  )
}
