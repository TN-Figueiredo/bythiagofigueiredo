import { listCalendarEvents, type CalendarEvent } from '@/lib/social/actions'
import { CalendarWeekView } from './calendar-week-view'

function getWeekRange(weekStr?: string): { from: string; to: string; weekLabel: string } {
  let monday: Date
  if (weekStr && /^\d{4}-W\d{2}$/.test(weekStr)) {
    const [year, week] = weekStr.split('-W').map(Number)
    const jan4 = new Date(year, 0, 4)
    const dayOfWeek = jan4.getDay() || 7
    monday = new Date(jan4)
    monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7)
  } else {
    const now = new Date()
    const dayOfWeek = now.getDay() || 7
    monday = new Date(now)
    monday.setDate(now.getDate() - dayOfWeek + 1)
  }
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const weekNum = getISOWeek(monday)
  const weekLabel = `${monday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`

  return {
    from: monday.toISOString(),
    to: sunday.toISOString(),
    weekLabel,
  }
}

function getISOWeek(date: Date): number {
  const d = new Date(date.getTime())
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const yearStart = new Date(d.getFullYear(), 0, 4)
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getPrevWeek(weekLabel: string): string {
  const [year, week] = weekLabel.split('-W').map(Number)
  if (week <= 1) return `${year - 1}-W52`
  return `${year}-W${String(week - 1).padStart(2, '0')}`
}

function getNextWeek(weekLabel: string): string {
  const [year, week] = weekLabel.split('-W').map(Number)
  if (week >= 52) return `${year + 1}-W01`
  return `${year}-W${String(week + 1).padStart(2, '0')}`
}

export async function CalendarViewLoader({ siteId, week }: { siteId: string; week?: string }) {
  const { from, to, weekLabel } = getWeekRange(week)
  const result = await listCalendarEvents(siteId, from, to)

  const events = result.ok ? result.data : []
  const prevWeek = getPrevWeek(weekLabel)
  const nextWeek = getNextWeek(weekLabel)

  // Group events by day of week (0=Mon, 6=Sun)
  const monday = new Date(from)
  const days: Array<{ date: Date; dateStr: string; events: CalendarEvent[] }> = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
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
        isToday: d.dateStr === new Date().toISOString().split('T')[0],
        events: d.events.map(e => ({
          postId: e.postId,
          title: e.title,
          time: e.scheduledAt ? new Date(e.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
          tint: e.tint,
          status: e.status,
        })),
      }))}
      weekLabel={weekLabel}
      prevWeek={prevWeek}
      nextWeek={nextWeek}
    />
  )
}
