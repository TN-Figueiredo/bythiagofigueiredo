// @tn-figueiredo/links/analytics — analytics subpath entry point

export { aggregateMetrics, groupByDate } from './analytics/aggregator.js'
export { buildHeatmap } from './analytics/time-heatmap.js'
export { predictClicks } from './analytics/prediction.js'
export { comparePeriods } from './analytics/comparator.js'
export { aggregateByUtm } from './analytics/utm-attribution.js'
export type { UtmClickRow, UtmGroup } from './analytics/utm-attribution.js'

// Re-export analytics-relevant types
export type {
  DailyMetric,
  AggregatedMetrics,
  MetricsDelta,
  HeatmapMatrix,
  HeatmapResult,
  PredictionResult,
  PeriodComparison,
} from './analytics/types.js'
