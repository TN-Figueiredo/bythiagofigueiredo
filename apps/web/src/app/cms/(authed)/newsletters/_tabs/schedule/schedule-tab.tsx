'use client'

import { useState, useTransition } from 'react'
import type { ScheduleTabData, ReadyEdition } from '../../_hub/hub-types'
import { HealthStrip } from '../../_shared/health-strip'
import { MonthCalendar } from './month-calendar'
import { CadenceCard } from './cadence-card'
import { SummaryBar } from '../../_shared/summary-bar'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import { EmptyState } from '../../_shared/empty-state'
import { ScheduleModal } from '../../_components/schedule-modal'
import { CalendarDays } from 'lucide-react'
import type { NewsletterHubStrings } from '../../_i18n/types'
import { toggleCadence, scheduleEdition } from '../../actions'

interface ScheduleTabProps {
  data: ScheduleTabData
  typeFilter?: string | null
  strings?: NewsletterHubStrings
  locale?: 'en' | 'pt-BR'
}

interface PickerState {
  open: boolean
  date: string
  anchorRect: { top: number; left: number } | null
}

interface ScheduleTarget {
  editionId: string
  date: string
}

function EditionPicker({
  editions,
  onSelect,
  onClose,
  anchorRect,
  strings,
}: {
  editions: ReadyEdition[]
  onSelect: (editionId: string) => void
  onClose: () => void
  anchorRect: { top: number; left: number } | null
  strings?: NewsletterHubStrings
}) {
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute z-50 w-64 rounded-lg border border-gray-700 bg-gray-900 p-2 shadow-xl"
        style={{ top: anchorRect?.top ?? 200, left: anchorRect?.left ?? 200 }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 px-2 text-[11px] font-semibold text-gray-400">
          {strings?.schedule.selectEdition ?? 'Select an edition to schedule'}
        </p>
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {editions.map((ed) => (
            <button
              key={ed.id}
              type="button"
              onClick={() => onSelect(ed.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: ed.typeColor ?? '#6366f1' }}
              />
              <span className="shrink-0 font-mono text-[9px] text-gray-500">{ed.displayId}</span>
              <span className="truncate">{ed.subject || '(untitled)'}</span>
              {ed.typeName && (
                <span className="ml-auto shrink-0 rounded px-1 py-0.5 text-[9px]" style={{ backgroundColor: (ed.typeColor ?? '#6366f1') + '22', color: ed.typeColor ?? '#6366f1' }}>
                  {ed.typeName}
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="mt-2 px-2 text-[9px] text-gray-600">
          {strings?.schedule.scheduledHint ?? 'Only ready editions'}
        </p>
      </div>
    </div>
  )
}

export function ScheduleTab({ data, typeFilter, strings, locale = 'en' }: ScheduleTabProps) {
  const [, startTransition] = useTransition()
  const [pickerState, setPickerState] = useState<PickerState>({ open: false, date: '', anchorRect: null })
  const [scheduleTarget, setScheduleTarget] = useState<ScheduleTarget | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const handleTogglePause = (typeId: string, paused: boolean) => {
    startTransition(async () => {
      await toggleCadence(typeId, paused)
    })
  }

  const handleDateClick = (date: string) => {
    if (!data.readyEditions || data.readyEditions.length === 0) {
      setToast(strings?.schedule.noReadyEditions ?? 'No ready editions to schedule')
      setTimeout(() => setToast(null), 3000)
      return
    }
    // Position popover near the center of the viewport
    setPickerState({
      open: true,
      date,
      anchorRect: { top: Math.max(100, window.innerHeight / 2 - 120), left: Math.max(100, window.innerWidth / 2 - 130) },
    })
  }

  const handleEditionSelect = (editionId: string) => {
    setPickerState({ open: false, date: '', anchorRect: null })
    setScheduleTarget({ editionId, date: pickerState.date })
  }

  const handleScheduleConfirm = (scheduledAt: string) => {
    if (!scheduleTarget) return
    const { editionId } = scheduleTarget
    setScheduleTarget(null)
    startTransition(async () => {
      const result = await scheduleEdition(editionId, scheduledAt)
      if (result.ok) {
        setToast(strings?.schedule.saved ?? 'Scheduled')
      } else {
        setToast(result.error ?? strings?.schedule.updateFailed ?? 'Failed to schedule')
      }
      setTimeout(() => setToast(null), 3000)
    })
  }

  const handleScheduleCancel = () => {
    setScheduleTarget(null)
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
            { label: strings?.schedule.missed ?? 'Missed', value: data.healthStrip.missed, color: data.healthStrip.missed > 0 ? '#ef4444' : undefined },
            { label: strings?.schedule.failed ?? 'Failed', value: data.healthStrip.failed, color: data.healthStrip.failed > 0 ? '#ef4444' : undefined },
            { label: strings?.schedule.activeTypes ?? 'Active Types', value: `${data.healthStrip.activeTypes}/${data.healthStrip.totalTypes}` },
          ]}
        />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Calendar">
        <MonthCalendar slots={data.calendarSlots} locale={locale} onDateClick={handleDateClick} />
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

      {pickerState.open && (
        <EditionPicker
          editions={data.readyEditions}
          onSelect={handleEditionSelect}
          onClose={() => setPickerState({ open: false, date: '', anchorRect: null })}
          anchorRect={pickerState.anchorRect}
          strings={strings}
        />
      )}

      <ScheduleModal
        open={!!scheduleTarget}
        audienceCount={0}
        onConfirm={handleScheduleConfirm}
        onCancel={handleScheduleCancel}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-200 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
