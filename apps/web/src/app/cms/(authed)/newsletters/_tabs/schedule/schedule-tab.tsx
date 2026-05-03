'use client'

import { useTransition } from 'react'
import type { ScheduleTabData } from '../../_hub/hub-types'
import { HealthStrip } from '../../_shared/health-strip'
import { MonthCalendar } from './month-calendar'
import { CadenceCard } from './cadence-card'
import { SummaryBar } from '../../_shared/summary-bar'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import { EmptyState } from '../../_shared/empty-state'
import { CalendarDays } from 'lucide-react'
import type { NewsletterHubStrings } from '../../_i18n/types'
import { toggleCadence } from '../../actions'

interface ScheduleTabProps {
  data: ScheduleTabData
  typeFilter?: string | null
  strings?: NewsletterHubStrings
  locale?: 'en' | 'pt-BR'
}

export function ScheduleTab({ data, typeFilter, strings, locale = 'en' }: ScheduleTabProps) {
  const [, startTransition] = useTransition()

  const handleTogglePause = (typeId: string, paused: boolean) => {
    startTransition(async () => {
      await toggleCadence(typeId, paused)
    })
  }

  const filteredConfigs = typeFilter
    ? data.cadenceConfigs.filter((c) => c.typeId === typeFilter)
    : data.cadenceConfigs

  if (data.cadenceConfigs.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-8 w-8" />}
        heading={strings?.empty.configCadence ?? 'Configure your newsletter cadence'}
        description={strings?.empty.configCadence ?? 'Configure cadence for your newsletter types'}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionErrorBoundary sectionName="Schedule metrics">
        <HealthStrip
          metrics={[
            { label: strings?.schedule.fillRate ?? 'Fill Rate', value: `${data.healthStrip.fillRate.toFixed(0)}%` },
            { label: strings?.schedule.next7Days ?? 'Next 7 Days', value: data.healthStrip.next7Days },
            { label: strings?.schedule.conflicts ?? 'Conflicts', value: data.healthStrip.conflicts, color: data.healthStrip.conflicts > 0 ? '#ef4444' : undefined },
            { label: strings?.schedule.activeTypes ?? 'Active Types', value: `${data.healthStrip.activeTypes}/${data.healthStrip.totalTypes}` },
          ]}
        />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Calendar">
        <MonthCalendar slots={data.calendarSlots} locale={locale} />
      </SectionErrorBoundary>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{strings?.schedule.cadenceConfig ?? 'Cadence Config'}</h3>
          {filteredConfigs.map((c) => (
            <CadenceCard key={c.typeId} config={c} onTogglePause={handleTogglePause} strings={strings} />
          ))}
        </div>
        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{strings?.schedule.sendWindow ?? 'Send Window'}</h3>
          <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
            <div className="text-[11px] text-gray-200">{data.sendWindow.time} ({data.sendWindow.timezone})</div>
            <p className="mt-1 text-[9px] text-gray-600">{data.sendWindow.bestTimeInsight}</p>
          </div>
        </div>
      </div>

      <SummaryBar
        stats={`${data.healthStrip.next7Days} ${strings?.common.editions ?? 'editions'} ${strings?.schedule.next7Days ?? 'next 7 days'} · ${data.healthStrip.activeTypes} ${strings?.schedule.activeTypes ?? 'active types'}`}
        shortcuts={[{ key: 'N', label: 'New' }]}
      />
    </div>
  )
}
