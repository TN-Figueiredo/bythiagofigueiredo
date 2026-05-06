import type { DailyMetric, AggregatedMetrics, DeviceType, ReferrerCategory } from '../types.js'

/**
 * Aggregate an array of daily metrics into a single AggregatedMetrics summary.
 */
export function aggregateMetrics(daily: DailyMetric[]): AggregatedMetrics {
  const byCountry: Record<string, number> = {}
  const byReferrer: Record<string, number> = {} as Record<ReferrerCategory, number>
  const byDevice: Record<string, number> = {} as Record<DeviceType, number>
  const byBrowser: Record<string, number> = {}
  const byOs: Record<string, number> = {}

  let totalClicks = 0
  let uniqueVisitors = 0
  let totalBots = 0

  for (const d of daily) {
    totalClicks += d.clicks
    uniqueVisitors += d.uniqueVisitors
    totalBots += d.bots

    if (d.topCountry) {
      byCountry[d.topCountry] = (byCountry[d.topCountry] ?? 0) + d.clicks
    }
    if (d.topReferrer) {
      byReferrer[d.topReferrer] = (byReferrer[d.topReferrer] ?? 0) + d.clicks
    }
    if (d.topDevice) {
      byDevice[d.topDevice] = (byDevice[d.topDevice] ?? 0) + d.clicks
    }
  }

  return {
    totalClicks,
    uniqueVisitors,
    totalBots,
    byCountry,
    byReferrer: byReferrer as Record<ReferrerCategory, number>,
    byDevice: byDevice as Record<DeviceType, number>,
    byBrowser,
    byOs,
    dailyBreakdown: daily,
  }
}

/**
 * Merge daily metrics that share the same date into a single row per date.
 */
export function groupByDate(daily: DailyMetric[]): DailyMetric[] {
  const map = new Map<string, DailyMetric>()

  for (const d of daily) {
    const existing = map.get(d.date)
    if (existing) {
      existing.clicks += d.clicks
      existing.uniqueVisitors += d.uniqueVisitors
      existing.bots += d.bots
      // Keep the top values from the highest-click entry
    } else {
      map.set(d.date, { ...d })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}
