'use client'

import type { AudienceTabData } from '../../_hub/hub-types'
import { HealthStrip } from '../../_shared/health-strip'
import { SubscriberTable } from './subscriber-table'
import { DistributionChart } from './distribution-chart'
import { LgpdConsentPanel } from './lgpd-consent-panel'
import { LocaleDonut } from './locale-donut'
import { ActivityFeed } from '../../_shared/activity-feed'
import { SummaryBar } from '../../_shared/summary-bar'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import { EmptyState } from '../../_shared/empty-state'
import { Users } from 'lucide-react'

interface AudienceTabProps {
  data: AudienceTabData
}

export function AudienceTab({ data }: AudienceTabProps) {
  if (data.subscribers.total === 0) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        heading="No subscribers yet"
        description="Share your newsletter subscription form to start growing your audience."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionErrorBoundary sectionName="Audience metrics">
        <HealthStrip
          metrics={[
            { label: 'Unique Subscribers', value: data.healthStrip.uniqueSubscribers.toLocaleString() },
            { label: 'Subscriptions', value: data.healthStrip.totalSubscriptions.toLocaleString() },
            { label: 'Net Growth (30d)', value: `${data.healthStrip.netGrowth30d > 0 ? '+' : ''}${data.healthStrip.netGrowth30d}`, color: data.healthStrip.netGrowth30d >= 0 ? '#22c55e' : '#ef4444' },
            { label: 'Churn Rate', value: `${data.healthStrip.churnRate.toFixed(1)}%` },
            { label: 'Avg Open Rate', value: `${data.healthStrip.avgOpenRate.toFixed(1)}%` },
            { label: 'LGPD Consent', value: `${data.healthStrip.lgpdConsent.toFixed(0)}%` },
          ]}
        />
      </SectionErrorBoundary>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionErrorBoundary sectionName="Distribution chart">
            <DistributionChart distribution={data.distribution} />
          </SectionErrorBoundary>
        </div>
        <div className="space-y-4">
          <SectionErrorBoundary sectionName="LGPD consent">
            <LgpdConsentPanel consent={data.lgpdConsent} totalSubscribers={data.healthStrip.uniqueSubscribers} />
          </SectionErrorBoundary>
          <SectionErrorBoundary sectionName="Locale distribution">
            <LocaleDonut locale={data.locale} />
          </SectionErrorBoundary>
        </div>
      </div>

      <SectionErrorBoundary sectionName="Subscriber table">
        <SubscriberTable rows={data.subscribers.rows} total={data.subscribers.total} page={data.subscribers.page} />
      </SectionErrorBoundary>

      {data.recentActivity.length > 0 && (
        <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Recent Activity</h3>
          <ActivityFeed events={data.recentActivity} />
        </div>
      )}

      <SummaryBar
        stats={`${data.healthStrip.uniqueSubscribers.toLocaleString()} subscribers · ${data.healthStrip.netGrowth30d > 0 ? '+' : ''}${data.healthStrip.netGrowth30d} net growth · ${data.healthStrip.churnRate.toFixed(1)}% churn`}
        shortcuts={[
          { key: 'E', label: 'Export' },
          { key: 'N', label: 'New' },
        ]}
      />
    </div>
  )
}
