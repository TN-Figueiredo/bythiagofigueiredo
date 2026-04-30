'use client'

import type { ScheduleSlot } from '../../_hub/hub-types'

interface MonthCalendarProps {
  slots: ScheduleSlot[]
  timezone: string
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function MonthCalendar({ slots }: MonthCalendarProps) {
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-2 text-center text-[9px] font-semibold uppercase tracking-wider text-gray-600">{d}</div>
        ))}
        {slots.map((slot) => {
          const isToday = slot.date === today
          const hasEditions = slot.editions.length > 0
          return (
            <div
              key={slot.date}
              className={`flex min-h-[60px] flex-col rounded-md border p-1.5 ${
                isToday ? 'border-indigo-500/30 bg-indigo-950/10' : 'border-gray-800/50 hover:border-gray-700'
              }`}
            >
              <span className={`text-[9px] tabular-nums ${isToday ? 'font-bold text-indigo-400' : 'text-gray-600'}`}>
                {new Date(slot.date + 'T12:00:00').getDate()}
              </span>
              <div className="mt-1 flex flex-wrap gap-0.5">
                {slot.editions.map((e) => (
                  <div
                    key={e.id}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: e.typeColor }}
                    title={e.subject}
                  />
                ))}
                {slot.emptySlots.map((e, i) => (
                  <div
                    key={`empty-${i}`}
                    className="h-1.5 w-1.5 rounded-full border border-dashed"
                    style={{ borderColor: e.typeColor }}
                    title={`Empty: ${e.typeName}`}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
