'use client'

import type { AudienceTabData } from '../../_hub/hub-types'
import type { NewsletterHubStrings } from '../../_i18n/types'
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
  typeFilter?: string | null
  strings?: NewsletterHubStrings
}

export function AudienceTab({ data, typeFilter, strings }: AudienceTabProps) {
  const filteredRows = typeFilter
    ? data.subscribers.rows.filter((r) => r.types.some((t) => t.id === typeFilter))
    : data.subscribers.rows

  if (data.subscribers.total === 0 && data.healthStrip.uniqueSubscribers === 0) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        heading={strings?.empty.noSubscribers ?? 'No subscribers yet'}
        description={strings?.empty.noSubscribers ?? 'No subscribers yet'}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionErrorBoundary sectionName="Audience metrics">
        <HealthStrip
          metrics={[
            { label: strings?.audience.confirmedSubscribers ?? 'Confirmed', value: data.healthStrip.confirmedSubscribers.toLocaleString() },
            { label: strings?.audience.pendingSubscribers ?? 'Pending Opt-in', value: data.healthStrip.pendingSubscribers.toLocaleString(), color: data.healthStrip.pendingSubscribers > 0 ? '#f59e0b' : undefined },
            { label: strings?.audience.subscriptions ?? 'Subscriptions', value: data.healthStrip.totalSubscriptions.toLocaleString() },
            { label: strings?.audience.netGrowth ?? 'Net Growth (30d)', value: `${data.healthStrip.netGrowth30d > 0 ? '+' : ''}${data.healthStrip.netGrowth30d}`, color: data.healthStrip.netGrowth30d >= 0 ? '#22c55e' : '#ef4444' },
            { label: strings?.audience.churnRate ?? 'Churn Rate', value: `${data.healthStrip.churnRate.toFixed(1)}%` },
            { label: strings?.kpi.avgOpenRate ?? 'Avg Open Rate', value: `${data.healthStrip.avgOpenRate.toFixed(1)}%` },
            { label: strings?.audience.lgpdConsent ?? 'LGPD Consent', value: `${data.healthStrip.lgpdConsent.toFixed(0)}%` },
          ]}
        />
      </SectionErrorBoundary>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="md:col-span-2 lg:col-span-2">
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
        <SubscriberTable rows={filteredRows} total={data.subscribers.total} page={data.subscribers.page} strings={strings} />
      </SectionErrorBoundary>

      {data.recentActivity.length > 0 && (
        <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{strings?.overview.recentActivity ?? 'Recent Activity'}</h3>
          <ActivityFeed events={data.recentActivity} />
        </div>
      )}

      <SummaryBar
        stats={`${data.healthStrip.confirmedSubscribers.toLocaleString()} ${strings?.audience.confirmedSubscribers ?? 'confirmed'}${data.healthStrip.pendingSubscribers > 0 ? ` · ${data.healthStrip.pendingSubscribers} ${strings?.audience.pendingSubscribers ?? 'pending opt-in'}` : ''} · ${data.healthStrip.netGrowth30d > 0 ? '+' : ''}${data.healthStrip.netGrowth30d} ${strings?.audience.netGrowth ?? 'net growth'} · ${data.healthStrip.churnRate.toFixed(1)}% ${strings?.audience.churnRate ?? 'churn'}`}
        shortcuts={[
          { key: 'E', label: strings?.actions.exportCsv ?? 'Export' },
          { key: 'N', label: strings?.actions.newEdition ?? 'New' },
        ]}
      />
    </div>
  )
}
