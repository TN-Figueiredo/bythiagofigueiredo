import type { CalendarItem, CadenceSlot } from '@/lib/schedule/schedule-queries'
import { CalendarCell } from './calendar-cell'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getMonthGridDays(month: string): string[] {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const firstOfMonth = new Date(Date.UTC(y, m - 1, 1))
  // Monday = 0, offset to Monday start
  const dow = firstOfMonth.getUTCDay() // 0=Sun, 1=Mon...
  const mondayOffset = dow === 0 ? 6 : dow - 1

  const days: string[] = []
  const startDate = new Date(firstOfMonth.getTime() - mondayOffset * 86_400_000)

  // 6 rows x 7 cols = 42 cells
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate.getTime() + i * 86_400_000)
    const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    days.push(dateStr)
  }

  return days
}

function getThisWeekRange(today: string): { start: string; end: string } {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number]
  const todayDate = new Date(Date.UTC(y, m - 1, d))
  const dow = todayDate.getUTCDay()
  const mondayOffset = dow === 0 ? 6 : dow - 1
  const monday = new Date(todayDate.getTime() - mondayOffset * 86_400_000)
  const sunday = new Date(monday.getTime() + 6 * 86_400_000)

  const fmt = (dt: Date) =>
    `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`

  return { start: fmt(monday), end: fmt(sunday) }
}

function getDayProgress(): number {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  return Math.round(((hours * 60 + minutes) / 1440) * 100)
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface CalendarGridProps {
  month: string // YYYY-MM
  today: string // YYYY-MM-DD
  items: CalendarItem[]
  cadenceSlots: CadenceSlot[]
}

export function CalendarGrid({
  month,
  today,
  items,
  cadenceSlots,
}: CalendarGridProps) {
  const days = getMonthGridDays(month)
  const thisWeek = getThisWeekRange(today)
  const todayProgress = getDayProgress()

  // Build lookup maps
  const itemsByDate = new Map<string, CalendarItem[]>()
  for (const item of items) {
    if (!itemsByDate.has(item.dateKey)) itemsByDate.set(item.dateKey, [])
    itemsByDate.get(item.dateKey)!.push(item)
  }

  const cadenceByDate = new Map<string, CadenceSlot[]>()
  for (const slot of cadenceSlots) {
    if (!cadenceByDate.has(slot.dateKey)) cadenceByDate.set(slot.dateKey, [])
    cadenceByDate.get(slot.dateKey)!.push(slot)
  }

  // Determine current month bounds
  const [y, m] = month.split('-').map(Number) as [number, number]
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  return (
    <div data-testid="calendar-grid">
      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7 gap-px">
        {WEEKDAY_HEADERS.map((label) => (
          <div
            key={label}
            className="py-1.5 text-center text-[11px] font-medium uppercase tracking-wider text-slate-600"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px rounded-lg border border-slate-700/50 bg-slate-700/50 overflow-hidden">
        {days.map((dateKey, i) => {
          const dayNum = parseInt(dateKey.split('-')[2]!, 10)
          const colIndex = i % 7
          const isCurrentMonth = dateKey >= monthStart && dateKey <= monthEnd
          const isToday = dateKey === today
          const isPast = dateKey < today
          const isThisWeek = dateKey >= thisWeek.start && dateKey <= thisWeek.end

          return (
            <CalendarCell
              key={dateKey}
              dateKey={dateKey}
              dayNumber={dayNum}
              isToday={isToday}
              isPast={isPast}
              isThisWeek={isThisWeek}
              isCurrentMonth={isCurrentMonth}
              items={itemsByDate.get(dateKey) ?? []}
              cadenceSlots={cadenceByDate.get(dateKey) ?? []}
              colIndex={colIndex}
              todayProgress={isToday ? todayProgress : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}
