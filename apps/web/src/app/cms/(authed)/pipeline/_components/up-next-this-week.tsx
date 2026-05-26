'use client'

import { useState, useRef, useCallback, useMemo, memo } from 'react'
import Link from 'next/link'
import { Calendar, RefreshCw } from 'lucide-react'
import { FORMAT_COLORS } from '@/lib/pipeline/colors'
import { gemMix } from '@/lib/pipeline/gem-design'
import { DAY_LABELS } from '@/lib/pipeline/up-next-constants'
import type { WeekSlot, SlotCandidate } from '@/lib/pipeline/up-next-types'
import dynamic from 'next/dynamic'

// Lazy-loaded: only needed when the picker is open
const LazyWeekSlotPicker = dynamic(
  () => import('./week-slot-picker').then(m => ({ default: m.WeekSlotPicker })),
  { ssr: false }
)

const FORMAT_LABELS: Record<string, string> = {
  video: 'Video',
  blog_post: 'Blog',
  newsletter: 'News',
}

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
  selectedItem?: SlotCandidate | null
  onItemAssigned?: () => void
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

interface SlotChipProps {
  slot: WeekSlot
  onEmptyClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  onSwapClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  selectedItem?: SlotCandidate | null
  onDirectAssign?: (itemId: string, day: string, hour: string | null) => void
}

const SlotChip = memo(function SlotChip({ slot, onEmptyClick, onSwapClick, selectedItem, onDirectAssign }: SlotChipProps) {
  const colors = FORMAT_COLORS[slot.format] ?? { accent: 'var(--gem-accent)', text: 'var(--gem-muted)' }
  const filled = slot.assignedItem !== null

  if (slot.isRestDay && !filled) {
    return (
      <div
        className="flex items-center justify-center rounded-md px-2 py-1 text-[10px]"
        style={{
          border: '1px dashed var(--gem-dim)',
          color: 'var(--gem-dim)',
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
            background: gemMix(colors.accent, 12),
            border: `1px solid ${gemMix(colors.accent, 30)}`,
            color: colors.text,
          }}
          title={slot.assignedItem!.title}
          aria-label={`${slot.assignedItem!.title} — ${slot.dayLabel}, ${slot.assignedItem!.stage}`}
        >
          <span className="truncate max-w-[100px]">{slot.assignedItem!.title}</span>
          <span
            className="text-[10px] px-1 rounded"
            style={{ background: gemMix(colors.accent, 20) }}
          >
            {slot.assignedItem!.stage}
          </span>
        </Link>
        {onSwapClick && (
          <button
            type="button"
            className="absolute top-1/2 right-0 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full opacity-60 group-hover/chip:opacity-100 focus-visible:opacity-100 motion-safe:transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
            style={{
              background: gemMix(colors.accent, 20),
              color: colors.text,
            }}
            data-day={slot.day}
            data-format={slot.format}
            data-hour={slot.hour ?? ''}
            data-item-id={slot.assignedItem!.id}
            onClick={(e) => { e.preventDefault(); onSwapClick(e) }}
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

  const isCompatible = !!selectedItem && selectedItem.format === slot.format

  return (
    <button
      type="button"
      className={`flex items-center justify-center rounded-md px-2 py-1 text-[10px] w-full min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none${isCompatible ? ' ring-2 ring-[var(--gem-accent)]' : ''}`}
      style={{
        border: `1px dashed ${gemMix(colors.accent, 35)}`,
        color: 'var(--gem-dim)',
      }}
      data-testid={`empty-slot-${slot.day}`}
      data-day={slot.day}
      data-format={slot.format}
      data-hour={slot.hour ?? ''}
      aria-label={`Adicionar ${FORMAT_LABELS[slot.format] ?? slot.format} — ${dayLabel} ${dateNum}`}
      onClick={isCompatible && onDirectAssign
        ? () => onDirectAssign(selectedItem!.id, slot.day, slot.hour)
        : onEmptyClick}
    >
      {isCompatible ? selectedItem!.title : `+ ${FORMAT_LABELS[slot.format] ?? slot.format}`}
    </button>
  )
})

export function UpNextThisWeek({
  slots, todayDate, stageCounts, totalEffortMinutes,
  streak, nextWeekEmpty, backlogCount,
  candidates = [], onAssignSlot,
  selectedItem = null, onItemAssigned,
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

  const handleEmptyClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const day = e.currentTarget.dataset.day!
    const format = e.currentTarget.dataset.format! as WeekSlot['format']
    const hour = e.currentTarget.dataset.hour || null
    triggerRef.current = e.currentTarget
    setPickerSlot({ day, format, hour })
  }, [])

  const handleSwapClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const day = e.currentTarget.dataset.day!
    const format = e.currentTarget.dataset.format! as WeekSlot['format']
    const hour = e.currentTarget.dataset.hour || null
    const itemId = e.currentTarget.dataset.itemId!
    triggerRef.current = e.currentTarget
    setPickerSlot({ day, format, hour, previousItemId: itemId })
  }, [])

  const handleDirectAssign = useCallback((itemId: string, day: string, hour: string | null) => {
    onAssignSlot?.(itemId, day, hour)
    onItemAssigned?.()
  }, [onAssignSlot, onItemAssigned])

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
          <h2
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--gem-muted)' }}
          >
            Esta Semana
          </h2>
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
                    ? gemMix('--gem-accent', 5)
                    : isPast
                      ? gemMix('--gem-text', 3)
                      : isWeekend && daySlots.length === 0
                        ? gemMix('--gem-text', 2)
                        : undefined,
                }}
                {...(isToday ? { 'aria-current': 'date' as const } : {})}
              >
                <h3
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
                      className="block text-[10px] mt-0.5"
                      style={{
                        color: dayEffort >= 240 ? 'var(--gem-warn)' : 'var(--gem-dim)',
                      }}
                    >
                      ~{Math.round(dayEffort / 60)}h
                    </span>
                  )}
                </h3>

                <div ref={(el) => setDayCellRef(dayDate, el)} className="p-1.5 space-y-1 flex-1 relative">
                  {daySlots.length === 0 ? (
                    <span
                      className="text-[10px] block text-center mt-2"
                      style={{ color: 'var(--gem-dim)' }}
                      aria-hidden="true"
                    >
                      &mdash;
                    </span>
                  ) : (
                    daySlots.map((slot, i) => (
                      <SlotChip
                        key={`${slot.day}-${slot.format}-${slot.hour ?? 'null'}-${i}`}
                        slot={slot}
                        onEmptyClick={handleEmptyClick}
                        onSwapClick={onAssignSlot ? handleSwapClick : undefined}
                        selectedItem={selectedItem}
                        onDirectAssign={selectedItem ? handleDirectAssign : undefined}
                      />
                    ))
                  )}
                  {pickerSlot && pickerSlot.day === dayDate && (
                    <LazyWeekSlotPicker
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
        className="flex items-center gap-3 mt-2 text-xs flex-wrap"
        style={{ color: 'var(--gem-muted)' }}
      >
        {Object.entries(stageCounts).map(([group, count]) => (
          <li key={group} className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{
              background: group === 'escrever' ? 'var(--gem-accent)'
                : group === 'gravar' ? 'var(--gem-danger)'
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
          className="text-xs mt-1"
          style={{ color: 'var(--gem-muted)' }}
        >
          {filledCount}/{totalCount} slots preenchidos esta semana
          {filledCount === totalCount && ' — tudo pronto!'}
        </p>
      )}
    </section>
  )
}
