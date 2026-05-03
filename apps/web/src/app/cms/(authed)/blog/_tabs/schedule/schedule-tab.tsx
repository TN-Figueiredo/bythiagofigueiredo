'use client'

import { useTransition } from 'react'
import { CalendarDays } from 'lucide-react'
import type { ScheduleTabData } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { HealthStrip } from '../../_shared/health-strip'
import { MonthCalendar } from './month-calendar'
import { CadenceCard } from './cadence-card'
import { EmptyState } from '../../_shared/empty-state'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import { updateBlogCadence } from '../../actions'

interface ScheduleTabProps {
  data: ScheduleTabData
  strings?: BlogHubStrings
  locale?: 'en' | 'pt-BR'
}

export function ScheduleTab({ data, strings, locale = 'en' }: ScheduleTabProps) {
  const s = strings?.schedule
  const [, startTransition] = useTransition()

  const handleTogglePause = (loc: string, paused: boolean) => {
    startTransition(async () => {
      await updateBlogCadence(loc, { cadence_paused: paused })
    })
  }

  if (data.cadenceConfigs.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-8 w-8" />}
        heading={strings?.empty.configCadence ?? 'Configure your publishing cadence'}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionErrorBoundary sectionName="Schedule metrics">
        <HealthStrip
          metrics={[
            {
              label: s?.fillRate ?? 'Fill Rate',
              value: `${data.healthStrip.fillRate.toFixed(0)}%`,
            },
            {
              label: s?.next7Days ?? 'Next 7 Days',
              value: data.healthStrip.next7Days,
            },
            {
              label: s?.avgReadingTime ?? 'Avg Reading Time',
              value:
                data.healthStrip.avgReadingTime > 0
                  ? `${data.healthStrip.avgReadingTime.toFixed(1)} min`
                  : '—',
            },
            {
              label: s?.activeLocales ?? 'Active Locales',
              value: `${data.healthStrip.activeLocales}/${data.healthStrip.totalLocales}`,
            },
          ]}
        />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Calendar">
        <MonthCalendar slots={data.calendarSlots} locale={locale} />
      </SectionErrorBoundary>

      <div className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {s?.cadenceConfig ?? 'Cadence Config'}
        </h3>
        {data.cadenceConfigs.map((config) => (
          <CadenceCard
            key={config.locale}
            config={config}
            onTogglePause={handleTogglePause}
            strings={strings}
          />
        ))}
      </div>
    </div>
  )
}
