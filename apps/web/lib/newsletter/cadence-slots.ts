import type { CadencePattern, CadenceSlotOpts, Weekday } from './cadence-pattern'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const WEEKDAY_MAP: Record<Weekday, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

const WEEKDAY_LABELS_EN: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

const WEEKDAY_LABELS_PT: Record<Weekday, string> = {
  mon: 'Seg',
  tue: 'Ter',
  wed: 'Qua',
  thu: 'Qui',
  fri: 'Sex',
  sat: 'Sáb',
  sun: 'Dom',
}

const WEEKDAY_FULL_EN: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

const WEEKDAY_FULL_PT: Record<Weekday, string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
  sun: 'Domingo',
}

const ORDINAL_EN: Record<1 | 2 | 3 | 4, string> = {
  1: '1st',
  2: '2nd',
  3: '3rd',
  4: '4th',
}

const ORDINAL_PT: Record<1 | 2 | 3 | 4, string> = {
  1: '1ª',
  2: '2ª',
  3: '3ª',
  4: '4ª',
}

const MONTH_LABELS_EN: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr',
  5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Aug',
  9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
}

const MONTH_LABELS_PT: Record<number, string> = {
  1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr',
  5: 'Mai', 6: 'Jun', 7: 'Jul', 8: 'Ago',
  9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
}

/** Parse an ISO date string to a UTC-midnight Date. */
function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d))
}

/** Format a Date to ISO date string YYYY-MM-DD (UTC). */
function formatDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Add N days to a Date (returns a new Date). */
function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 86_400_000)
}

/** Days in a given month (1-based). Leap-year aware. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Return a Date for "day D of given year/month", clamped to month bounds. */
function clampedDayOfMonth(year: number, month: number, day: number): Date {
  const max = daysInMonth(year, month)
  return new Date(Date.UTC(year, month - 1, Math.min(day, max)))
}

/** Return the last day of year/month. */
function lastDayOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, daysInMonth(year, month)))
}

/**
 * Return the Nth occurrence (1-4) of a weekday in year/month.
 * Returns null if that occurrence doesn't exist.
 */
