export interface CadenceConfig {
  cadenceDays: number
  startDate: string // ISO date 'YYYY-MM-DD'
  lastSentAt: string | null // ISO datetime
  paused: boolean
}

interface SlotOptions {
  today: string // ISO date 'YYYY-MM-DD'
  count: number
}

export function generateSlots(config: CadenceConfig, opts: SlotOptions): string[] {
  if (config.paused) return []

  const { cadenceDays, startDate, lastSentAt } = config
  const anchor = lastSentAt ? lastSentAt.slice(0, 10) : startDate
  const todayMs = new Date(opts.today + 'T00:00:00Z').getTime()
  const anchorMs = new Date(anchor + 'T00:00:00Z').getTime()
  const dayMs = 86_400_000

  const slots: string[] = []
  let i = 1
  while (slots.length < opts.count) {
    const slotMs = anchorMs + i * cadenceDays * dayMs
    if (slotMs > todayMs) {
      slots.push(new Date(slotMs).toISOString().slice(0, 10))
    }
    i++
    if (i > 1000) break
  }
  return slots
}
