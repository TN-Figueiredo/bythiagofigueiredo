'use client'

import type { ScheduleTabData } from '../../_hub/hub-types'
import { HealthStrip } from '../../_shared/health-strip'
import { MonthCalendar } from './month-calendar'
import { CadenceCard } from './cadence-card'
import { SummaryBar } from '../../_shared/summary-bar'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import { EmptyState } from '../../_shared/empty-state'
import { CalendarDays } from 'lucide-react'

interface ScheduleTabProps {
  data: ScheduleTabData
}

export function ScheduleTab({ data }: ScheduleTabProps) {
  if (data.cadenceConfigs.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-8 w-8" />}
        heading="Configure your newsletter cadence"
        description="Set up publishing cadences for your newsletter types to see the schedule."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionErrorBoundary sectionName="Schedule metrics">
        <HealthStrip
          metrics={[
            { label: 'Fill Rate', value: `${data.healthStrip.fillRate.toFixed(0)}%` },
            { label: 'Next 7 Days', value: data.healthStrip.next7Days },
            { label: 'Conflicts', value: data.healthStrip.conflicts, color: data.healthStrip.conflicts > 0 ? '#ef4444' : undefined },
            { label: 'Active Types', value: `${data.healthStrip.activeTypes}/${data.healthStrip.totalTypes}` },
          ]}
        />
      </SectionErrorBoundary>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionErrorBoundary sectionName="Calendar">
            <MonthCalendar slots={data.calendarSlots} timezone={data.sendWindow.timezone} />
          </SectionErrorBoundary>
        </div>
        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Cadence Config</h3>
          {data.cadenceConfigs.map((c) => (
            <CadenceCard key={c.typeId} config={c} />
          ))}
          <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
            <span className="text-[10px] font-medium text-gray-400">Send Window</span>
            <div className="mt-1 text-[11px] text-gray-200">{data.sendWindow.time} ({data.sendWindow.timezone})</div>
            <p className="mt-1 text-[9px] text-gray-600">{data.sendWindow.bestTimeInsight}</p>
          </div>
        </div>
      </div>

      <SummaryBar
        stats={`${data.healthStrip.next7Days} editions next 7 days · ${data.healthStrip.activeTypes} active types`}
        shortcuts={[{ key: 'N', label: 'New' }]}
      />
    </div>
  )
}
