import type { AggregatedMetrics, MetricsDelta, PeriodComparison } from '../types.js'

/**
 * Compare two metric periods and compute deltas as absolute and percentage values.
 */
export function comparePeriods(
  current: AggregatedMetrics,
  previous: AggregatedMetrics,
): PeriodComparison {
  const delta = computeDelta(current, previous)
  return { current, previous, delta }
}

function computeDelta(current: AggregatedMetrics, previous: AggregatedMetrics): MetricsDelta {
  return {
    clicks: current.totalClicks - previous.totalClicks,
    clicksPercent: percentChange(previous.totalClicks, current.totalClicks),
    uniqueVisitors: current.uniqueVisitors - previous.uniqueVisitors,
    uniqueVisitorsPercent: percentChange(previous.uniqueVisitors, current.uniqueVisitors),
    bots: current.totalBots - previous.totalBots,
    botsPercent: percentChange(previous.totalBots, current.totalBots),
  }
}

function percentChange(previous: number, current: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100
  }
  return ((current - previous) / previous) * 100
}
