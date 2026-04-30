'use client'

import type { AutomationsTabData } from '../../_hub/hub-types'
import { HealthStrip } from '../../_shared/health-strip'
import { WorkflowCard } from './workflow-card'
import { CronCard } from './cron-card'
import { ActivityFeed } from '../../_shared/activity-feed'
import { SummaryBar } from '../../_shared/summary-bar'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'

interface AutomationsTabProps {
  data: AutomationsTabData
}

export function AutomationsTab({ data }: AutomationsTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <SectionErrorBoundary sectionName="Automations metrics">
        <HealthStrip
          metrics={[
            { label: 'Workflows Active', value: data.healthStrip.workflowsActive },
            { label: 'Crons Healthy', value: data.healthStrip.cronsHealthy },
            { label: 'Events Today', value: data.healthStrip.eventsToday },
            { label: 'Success Rate', value: `${data.healthStrip.successRate.toFixed(0)}%` },
            { label: 'Last Incident', value: data.healthStrip.lastIncidentDaysAgo !== null ? `${data.healthStrip.lastIncidentDaysAgo}d ago` : 'None' },
          ]}
        />
      </SectionErrorBoundary>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Workflows</h3>
          <div className="space-y-3">
            {data.workflows.map((w) => (
              <WorkflowCard key={w.id} workflow={w} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">System Crons</h3>
          <div className="space-y-2">
            {data.cronJobs.map((c) => (
              <CronCard key={c.name} cron={c} />
            ))}
          </div>
        </div>
      </div>

      {data.activityFeed.length > 0 && (
        <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Activity Feed</h3>
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