function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: Weekday,
  n: 1 | 2 | 3 | 4,
): Date | null {
  const target = WEEKDAY_MAP[weekday]
  const first = new Date(Date.UTC(year, month - 1, 1))
  const firstDow = first.getUTCDay()
  const diff = (target - firstDow + 7) % 7
  const day = 1 + diff + (n - 1) * 7
  if (day > daysInMonth(year, month)) return null
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * Return the last occurrence of a weekday in year/month.
 */
function lastWeekdayOfMonth(year: number, month: number, weekday: Weekday): Date {
  const target = WEEKDAY_MAP[weekday]
  const last = lastDayOfMonth(year, month)
  const lastDow = last.getUTCDay()
  const diff = (lastDow - target + 7) % 7
  return new Date(last.getTime() - diff * 86_400_000)
}

/** Check if a date string is within a paused range [from, to] inclusive. */
function isInPausedRange(
  date: string,
  pausedRanges: Array<{ from: string; to: string }>,
): boolean {
  for (const range of pausedRanges) {
    if (date >= range.from && date <= range.to) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Candidate generators — return an ordered stream of candidate dates
// ---------------------------------------------------------------------------

/**
 * Returns an infinite-ish iterator (up to a safe ceiling) of all candidate
 * slot dates (as ISO strings) starting from `from`, for the given pattern.
 * Caller is responsible for filtering paused ranges and capping at maxSlots.
 */
function* candidateDates(pattern: CadencePattern, from: Date): Generator<string> {
  const MAX_ITERATIONS = 10_000 // safety ceiling

  switch (pattern.type) {
    case 'daily': {
      let cur = from
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        yield formatDate(cur)
        cur = addDays(cur, 1)
      }
      break
    }

    case 'daily_weekdays': {
      let cur = from
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const dow = cur.getUTCDay() // 0=Sun, 6=Sat
        if (dow !== 0 && dow !== 6) yield formatDate(cur)
        cur = addDays(cur, 1)
      }
      break
    }

    case 'weekly': {
      if (pattern.days.length === 0) return
      const targetDays = new Set(pattern.days.map((d) => WEEKDAY_MAP[d]))
      let cur = from
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        if (targetDays.has(cur.getUTCDay())) yield formatDate(cur)
        cur = addDays(cur, 1)
      }
      break
    }

    case 'biweekly': {
      const targetDow = WEEKDAY_MAP[pattern.day]
      // Use a fixed epoch (2000-01-01) to determine the global biweekly rhythm.
      // The epoch anchor is the first occurrence of targetDow on or after 2000-01-01.
      const EPOCH = new Date(Date.UTC(2000, 0, 1))
      let epochAnchor = EPOCH
      while (epochAnchor.getUTCDay() !== targetDow) {
        epochAnchor = addDays(epochAnchor, 1)
      }
      // Compute how many days from epochAnchor to `from`
      const daysFromEpoch = Math.round((from.getTime() - epochAnchor.getTime()) / 86_400_000)
      // Find the first biweekly slot on or after `from`
      const remainder = ((daysFromEpoch % 14) + 14) % 14
      let cur = remainder === 0 ? from : addDays(from, 14 - remainder)
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        yield formatDate(cur)
        cur = addDays(cur, 14)
      }
      break
    }

    case 'every_n_days': {
      let cur = from
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        yield formatDate(cur)
        cur = addDays(cur, pattern.interval)
      }
      break
    }

    case 'monthly_day': {
      // Start at the month of `from`; if the clamped day < from, advance to next month
      let year = from.getUTCFullYear()
      let month = from.getUTCMonth() + 1
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const d = clampedDayOfMonth(year, month, pattern.day)
        if (d >= from) yield formatDate(d)
        month++
        if (month > 12) { month = 1; year++ }
      }
      break
    }

    case 'monthly_last_day': {
      let year = from.getUTCFullYear()
      let month = from.getUTCMonth() + 1
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const d = lastDayOfMonth(year, month)
        if (d >= from) yield formatDate(d)
        month++
        if (month > 12) { month = 1; year++ }
      }
      break
    }

    case 'monthly_weekday': {
      let year = from.getUTCFullYear()
      let month = from.getUTCMonth() + 1
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const d = nthWeekdayOfMonth(year, month, pattern.day, pattern.week)
        if (d !== null && d >= from) yield formatDate(d)
        month++
        if (month > 12) { month = 1; year++ }
      }
      break
    }

    case 'monthly_last_weekday': {
      let year = from.getUTCFullYear()
      let month = from.getUTCMonth() + 1
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const d = lastWeekdayOfMonth(year, month, pattern.day)
        if (d >= from) yield formatDate(d)
        month++
        if (month > 12) { month = 1; year++ }
      }
      break
    }

    case 'quarterly_day': {
      const quarterMonths = new Set(pattern.months)
      let year = from.getUTCFullYear()
      // iterate months, only emit for target months
      let month = from.getUTCMonth() + 1
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        if (quarterMonths.has(month)) {
          const d = clampedDayOfMonth(year, month, pattern.day)
          if (d >= from) yield formatDate(d)
        }
        month++
        if (month > 12) { month = 1; year++ }
      }
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate up to `opts.maxSlots` ISO date strings matching `pattern`,
 * starting from (and including) `opts.from`, skipping any paused ranges.
 */
export function generateCadenceSlots(
  pattern: CadencePattern,
  opts: CadenceSlotOpts,
): string[] {
  if (opts.maxSlots <= 0) return []

  const from = parseDate(opts.from)
  const pausedRanges = opts.pausedRanges ?? []
  const results: string[] = []

  for (const date of candidateDates(pattern, from)) {
    if (isInPausedRange(date, pausedRanges)) continue
    results.push(date)
    if (results.length >= opts.maxSlots) break
  }

  return results
}

/**
 * Returns the next slot date strictly after `after`, or null if none found
 * within the generator's safety ceiling.
 */
