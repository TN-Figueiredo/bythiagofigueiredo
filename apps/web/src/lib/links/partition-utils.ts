export interface MonthRange {
  year: number
  month: number
  startDate: string
  endDate: string
}

export function getNextMonthRange(now: Date = new Date()): MonthRange {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1

  let nextYear = year
  let nextMonth = month + 1
  if (nextMonth > 12) {
    nextMonth = 1
    nextYear = year + 1
  }

  let endYear = nextYear
  let endMonth = nextMonth + 1
  if (endMonth > 12) {
    endMonth = 1
    endYear = nextYear + 1
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  return {
    year: nextYear,
    month: nextMonth,
    startDate: `${nextYear}-${pad(nextMonth)}-01`,
    endDate: `${endYear}-${pad(endMonth)}-01`,
  }
}
