import type { DailyMetric, AggregatedMetrics, DeviceType, ReferrerCategory } from '../types.js'

/** Input for upserting a daily metric */
export interface UpsertDailyInput {
  linkId: string
  date: string // YYYY-MM-DD
  clicks?: number
  uniqueVisitors?: number
  bots?: number
  country?: string | null
  referrerCategory?: ReferrerCategory | null
  deviceType?: DeviceType | null
}

/**
 * Repository contract for daily/aggregated metrics.
 */
export interface IMetricsRepository {
  upsertDaily(input: UpsertDailyInput): Promise<DailyMetric>
  getRange(linkId: string, from: string, to: string): Promise<DailyMetric[]>
  getAggregated(linkId: string, from: string, to: string): Promise<AggregatedMetrics>
}
