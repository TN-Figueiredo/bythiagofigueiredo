export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type CadencePattern =
  | { type: 'daily' }
  | { type: 'daily_weekdays' }
  | { type: 'weekly'; days: Weekday[] }
  | { type: 'biweekly'; day: Weekday }
  | { type: 'every_n_days'; interval: number }
  | { type: 'monthly_day'; day: number }
  | { type: 'monthly_last_day' }
  | { type: 'monthly_weekday'; week: 1 | 2 | 3 | 4; day: Weekday }
  | { type: 'monthly_last_weekday'; day: Weekday }
  | { type: 'quarterly_day'; day: number; months: [number, number, number, number] }

export interface CadenceSlotOpts {
  from: string
  maxSlots: number
  pausedRanges?: Array<{ from: string; to: string }>
}
