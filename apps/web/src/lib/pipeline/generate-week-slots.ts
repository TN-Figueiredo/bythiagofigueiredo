import { parseISO, addDays, formatISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { toZonedTime, formatInTimeZone } from 'date-fns-tz'
import { STAGE_ORDER, DAY_INDEX, DAY_LABELS, EFFORT_DEFAULTS } from './up-next-constants'
import type { Stage } from './up-next-constants'
import type {
  WeekSlot,
  SyncScheduleWithChannel,
  BlogCadenceRow,
  NewsletterEditionRow,
  PipelineItemWithSlot,
} from './up-next-types'

export interface GenerateWeekSlotsInput {
  syncSchedules: SyncScheduleWithChannel[]
  blogCadence: BlogCadenceRow | null
  newsletterEditions: NewsletterEditionRow[]
  weekStart: string
  siteTimezone: string
  today: string
}

function dayDate(weekStartDate: Date, targetDayIndex: number): Date {
  const startDayIndex = weekStartDate.getDay()
  const offset = (targetDayIndex - startDayIndex + 7) % 7
  return addDays(weekStartDate, offset)
}

function toDateString(d: Date): string {
  return formatISO(d, { representation: 'date' })
}

function dayLabelForDate(d: Date): string {
  return DAY_LABELS[d.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6]
}

function isRestDayIndex(dayIndex: number): boolean {
  return dayIndex === 6 || dayIndex === 0
}

function getEffortMinutes(format: string, stage: Stage): number {
  if (STAGE_ORDER[stage] >= STAGE_ORDER['scheduled']) return 0
  return EFFORT_DEFAULTS[`${format}:${stage}`]?.minutes ?? 30
}

export function generateWeekSlots(input: GenerateWeekSlotsInput): WeekSlot[] {
  const {
    syncSchedules,
    blogCadence,
    newsletterEditions,
    weekStart,
    siteTimezone,
    today,
  } = input

  const weekStartDate = parseISO(weekStart)
  const weekEndDate = addDays(weekStartDate, 6)
  const todayDate = parseISO(today)

  const slots: WeekSlot[] = []

  // Track which day indices have explicit sync schedules (overrides rest day)
  const scheduledDayIndices = new Set<number>(
    syncSchedules.map(s => DAY_INDEX[s.schedule.day.toLowerCase()] ?? -1),
  )

  // 1. Video slots from sync schedules
  for (const sync of syncSchedules) {
    const dayIndex = DAY_INDEX[sync.schedule.day.toLowerCase()]
    if (dayIndex === undefined) continue

    const slotDate = dayDate(weekStartDate, dayIndex)
    const slotDateStr = toDateString(slotDate)

    slots.push({
      day: slotDateStr,
      dayLabel: dayLabelForDate(slotDate),
      hour: `${String(sync.schedule.hour).padStart(2, '0')}:00`,
      format: 'video',
      channelLocale: sync.locale,
      channelId: sync.channel_id,
      isRestDay: false,
      assignedItem: null,
      effortMinutes: 0,
    })
  }

  // 2. Blog slots from cadence (supports multi-week and short cadences)
  if (
    blogCadence !== null &&
    !blogCadence.cadence_paused &&
    blogCadence.cadence_days !== null &&
    blogCadence.cadence_days > 0 &&
    blogCadence.cadence_start_date !== null
  ) {
    const cadenceDays = blogCadence.cadence_days

    let nextPub: Date
    if (blogCadence.last_published_at !== null) {
      nextPub = addDays(parseISO(blogCadence.last_published_at), cadenceDays)
    } else {
      nextPub = parseISO(blogCadence.cadence_start_date)
    }

    // Fast-forward past today (but not past weekEnd — we check inside the loop)
    while (nextPub < todayDate) {
      nextPub = addDays(nextPub, cadenceDays)
    }

    // Emit all cadence dates that fall within [weekStart, weekEnd]
    while (nextPub <= endOfDay(weekEndDate)) {
      const inWeek = isWithinInterval(nextPub, {
        start: startOfDay(weekStartDate),
        end: endOfDay(weekEndDate),
      })

      if (inWeek) {
        const slotDateStr = toDateString(nextPub)
        const dayIndex = nextPub.getDay()

        slots.push({
          day: slotDateStr,
          dayLabel: dayLabelForDate(nextPub),
          hour: null,
          format: 'blog_post',
          channelLocale: null,
          channelId: null,
          isRestDay: isRestDayIndex(dayIndex) && !scheduledDayIndices.has(dayIndex),
          assignedItem: null,
          effortMinutes: 0,
        })
      }

      nextPub = addDays(nextPub, cadenceDays)
    }
  }

  // 3. Newsletter slots from editions scheduled within the week
  const validNlStatuses = new Set(['draft', 'ready', 'scheduled'])

  for (const edition of newsletterEditions) {
    if (!edition.scheduled_at) continue
    if (!validNlStatuses.has(edition.status)) continue

    const scheduledDate = toZonedTime(parseISO(edition.scheduled_at), siteTimezone)
    const inWeek = isWithinInterval(scheduledDate, {
      start: startOfDay(weekStartDate),
      end: endOfDay(weekEndDate),
    })
    if (!inWeek) continue

    const slotDateStr = toDateString(scheduledDate)
    const dayIndex = scheduledDate.getDay()

    slots.push({
      day: slotDateStr,
      dayLabel: dayLabelForDate(scheduledDate),
      hour: null,
      format: 'newsletter',
      channelLocale: null,
      channelId: null,
      isRestDay: isRestDayIndex(dayIndex) && !scheduledDayIndices.has(dayIndex),
      assignedItem: null,
      effortMinutes: 0,
    })
  }

  // 4. Rest day sentinel slots for Saturday and Sunday if no schedules on those days
  const SAT_INDEX = 6
  const SUN_INDEX = 0

  // Pre-compute set of day-of-week indices already present in slots
  // to avoid calling parseISO(s.day) inside the loop
  const slotDayIndices = new Set(slots.map(s => parseISO(s.day).getDay()))

  for (const dayIndex of [SAT_INDEX, SUN_INDEX]) {
    if (scheduledDayIndices.has(dayIndex)) continue
    if (slotDayIndices.has(dayIndex)) continue

    const restDate = dayDate(weekStartDate, dayIndex)
    slots.push({
      day: toDateString(restDate),
      dayLabel: dayLabelForDate(restDate),
      hour: null,
      format: 'video',
      channelLocale: null,
      channelId: null,
      isRestDay: true,
      assignedItem: null,
      effortMinutes: 0,
    })
  }

  // 5. Sort by day ASC then hour ASC
  slots.sort((a, b) => {
    const dayDiff = a.day.localeCompare(b.day)
    if (dayDiff !== 0) return dayDiff
    const aHour = a.hour ?? ''
    const bHour = b.hour ?? ''
    return aHour.localeCompare(bHour)
  })

  return slots
}

export function hydrateWeekSlots(
  slots: WeekSlot[],
  pipelineItems: PipelineItemWithSlot[],
  siteTimezone: string,
): WeekSlot[] {
  // Pre-index pipeline items into a Map keyed by "day|format" for O(n+m) lookup
  // Use timezone-aware date extraction so UTC timestamps map to the correct local date
  const itemsByDayFormat = new Map<string, PipelineItemWithSlot[]>()

  for (const item of pipelineItems) {
    if (!item.scheduled_at || typeof item.scheduled_at !== 'string' || item.scheduled_at.length < 10) continue
    const localDate = formatInTimeZone(new Date(item.scheduled_at), siteTimezone, 'yyyy-MM-dd')
    const key = `${localDate}|${item.format}`
    let bucket = itemsByDayFormat.get(key)
    if (!bucket) {
      bucket = []
      itemsByDayFormat.set(key, bucket)
    }
    bucket.push(item)
  }

  const usedIds = new Set<string>()

  return slots.map(slot => {
    if (slot.assignedItem) return slot
    if (slot.isRestDay) return slot

    const bucket = itemsByDayFormat.get(`${slot.day}|${slot.format}`)
    if (!bucket) return slot

    const match = bucket.find(item => {
      if (usedIds.has(item.id)) return false

      if (slot.hour && item.scheduled_at && item.scheduled_at.length >= 16) {
        const scheduledHour = formatInTimeZone(new Date(item.scheduled_at), siteTimezone, 'HH:mm')
        if (scheduledHour !== slot.hour) return false
      }

      if (slot.channelId && item.youtube_channel_id !== slot.channelId) return false

      return true
    })

    if (!match) return slot
    usedIds.add(match.id)

    return {
      ...slot,
      assignedItem: { id: match.id, title: match.title, stage: match.stage },
      effortMinutes: getEffortMinutes(match.format, match.stage),
    }
  })
}
