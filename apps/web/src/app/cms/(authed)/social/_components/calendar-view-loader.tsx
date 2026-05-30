import { listCalendarEvents, type CalendarEvent } from '@/lib/social/actions'
import { CalendarWeekView } from './calendar-week-view'

function getWeekRange(weekStr?: string): { from: string; to: string; weekLabel: string; startDate: Date } {
  let startDate: Date
  if (weekStr && /^\d{4}-W\d{2}$/.test(weekStr)) {
    const [year, week] = weekStr.split('-W').map(Number)
    const jan4 = new Date(year, 0, 4)
    const dayOfWeek = jan4.getDay() || 7
    startDate = new Date(jan4)
    startDate.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7)
  } else {
    startDate = new Date()
  }
  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)
  endDate.setHours(23, 59, 59, 999)

  const weekNum = getISOWeek(startDate)
  const weekLabel = `${startDate.getFullYear()}-W${String(weekNum).padStart(2, '0')}`

  return {
    from: startDate.toISOString(),
    to: endDate.toISOString(),
    weekLabel,
    startDate,
  }
}

function getISOWeek(date: Date): number {
  const d = new Date(date.getTime())
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const yearStart = new Date(d.getFullYear(), 0, 4)
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getISOWeeksInYear(year: number): number {
  const dec28 = new Date(year, 11, 28)
  return getISOWeek(dec28)
}

function getPrevWeek(weekLabel: string): string {
  const [year, week] = weekLabel.split('-W').map(Number)
  if (week <= 1) {
    const prevYearWeeks = getISOWeeksInYear(year - 1)
    return `${year - 1}-W${String(prevYearWeeks).padStart(2, '0')}`
  }
  return `${year}-W${String(week - 1).padStart(2, '0')}`
}

function getNextWeek(weekLabel: string): string {
  const [year, week] = weekLabel.split('-W').map(Number)
  const maxWeeks = getISOWeeksInYear(year)
  if (week >= maxWeeks) return `${year + 1}-W01`
  return `${year}-W${String(week + 1).padStart(2, '0')}`
}

export async function CalendarViewLoader({ siteId, week }: { siteId: string; week?: string }) {
  const { from, to, weekLabel, startDate } = getWeekRange(week)
  const result = await listCalendarEvents(siteId, from, to)

  if (!result.ok) {
    return (
      <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
        Erro ao carregar eventos do calendário
      </div>
    )
  }

  const events = result.data
  const prevWeek = getPrevWeek(weekLabel)
  const nextWeek = getNextWeek(weekLabel)

  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)

  const dateRange = `${startDate.getDate()} ${startDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')} – ${endDate.getDate()} ${endDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}`

  const days: Array<{ date: Date; dateStr: string; events: CalendarEvent[] }> = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    days.push({
      date: d,
      dateStr,
      events: events.filter(e => e.scheduledAt.startsWith(dateStr)),
    })
  }

  return (
    <CalendarWeekView
      days={days.map(d => ({
        dateStr: d.dateStr,
        dayName: d.date.toLocaleDateString('pt-BR', { weekday: 'short' }),
        dayNum: d.date.getDate(),
        isToday: d.dateStr === new Date().toLocaleDateString('sv'),
        events: d.events.map(e => ({
          postId: e.postId,
          title: e.title,
          time: e.scheduledAt ? new Date(e.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
          tint: e.tint,
          status: e.status,
          provider: e.provider,
        })),
      }))}
      weekLabel={weekLabel}
      prevWeek={prevWeek}
      nextWeek={nextWeek}
      dateRange={dateRange}
    />
  )
}
