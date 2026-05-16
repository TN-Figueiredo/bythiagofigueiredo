/* ------------------------------------------------------------------ */
/*  Greeting + date label utilities (timezone-aware)                   */
/* ------------------------------------------------------------------ */

export interface GreetingResult {
  text: 'Bom dia' | 'Boa tarde' | 'Boa noite'
  period: 'morning' | 'afternoon' | 'evening'
}

/**
 * Returns a Portuguese greeting based on the current hour in the given
 * timezone.
 *
 * 05:00–11:59 → Bom dia
 * 12:00–17:59 → Boa tarde
 * 18:00–04:59 → Boa noite
 */
export function getGreeting(timezone: string): GreetingResult {
  const hour = getHourInTimezone(timezone)

  if (hour >= 5 && hour < 12) {
    return { text: 'Bom dia', period: 'morning' }
  }
  if (hour >= 12 && hour < 18) {
    return { text: 'Boa tarde', period: 'afternoon' }
  }
  return { text: 'Boa noite', period: 'evening' }
}

/**
 * Formats today's date in a Portuguese label like "sexta-feira, 16 de maio".
 */
export function formatTodayLabel(timezone: string): string {
  const now = new Date()
  return now.toLocaleDateString('pt-BR', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function getHourInTimezone(timezone: string): number {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const hourPart = parts.find((p) => p.type === 'hour')
  return hourPart ? parseInt(hourPart.value, 10) : 0
}
