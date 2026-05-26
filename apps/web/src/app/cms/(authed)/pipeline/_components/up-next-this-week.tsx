'use client'

import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { FORMAT_COLORS } from '@/lib/pipeline/colors'
import { STAGE_GROUP, EFFORT_DEFAULTS, DAY_LABELS } from '@/lib/pipeline/up-next-constants'
import type { WeekSlot } from '@/lib/pipeline/up-next-types'
import type { Stage } from '@/lib/pipeline/up-next-constants'

export interface WeekGridProps {
  slots: WeekSlot[]
  todayDate: string
  stageCounts: Record<string, number>
  totalEffortMinutes: number
  streak: { currentStreak: number; isActive: boolean }
  nextWeekEmpty: number
  backlogCount: number
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

function SlotChip({ slot }: { slot: WeekSlot }) {
  const colors = FORMAT_COLORS[slot.format] ?? { accent: '#6366f1', text: '#a5b4fc' }
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
      <Link
        href={`/cms/pipeline/items/${slot.assignedItem!.id}`}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium truncate transition-opacity hover:opacity-80"
        style={{
          background: `color-mix(in srgb, ${colors.accent} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${colors.accent} 30%, transparent)`,
          color: colors.text,
        }}
        title={slot.assignedItem!.title}
      >
        <span className="truncate max-w-[100px]">{slot.assignedItem!.title}</span>
        <span
          className="text-[9px] px-1 rounded"
          style={{ background: `color-mix(in srgb, ${colors.accent} 20%, transparent)` }}
        >
          {slot.assignedItem!.stage}
        </span>
      </Link>
    )
  }

  return (
    <button
      type="button"
      className="flex items-center justify-center rounded-md px-2 py-1 text-[10px] w-full min-h-[44px]"
      style={{
        border: `1px dashed color-mix(in srgb, ${colors.accent} 35%, transparent)`,
        color: 'var(--gem-dim)',
      }}
      data-testid={`empty-slot-${slot.day}`}
    >
      slot vazio
    </button>
  )
}

export function UpNextThisWeek({
  slots, todayDate, stageCounts, totalEffortMinutes,
  streak, nextWeekEmpty, backlogCount,
}: WeekGridProps) {
  if (slots.length === 0) return null

  const slotsByDay = groupSlotsByDay(slots)

  const allDays: string[] = []
  if (slots.length > 0) {
    const dates = slots.map(s => s.day).sort()
    const first = new Date(dates[0]! + 'T00:00:00Z')
    const firstDay = first.getUTCDay()
    const mondayOffset = firstDay === 0 ? -6 : 1 - firstDay
    const monday = new Date(first)
    monday.setUTCDate(first.getUTCDate() + mondayOffset)
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setUTCDate(monday.getUTCDate() + i)
      allDays.push(d.toISOString().slice(0, 10))
    }
  }

  const filledCount = slots.filter(s => s.assignedItem).length
  const totalCount = slots.length

  return (
    <section role="region" aria-label="Grade semanal de conteudo">
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
        <div className="grid grid-cols-7 min-w-[600px]">
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
                <div
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
                        color: dayEffort >= 240 ? '#fca5a5' : 'var(--gem-dim)',
                      }}
                    >
                      ~{Math.round(dayEffort / 60)}h
                    </span>
                  )}
                </div>

                <div className="p-1.5 space-y-1 flex-1">
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
                      <SlotChip key={`${slot.day}-${i}`} slot={slot} />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <ul
        className="flex items-center gap-3 mt-2 text-[11px] flex-wrap"
        style={{ color: 'var(--gem-dim)' }}
      >
        {Object.entries(stageCounts).map(([group, count]) => (
          <li key={group} className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{
              background: group === 'escrever' ? 'var(--gem-accent)'
                : group === 'gravar' ? '#ef4444'
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
        style={{ color: 'var(--gem-dim)' }}
      >
        <span>
          Prox. semana: {nextWeekEmpty} vazios · {backlogCount} no backlog
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
          style={{ color: 'var(--gem-dim)' }}
        >
          {filledCount}/{totalCount} slots preenchidos esta semana
          {filledCount === totalCount && ' — tudo pronto!'}
        </p>
      )}
    </section>
  )
}
