'use client'

import type { AutomationsTabData } from '../../_hub/hub-types'
import type { NewsletterHubStrings } from '../../_i18n/types'
import { HealthStrip } from '../../_shared/health-strip'
import { WorkflowCard } from './workflow-card'
import { CronCard } from './cron-card'
import { ActivityFeed } from '../../_shared/activity-feed'
import { SummaryBar } from '../../_shared/summary-bar'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import { EmptyState } from '../../_shared/empty-state'
import { Workflow } from 'lucide-react'

interface AutomationsTabProps {
  data: AutomationsTabData
  strings?: NewsletterHubStrings
}

export function AutomationsTab({ data, strings }: AutomationsTabProps) {
  if (data.workflows.length === 0 && data.cronJobs.length === 0) {
    return (
      <EmptyState
        icon={<Workflow className="h-8 w-8" />}
        heading={strings?.empty.noActivity ?? 'No automations configured'}
        description="Workflows and cron jobs will appear here once configured."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionErrorBoundary sectionName="Automations metrics">
        <HealthStrip
          metrics={[
            { label: strings?.automations.workflows ?? 'Workflows Active', value: data.healthStrip.workflowsActive },
            { label: strings?.automations.crons ?? 'Crons Healthy', value: data.healthStrip.cronsHealthy },
            { label: strings?.automations.eventsToday ?? 'Events Today', value: data.healthStrip.eventsToday },
            { label: strings?.automations.successRate ?? 'Success Rate', value: `${data.healthStrip.successRate.toFixed(0)}%` },
            { label: strings?.automations.lastIncident ?? 'Last Incident', value: data.healthStrip.lastIncidentDaysAgo !== null ? `${data.healthStrip.lastIncidentDaysAgo}d ago` : (strings?.editorial.none ?? 'None') },
          ]}
        />
      </SectionErrorBoundary>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{strings?.automations.workflows ?? 'Workflows'}</h3>
          <div className="space-y-3">
            {data.workflows.map((w) => (
              <WorkflowCard key={w.id} workflow={w} strings={strings} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{strings?.automations.crons ?? 'System Crons'}</h3>
          <div className="space-y-2">
            {data.cronJobs.map((c) => (
              <CronCard key={c.name} cron={c} strings={strings} />
            ))}
          </div>
        </div>
      </div>

      {data.activityFeed.length > 0 && (
        <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{strings?.automations.activityFeed ?? 'Activity Feed'}</h3>
          <ActivityFeed events={data.activityFeed} />
        </div>
      )}

      <SummaryBar
        stats={`${data.workflows.length} workflows · ${data.cronJobs.length} crons · ${data.healthStrip.successRate.toFixed(0)}% success rate`}
        shortcuts={[{ key: 'N', label: 'New' }]}
      />
    </div>
  )
}
