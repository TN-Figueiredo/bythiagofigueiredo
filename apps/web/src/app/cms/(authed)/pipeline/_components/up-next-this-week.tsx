'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Calendar, RefreshCw } from 'lucide-react'
import { FORMAT_COLORS } from '@/lib/pipeline/colors'
import { DAY_LABELS } from '@/lib/pipeline/up-next-constants'
import { WeekSlotPicker } from './week-slot-picker'
import type { WeekSlot, SlotCandidate } from '@/lib/pipeline/up-next-types'

export interface WeekGridProps {
  slots: WeekSlot[]
  todayDate: string
  stageCounts: Record<string, number>
  totalEffortMinutes: number
  streak: { currentStreak: number; isActive: boolean }
  nextWeekEmpty: number
  backlogCount: number
  candidates?: SlotCandidate[]
  onAssignSlot?: (itemId: string, slotDay: string, slotHour: string | null, previousItemId?: string) => Promise<void>
}

function groupSlotsByDay(slots: WeekSlot[]): Map<string, WeekSlot[]> {
  const map = new Map<string, WeekSlot[]>()
  for (const slot of slots) {
    const group = map.get(slot.day)
    if (group) group.push(slot)
    else map.set(slot.day, [slot])
  }
  return map
}

function SlotChip({ slot, onEmptyClick, onSwapClick }: {
  slot: WeekSlot
  onEmptyClick?: (day: string, format: WeekSlot['format'], hour: string | null) => void
  onSwapClick?: (day: string, format: WeekSlot['format'], hour: string | null, previousItemId: string) => void
}) {
  const colors = FORMAT_COLORS[slot.format] ?? { accent: 'var(--gem-accent)', text: 'var(--gem-muted)' }
  const filled = slot.assignedItem !== null

  if (slot.isRestDay && !filled) {
    return (
      <div
        className="flex items-center justify-center rounded-md px-2 py-1 text-[10px]"
        style={{
          border: '1px dashed var(--gem-dim)',
          color: 'var(--gem-dim)',
          opacity: 0.5,
        }}
      >
        (opcional)
      </div>
    )
  }

  if (filled) {
    return (
      <div className="group/chip relative">
        <Link
          href={`/cms/pipeline/items/${slot.assignedItem!.id}`}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 pr-7 text-[10px] font-medium truncate cursor-pointer motion-safe:transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none min-h-[44px]"
          style={{
            background: `color-mix(in srgb, ${colors.accent} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${colors.accent} 30%, transparent)`,
            color: colors.text,
          }}
          title={slot.assignedItem!.title}
          aria-label={`${slot.assignedItem!.title} — ${slot.dayLabel}, ${slot.assignedItem!.stage}`}
        >
          <span className="truncate max-w-[100px]">{slot.assignedItem!.title}</span>
          <span
            className="text-[9px] px-1 rounded"
            style={{ background: `color-mix(in srgb, ${colors.accent} 20%, transparent)` }}
          >
            {slot.assignedItem!.stage}
          </span>
        </Link>
        {onSwapClick && (
          <button
            type="button"
            className="absolute top-1/2 right-0 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full opacity-40 group-hover/chip:opacity-100 focus-visible:opacity-100 motion-safe:transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
            style={{
              background: `color-mix(in srgb, ${colors.accent} 20%, transparent)`,
              color: colors.text,
            }}
            onClick={(e) => { e.preventDefault(); onSwapClick(slot.day, slot.format, slot.hour, slot.assignedItem!.id) }}
            aria-label={`Trocar ${slot.assignedItem!.title}`}
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>
    )
  }

  const dayNum = new Date(slot.day + 'T00:00:00Z').getUTCDay()
  const dayLabel = DAY_LABELS[dayNum] ?? ''
  const dateNum = parseInt(slot.day.slice(8, 10), 10)

  return (
    <button
      type="button"
      className="flex items-center justify-center rounded-md px-2 py-1 text-[10px] w-full min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
      style={{
        border: `1px dashed color-mix(in srgb, ${colors.accent} 35%, transparent)`,
        color: 'var(--gem-dim)',
      }}
      data-testid={`empty-slot-${slot.day}`}
      aria-label={`Adicionar conteúdo — ${dayLabel} ${dateNum}`}
      onClick={() => onEmptyClick?.(slot.day, slot.format, slot.hour)}
    >
      slot vazio
    </button>
  )
}

export function UpNextThisWeek({
  slots, todayDate, stageCounts, totalEffortMinutes,
  streak, nextWeekEmpty, backlogCount,
  candidates = [], onAssignSlot,
}: WeekGridProps) {
  const [pickerSlot, setPickerSlot] = useState<{ day: string; format: WeekSlot['format']; hour: string | null; previousItemId?: string } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const dayCellRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const setDayCellRef = useCallback((day: string, el: HTMLDivElement | null) => {
    if (el) dayCellRefs.current.set(day, el)
    else dayCellRefs.current.delete(day)
  }, [])

  const slotsByDay = useMemo(() => groupSlotsByDay(slots), [slots])

  const allDays = useMemo(() => {
    if (slots.length === 0) return []
    const dates = slots.map(s => s.day).sort()
    const first = new Date(dates[0]! + 'T00:00:00Z')
    const firstDay = first.getUTCDay()
    const mondayOffset = firstDay === 0 ? -6 : 1 - firstDay
    const monday = new Date(first)
    monday.setUTCDate(first.getUTCDate() + mondayOffset)
    const days: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setUTCDate(monday.getUTCDate() + i)
      days.push(d.toISOString().slice(0, 10))
    }
    return days
  }, [slots])

  const { filledCount, totalCount } = useMemo(() => ({
    filledCount: slots.filter(s => s.assignedItem).length,
    totalCount: slots.length,
  }), [slots])

  if (slots.length === 0) return null

  return (
    <section role="region" aria-label="Grade semanal de conteúdo">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar size={14} style={{ color: 'var(--gem-accent)' }} />
          <h3
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--gem-muted)' }}
          >
            Esta Semana
          </h3>
        </div>
      </div>

      <div
        className="rounded-lg border overflow-x-auto"
        style={{
          background: 'var(--gem-surface)',
          borderColor: 'var(--gem-border)',
        }}
      >
        <div
          role="list"
          aria-label="Calendário semanal de conteúdo"
          className="grid grid-cols-7 min-w-[600px]"
        >
          {allDays.map((dayDate) => {
            const daySlots = slotsByDay.get(dayDate) ?? []
            const dayNum = new Date(dayDate + 'T00:00:00Z').getUTCDay()
            const isToday = dayDate === todayDate
            const isPast = dayDate < todayDate
            const isWeekend = dayNum === 0 || dayNum === 6
            const dayEffort = daySlots.reduce((sum, s) => sum + s.effortMinutes, 0)

            return (
              <div
                key={dayDate}
                role="listitem"
                className="flex flex-col border-r last:border-r-0 min-h-[80px]"
                style={{
                  borderColor: 'var(--gem-border)',
                  background: isToday
                    ? 'color-mix(in srgb, var(--gem-accent) 5%, transparent)'
                    : isPast
                      ? 'color-mix(in srgb, var(--gem-surface) 50%, transparent)'
                      : undefined,
                  opacity: isPast ? 0.4 : isWeekend && daySlots.length === 0 ? 0.6 : 1,
                }}
                {...(isToday ? { 'aria-current': 'date' as const } : {})}
              >
                <h4
                  className="px-2 py-1.5 text-center border-b"
                  style={{
                    borderColor: 'var(--gem-border)',
                    borderTop: isToday ? '2px solid var(--gem-accent)' : undefined,
                  }}
                >
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      color: isToday ? 'var(--gem-accent)' : 'var(--gem-muted)',
                    }}
                  >
                    {DAY_LABELS[dayNum]} {parseInt(dayDate.slice(8, 10), 10)}
                  </span>
                  {dayEffort > 0 && (
                    <span
                      className="block text-[9px] mt-0.5"
                      style={{
                        color: dayEffort >= 240 ? 'var(--gem-warn)' : 'var(--gem-dim)',
                      }}
                    >
                      ~{Math.round(dayEffort / 60)}h
                    </span>
                  )}
                </h4>

                <div ref={(el) => setDayCellRef(dayDate, el)} className="p-1.5 space-y-1 flex-1 relative">
                  {daySlots.length === 0 ? (
                    <span
                      className="text-[9px] block text-center mt-2"
                      style={{ color: 'var(--gem-dim)' }}
                      aria-hidden="true"
                    >
                      &mdash;
                    </span>
                  ) : (
                    daySlots.map((slot, i) => (
                      <SlotChip
                        key={`${slot.day}-${slot.format}-${slot.hour ?? i}`}
                        slot={slot}
                        onEmptyClick={(day, format, hour) => {
                          triggerRef.current = document.activeElement as HTMLButtonElement | null
                          setPickerSlot({ day, format, hour })
                        }}
                        onSwapClick={onAssignSlot ? (day, format, hour, previousItemId) => {
                          triggerRef.current = document.activeElement as HTMLButtonElement | null
                          setPickerSlot({ day, format, hour, previousItemId })
                        } : undefined}
                      />
                    ))
                  )}
                  {pickerSlot && pickerSlot.day === dayDate && (
                    <WeekSlotPicker
                      slot={daySlots.find(s =>
                        s.format === pickerSlot.format && s.hour === pickerSlot.hour && (
                          pickerSlot.previousItemId
                            ? s.assignedItem?.id === pickerSlot.previousItemId
                            : !s.assignedItem
                        )
                      ) ?? { day: pickerSlot.day, format: pickerSlot.format, hour: pickerSlot.hour, effortMinutes: 0, assignedItem: null, isRestDay: false, dayLabel: '', channelLocale: null, channelId: null }}
                      candidates={candidates}
                      anchorRef={{ current: dayCellRefs.current.get(dayDate) ?? null }}
                      onAssign={async (itemId, slotDay, slotHour) => {
                        await onAssignSlot?.(itemId, slotDay, slotHour, pickerSlot.previousItemId)
                      }}
                      onClose={() => {
                        setPickerSlot(null)
                        triggerRef.current?.focus()
                      }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <ul
        className="flex items-center gap-3 mt-2 text-[11px] flex-wrap"
        style={{ color: 'var(--gem-muted)' }}
      >
        {Object.entries(stageCounts).map(([group, count]) => (
          <li key={group} className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{
              background: group === 'escrever' ? 'var(--gem-accent)'
                : group === 'gravar' ? 'var(--gem-warn)'
                : group === 'pos-prod' ? 'var(--gem-warn)'
                : 'var(--gem-done)',
            }} />
            {count} {group}
          </li>
        ))}
        {totalEffortMinutes > 0 && (
          <li>~{Math.round(totalEffortMinutes / 60)}h restantes</li>
        )}
      </ul>

      <div
        className="flex items-center justify-between mt-1 text-[10px]"
        style={{ color: 'var(--gem-muted)' }}
      >
        <span>
          {nextWeekEmpty > 0 && <>{nextWeekEmpty} vazios prox. semana · </>}
          {backlogCount} no backlog
        </span>
        {streak.currentStreak >= 2 && (
          <span style={{ color: 'var(--gem-done)' }}>
            Streak: {streak.currentStreak} semanas{streak.isActive ? '' : ' (pausado)'}
          </span>
        )}
      </div>

      {totalCount > 0 && (
        <p
          className="text-[11px] mt-1"
          style={{ color: 'var(--gem-muted)' }}
        >
          {filledCount}/{totalCount} slots preenchidos esta semana
          {filledCount === totalCount && ' — tudo pronto!'}
        </p>
      )}
    </section>
  )
}