export function getNextSlot(pattern: CadencePattern, after: string): string | null {
  const nextDay = formatDate(addDays(parseDate(after), 1))
  const slots = generateCadenceSlots(pattern, { from: nextDay, maxSlots: 1 })
  return slots[0] ?? null
}

/**
 * Returns true if `date` would be generated by `pattern` (ignores paused ranges).
 */
export function isSlotDate(pattern: CadencePattern, date: string): boolean {
  const target = parseDate(date)
  // Generate 1 slot starting from that date; if the first result equals date, it matches.
  const slots = generateCadenceSlots(pattern, { from: date, maxSlots: 1 })
  return slots[0] === date
}

/**
 * Human-readable description of a cadence pattern.
 */
export function describePattern(
  pattern: CadencePattern,
  locale: 'en' | 'pt-BR',
): string {
  const isPt = locale === 'pt-BR'
  const wdShort = isPt ? WEEKDAY_LABELS_PT : WEEKDAY_LABELS_EN
  const wdFull = isPt ? WEEKDAY_FULL_PT : WEEKDAY_FULL_EN
  const ord = isPt ? ORDINAL_PT : ORDINAL_EN
  const mon = isPt ? MONTH_LABELS_PT : MONTH_LABELS_EN

  switch (pattern.type) {
    case 'daily':
      return isPt ? 'Todo dia' : 'Every day'

    case 'daily_weekdays':
      return isPt ? 'Dias úteis (Seg-Sex)' : 'Weekdays (Mon-Fri)'

    case 'weekly': {
      const days = pattern.days.map((d) => wdShort[d]).join(', ')
      return isPt ? `Toda ${days}` : `Every ${days}`
    }

    case 'biweekly':
      return isPt
        ? `A cada 2 semanas na ${wdFull[pattern.day]}`
        : `Every 2 weeks on ${wdFull[pattern.day]}`

    case 'every_n_days':
      return isPt
        ? `A cada ${pattern.interval} dias`
        : `Every ${pattern.interval} days`

    case 'monthly_day':
      return isPt
        ? `Mensal no dia ${pattern.day}`
        : `Monthly on day ${pattern.day}`

    case 'monthly_last_day':
      return isPt ? 'Último dia do mês' : 'Last day of month'

    case 'monthly_weekday':
      return isPt
        ? `${ord[pattern.week]} ${wdFull[pattern.day]} do mês`
        : `${ord[pattern.week]} ${wdFull[pattern.day]} of month`

    case 'monthly_last_weekday':
      return isPt
        ? `Última ${wdFull[pattern.day]} do mês`
        : `Last ${wdFull[pattern.day]} of month`

    case 'quarterly_day': {
      const monthNames = pattern.months.map((m) => mon[m]).join(', ')
      return isPt
        ? `Trimestral no dia ${pattern.day} (${monthNames})`
        : `Quarterly on day ${pattern.day} (${monthNames})`
    }
  }
}

/**
 * Convert a wall-clock date + time in a given timezone to a UTC ISO string.
 * E.g. computeScheduledAt('2026-05-10', '09:00', 'America/Sao_Paulo') → UTC ISO
 */
export function computeScheduledAt(slotDate: string, sendTime: string, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const utcMs = Date.UTC(
    parseInt(slotDate.slice(0, 4)),
    parseInt(slotDate.slice(5, 7)) - 1,
    parseInt(slotDate.slice(8, 10)),
    parseInt(sendTime.slice(0, 2)),
    parseInt(sendTime.slice(3, 5)),
  )
  const parts = formatter.formatToParts(new Date(utcMs))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
  const tzYear = parseInt(get('year'))
  const tzMonth = parseInt(get('month')) - 1
  const tzDay = parseInt(get('day'))
  const tzHour = parseInt(get('hour'))
  const tzMin = parseInt(get('minute'))
  const tzRendered = Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMin)
  const offsetMs = tzRendered - utcMs
  return new Date(utcMs - offsetMs).toISOString()
}
