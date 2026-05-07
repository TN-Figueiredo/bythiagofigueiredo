export interface FormatSiteDateTimeOpts {
  mode?: 'full' | 'short' | 'time-only'
  includeLocal?: boolean
  includeSeconds?: boolean
}

export interface FormatSiteDateTimeResult {
  primary: string
  local: string
  crossDay: boolean
  tooltip: string
  tzAbbr: string
  localTzAbbr: string
}

export function getTimezoneAbbr(timezone: string, date?: Date): string {
  const d = date ?? new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  }).formatToParts(d)
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? timezone
}

export function todayInSiteTz(siteTimezone: string): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: siteTimezone })
}

function formatTimeParts(
  date: Date,
  timezone: string,
  includeSeconds: boolean,
): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }
  if (includeSeconds) opts.second = '2-digit'
  return date.toLocaleTimeString('en-GB', opts)
}

function formatDateShort(date: Date, timezone: string): string {
  return date.toLocaleDateString('en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
  })
}

function formatDateFull(date: Date, timezone: string): string {
  return date.toLocaleDateString('en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatIsoInTz(date: Date, timezone: string): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
  const y = get('year')
  const mo = get('month')
  const d = get('day')
  const h = get('hour')
  const mi = get('minute')
  const s = get('second')

  const utcMs = date.getTime()
  const wallMs = Date.UTC(
    parseInt(y),
    parseInt(mo) - 1,
    parseInt(d),
    parseInt(h),
    parseInt(mi),
    parseInt(s),
  )
  const offsetMs = wallMs - utcMs
  const offsetMin = Math.round(offsetMs / 60_000)
  const sign = offsetMin >= 0 ? '+' : '-'
  const absMin = Math.abs(offsetMin)
  const offsetH = pad(Math.floor(absMin / 60))
  const offsetM = pad(absMin % 60)

  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${offsetH}:${offsetM}`
}

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

export function formatSiteDateTime(
  date: Date | string,
  siteTimezone: string,
  opts?: FormatSiteDateTimeOpts,
): FormatSiteDateTimeResult {
  const d = typeof date === 'string' ? new Date(date) : date
  const mode = opts?.mode ?? 'full'
  const includeLocal = opts?.includeLocal ?? true
  const includeSeconds = opts?.includeSeconds ?? false

  const localTimezone = getBrowserTimezone()
  const tzAbbr = getTimezoneAbbr(siteTimezone, d)
  const localTzAbbr = getTimezoneAbbr(localTimezone, d)

  const siteDate = toDateStringInTz(d, siteTimezone)
  const localDate = toDateStringInTz(d, localTimezone)
  const crossDay = includeLocal && siteDate !== localDate

  const siteTime = formatTimeParts(d, siteTimezone, includeSeconds)
  const localTime = formatTimeParts(d, localTimezone, includeSeconds)

  let primary: string
  let local: string

  switch (mode) {
    case 'time-only':
      primary = siteTime
      local = includeLocal ? localTime : ''
      break
    case 'short':
      primary = `${formatDateShort(d, siteTimezone)} at ${siteTime}`
      local = includeLocal
        ? `${formatDateShort(d, localTimezone)} at ${localTime}`
        : ''
      break
    case 'full':
    default:
      primary = `${formatDateFull(d, siteTimezone)} at ${siteTime}`
      local = includeLocal
        ? `${formatDateFull(d, localTimezone)} at ${localTime}`
        : ''
      break
  }

  const tooltip = `${formatIsoInTz(d, siteTimezone)} (${siteTimezone})`

  return { primary, local, crossDay, tooltip, tzAbbr, localTzAbbr }
}

export function getTimezoneOffsetHours(
  tz1: string,
  tz2: string,
  date?: Date,
): number {
  const d = date ?? new Date()
  const fmt = (tz: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(d)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
    return Date.UTC(
      parseInt(get('year')),
      parseInt(get('month')) - 1,
      parseInt(get('day')),
      parseInt(get('hour')),
      parseInt(get('minute')),
      parseInt(get('second')),
    )
  }
  return (fmt(tz1) - fmt(tz2)) / 3_600_000
}

export function toDateStringInTz(d: Date, siteTimezone: string): string {
  return d.toLocaleDateString('sv-SE', { timeZone: siteTimezone })
}

export function tomorrowInSiteTz(siteTimezone: string): string {
  const now = new Date()
  const todayStr = todayInSiteTz(siteTimezone)
  const todayMs = new Date(`${todayStr}T12:00:00Z`).getTime()
  const tomorrowMs = todayMs + 86_400_000
  return new Date(tomorrowMs).toLocaleDateString('sv-SE', { timeZone: 'UTC' })
}

export function toISOInTimezone(dateStr: string, timeStr: string, tz: string): string | null {
  if (!dateStr || !timeStr) return null
  const naive = new Date(`${dateStr}T${timeStr}:00Z`)
  if (isNaN(naive.getTime())) return null
  if (tz === 'UTC') return naive.toISOString()
  const utcStr = naive.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr = naive.toLocaleString('en-US', { timeZone: tz })
  const offset = new Date(utcStr).getTime() - new Date(tzStr).getTime()
  return new Date(naive.getTime() + offset).toISOString()
}

export function formatSchedulePreview(
  date: Date,
  tz: string,
): { dateStr: string; timeStr: string; tzAbbr: string; dateKey: string } {
  const dateStr = date.toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
  const tzAbbr = getTimezoneAbbr(tz, date)
  const dateKey = toDateStringInTz(date, tz)
  return { dateStr, timeStr, tzAbbr, dateKey }
}
