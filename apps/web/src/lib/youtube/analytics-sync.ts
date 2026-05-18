export function computeViewDeltas(
  currentViewCount: number,
  previousViewCount: number,
  previousYesterday: number,
): { delta_today: number; yesterday: number } {
  const delta_today = Math.max(0, currentViewCount - previousViewCount)
  return { delta_today, yesterday: previousYesterday }
}

export function detectViral(
  deltaToday: number,
  deltaYesterday: number,
  channelAvg48h: number,
): boolean {
  if (channelAvg48h <= 0) return false
  const views48h = deltaToday + deltaYesterday
  return views48h >= 5 * channelAvg48h
}

export function getIsoWeek(date: Date): string {
  const d = new Date(date.getTime())
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
