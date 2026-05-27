import { addDays, formatISO, parseISO } from 'date-fns'
import { generateWeekSlots, hydrateWeekSlots } from './generate-week-slots'
import type {
  SyncScheduleWithChannel,
  BlogCadenceRow,
  NewsletterEditionRow,
  PipelineItemWithSlot,
  WeekSlot,
} from './up-next-types'

export interface BufferDepthInput {
  syncSchedules: SyncScheduleWithChannel[]
  blogCadence: BlogCadenceRow | null
  newsletterEditions: NewsletterEditionRow[]
  pipelineItems: PipelineItemWithSlot[]
  today: string
  siteTimezone: string
  weeksToScan: number
}

export interface FormatCoverage {
  totalSlots: number
  filledSlots: number
  coveragePercent: number
  health: 'green' | 'yellow' | 'red'
  firstEmptyDate: string | null
}

export interface BufferDepthResult {
  formats: Record<string, FormatCoverage>
  overallHealth: 'green' | 'yellow' | 'red'
}

function computeHealth(coveragePercent: number): 'green' | 'yellow' | 'red' {
  if (coveragePercent >= 75) return 'green'
  if (coveragePercent >= 40) return 'yellow'
  return 'red'
}

export function scanBufferDepth(input: BufferDepthInput): BufferDepthResult {
  const {
    syncSchedules,
    blogCadence,
    newsletterEditions,
    pipelineItems,
    today,
    siteTimezone,
    weeksToScan,
  } = input

  const todayDate = parseISO(today)
  const allSlots: WeekSlot[] = []

  for (let w = 0; w < weeksToScan; w++) {
    const weekStart = formatISO(addDays(todayDate, w * 7), { representation: 'date' })

    const emptySlots = generateWeekSlots({
      syncSchedules,
      blogCadence,
      newsletterEditions,
      weekStart,
      siteTimezone,
      today,
    })

    const hydratedSlots = hydrateWeekSlots(emptySlots, pipelineItems, siteTimezone)
    allSlots.push(...hydratedSlots)
  }

  const formatMap = new Map<string, { total: number; filled: number; firstEmpty: string | null }>()

  for (const slot of allSlots) {
    if (slot.isRestDay) continue

    const key = slot.format
    let entry = formatMap.get(key)
    if (!entry) {
      entry = { total: 0, filled: 0, firstEmpty: null }
      formatMap.set(key, entry)
    }

    entry.total++
    if (slot.assignedItem !== null) {
      entry.filled++
    } else if (entry.firstEmpty === null) {
      entry.firstEmpty = slot.day
    }
  }

  const formats: Record<string, FormatCoverage> = {}
  let totalAll = 0
  let filledAll = 0

  for (const [format, counts] of formatMap) {
    const coveragePercent = counts.total > 0
      ? Math.round((counts.filled / counts.total) * 100)
      : 0

    formats[format] = {
      totalSlots: counts.total,
      filledSlots: counts.filled,
      coveragePercent,
      health: computeHealth(coveragePercent),
      firstEmptyDate: counts.firstEmpty,
    }

    totalAll += counts.total
    filledAll += counts.filled
  }

  const overallPercent = totalAll > 0 ? Math.round((filledAll / totalAll) * 100) : 0

  return {
    formats,
    overallHealth: computeHealth(overallPercent),
  }
}
