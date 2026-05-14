import { getSupabaseServiceClient } from '@/lib/supabase/service'

export interface QueueSlot {
  date: string
  hour: number
  scheduledAt: string
  label: string
}

const SLOT_HOURS = [9, 11, 13, 15, 17, 19, 21]
const MAX_DAYS_AHEAD = 7

export async function getNextQueueSlot(
  siteId: string,
  timezone: string,
): Promise<QueueSlot | null> {
  const supabase = getSupabaseServiceClient()
  const now = new Date()

  const windowStart = now.toISOString()
  const windowEnd = new Date(
    now.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000,
  ).toISOString()

  const { data: scheduledPosts } = await supabase
    .from('social_posts')
    .select('scheduled_at')
    .eq('site_id', siteId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', windowStart)
    .lte('scheduled_at', windowEnd)

  const occupiedSet = new Set<string>()
  for (const post of scheduledPosts ?? []) {
    if (post.scheduled_at) {
      const d = new Date(post.scheduled_at as string)
      d.setMinutes(0, 0, 0)
      occupiedSet.add(d.toISOString())
    }
  }

  for (let dayOffset = 0; dayOffset < MAX_DAYS_AHEAD; dayOffset++) {
    const candidateDate = new Date(now)
    candidateDate.setDate(candidateDate.getDate() + dayOffset)

    const dateStr = formatDateInTz(candidateDate, timezone)

    for (const hour of SLOT_HOURS) {
      const candidateUtc = buildUtcFromLocalHour(
        candidateDate,
        hour,
        timezone,
      )

      if (candidateUtc.getTime() <= now.getTime()) continue

      const rounded = new Date(candidateUtc)
      rounded.setMinutes(0, 0, 0)
      if (occupiedSet.has(rounded.toISOString())) continue

      const label = formatSlotLabel(candidateUtc, hour, timezone)

      return {
        date: dateStr,
        hour,
        scheduledAt: candidateUtc.toISOString(),
        label,
      }
    }
  }

  return null
}

function formatDateInTz(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
    return parts
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

function buildUtcFromLocalHour(
  baseDate: Date,
  localHour: number,
  timezone: string,
): Date {
  const dateStr = formatDateInTz(baseDate, timezone)
  const hourStr = String(localHour).padStart(2, '0')
  const localIso = `${dateStr}T${hourStr}:00:00`

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      timeZoneName: 'shortOffset',
    })

    const target = new Date(`${dateStr}T12:00:00Z`)
    const parts = formatter.formatToParts(target)
    const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''

    const match = offsetPart.match(/([+-])(\d+)(?::(\d+))?/)
    if (match) {
      const sign = match[1] === '+' ? 1 : -1
      const hours = parseInt(match[2]!, 10)
      const minutes = parseInt(match[3] ?? '0', 10)
      const offsetMs = sign * (hours * 60 + minutes) * 60 * 1000

      const localMs = new Date(localIso + 'Z').getTime()
      return new Date(localMs - offsetMs)
    }
  } catch {
    // Fallback
  }

  // Fallback: assume UTC-3 (BRT)
  return new Date(
    new Date(localIso + 'Z').getTime() + 3 * 60 * 60 * 1000,
  )
}

function formatSlotLabel(
  utcDate: Date,
  localHour: number,
  timezone: string,
): string {
  try {
    const dayLabel = new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(utcDate)

    const tzAbbr = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    })
      .formatToParts(utcDate)
      .find((p) => p.type === 'timeZoneName')?.value ?? timezone

    return `${dayLabel}, ${String(localHour).padStart(2, '0')}:00 ${tzAbbr}`
  } catch {
    return `${utcDate.toISOString().slice(0, 10)}, ${localHour}:00`
  }
}
