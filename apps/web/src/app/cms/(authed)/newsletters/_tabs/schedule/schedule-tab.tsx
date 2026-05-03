'use client'

import { useState, useCallback, useTransition } from 'react'
import type { ScheduleTabData, ReadyEdition } from '../../_hub/hub-types'
import { HealthStrip } from '../../_shared/health-strip'
import { MonthCalendar } from './month-calendar'
import { CadenceCard } from './cadence-card'
import { SummaryBar } from '../../_shared/summary-bar'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import { EmptyState } from '../../_shared/empty-state'
import { SlotPickerModal, type CadenceSlotOption } from '../../_components/slot-picker-modal'
import { ScheduleModal } from '../../_components/schedule-modal'
import { CalendarDays } from 'lucide-react'
import type { NewsletterHubStrings } from '../../_i18n/types'
import { toggleCadence, getAvailableSlots, scheduleEditionToSlot, scheduleEditionAsSpecial } from '../../actions'

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

interface SlotPickerLocalState {
  editionId: string
  displayId: string
  subject: string
  typeId: string
  typeName: string
  patternDescription: string
  slots: CadenceSlotOption[]
  hasMore: boolean
  loading: boolean
}

interface SpecialScheduleState {
  editionId: string
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
  const [slotPickerState, setSlotPickerState] = useState<SlotPickerLocalState | null>(null)
  const [specialScheduleState, setSpecialScheduleState] = useState<SpecialScheduleState | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }, [])

  const handleTogglePause = (typeId: string, paused: boolean) => {
    startTransition(async () => {
      await toggleCadence(typeId, paused)
    })
  }

  const handleDateClick = (date: string) => {
    if (!data.readyEditions || data.readyEditions.length === 0) {
      showToast(strings?.schedule.noReadyEditions ?? 'No ready editions to schedule')
      return
    }
    // Position popover near the center of the viewport
    setPickerState({
      open: true,
      date,
      anchorRect: { top: Math.max(100, window.innerHeight / 2 - 120), left: Math.max(100, window.innerWidth / 2 - 130) },
    })
  }

  const handleEditionSelect = useCallback(async (editionId: string) => {
    const selectedDate = pickerState.date
    setPickerState({ open: false, date: '', anchorRect: null })

    const edition = data.readyEditions.find((e) => e.id === editionId)
    if (!edition) return

    const typeId = edition.typeId
    if (!typeId) {
      // No type — go straight to special schedule
      setSpecialScheduleState({ editionId })
      return
    }

    // Check if this type has a cadence pattern (determined by cadenceConfigs data)
    const cadenceConfig = data.cadenceConfigs.find((c) => c.typeId === typeId)
    const hasCadence = cadenceConfig && cadenceConfig.cadence !== 'No cadence'

    if (!hasCadence) {
      // No cadence pattern — use ScheduleModal directly
      setSpecialScheduleState({ editionId })
      return
    }

    // Has cadence — fetch available slots and open SlotPickerModal
    setSlotPickerState({
      editionId: edition.id,
      displayId: edition.displayId,
      subject: edition.subject,
      typeId,
      typeName: edition.typeName ?? '',
      patternDescription: cadenceConfig.cadence,
      slots: [],
      hasMore: false,
      loading: true,
    })

    const result = await getAvailableSlots(typeId)
    if (!result.ok) {
      // Fallback to special schedule
      setSlotPickerState(null)
      setSpecialScheduleState({ editionId })
      return
    }

    setSlotPickerState((prev) => prev ? {
      ...prev,
      slots: result.slots,
      hasMore: result.slots.length >= 20,
      loading: false,
    } : prev)
  }, [pickerState.date, data.readyEditions, data.cadenceConfigs])

  // ─── SlotPickerModal callbacks ──────────────────────────────────────────────

  const handleSlotConfirm = useCallback(async (date: string) => {
    if (!slotPickerState) return
    const { editionId, typeId } = slotPickerState
    setSlotPickerState(null)

    startTransition(async () => {
      const result = await scheduleEditionToSlot(editionId, date, typeId)
      if (result.ok) {
        showToast(strings?.schedule.saved ?? 'Scheduled')
      } else if (result.error === 'slot_taken') {
        showToast('Slot already taken — try another')
        // Re-open the slot picker with refreshed slots
        const edition = data.readyEditions.find((e) => e.id === editionId)
        if (edition) handleEditionSelect(editionId)
      } else {
        showToast(result.error ?? strings?.schedule.updateFailed ?? 'Failed to schedule')
      }
    })
  }, [slotPickerState, data.readyEditions, handleEditionSelect, showToast, startTransition, strings])

  const handleSlotLoadMore = useCallback(async () => {
    if (!slotPickerState) return
    const { typeId, slots } = slotPickerState

    setSlotPickerState((prev) => prev ? { ...prev, loading: true } : prev)

    const result = await getAvailableSlots(typeId, slots.length + 10)
    if (result.ok) {
      setSlotPickerState((prev) => prev ? {
        ...prev,
        slots: result.slots,
        hasMore: result.slots.length >= slots.length + 10,
        loading: false,
      } : prev)
    } else {
      setSlotPickerState((prev) => prev ? { ...prev, loading: false } : prev)
    }
  }, [slotPickerState])

  const handleSwitchToSpecial = useCallback(() => {
    if (!slotPickerState) return
    const { editionId } = slotPickerState
    setSlotPickerState(null)
    setSpecialScheduleState({ editionId })
  }, [slotPickerState])

  const handleSlotPickerCancel = useCallback(() => {
    setSlotPickerState(null)
  }, [])

  // ─── ScheduleModal (special) callbacks ──────────────────────────────────────

  const handleSpecialScheduleConfirm = useCallback((scheduledAt: string) => {
    if (!specialScheduleState) return
    const { editionId } = specialScheduleState
    setSpecialScheduleState(null)

    startTransition(async () => {
      const result = await scheduleEditionAsSpecial(editionId, scheduledAt)
      if (result.ok) {
        showToast(strings?.schedule.saved ?? 'Scheduled')
      } else {
        showToast(result.error ?? strings?.schedule.updateFailed ?? 'Failed to schedule')
      }
    })
  }, [specialScheduleState, showToast, startTransition, strings])

  const handleSpecialScheduleCancel = useCallback(() => {
    setSpecialScheduleState(null)
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────────

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

      <SlotPickerModal
        open={!!slotPickerState && !slotPickerState.loading}
        editionDisplayId={slotPickerState?.displayId ?? ''}
        typeName={slotPickerState?.typeName ?? ''}
        patternDescription={slotPickerState?.patternDescription ?? ''}
        availableSlots={slotPickerState?.slots ?? []}
        hasMore={slotPickerState?.hasMore ?? false}
        onLoadMore={handleSlotLoadMore}
        onConfirmSlot={handleSlotConfirm}
        onSwitchToSpecial={handleSwitchToSpecial}
        onCancel={handleSlotPickerCancel}
        allSlotsFull={slotPickerState ? slotPickerState.slots.length === 0 && !slotPickerState.loading : false}
      />

      <ScheduleModal
        open={!!specialScheduleState}
        audienceCount={0}
        onConfirm={handleSpecialScheduleConfirm}
        onCancel={handleSpecialScheduleCancel}
      />

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-200 shadow-lg">
          {toastMsg}
        </div>
      )}
    </div>
  )
}
