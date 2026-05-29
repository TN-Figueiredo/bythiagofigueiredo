// @tn-figueiredo/links/analytics — analytics subpath entry point

export { aggregateMetrics, groupByDate } from './analytics/aggregator.js'
export { buildHeatmap } from './analytics/time-heatmap.js'
export { predictClicks } from './analytics/prediction.js'
export { comparePeriods } from './analytics/comparator.js'
export { aggregateByUtm } from './analytics/utm-attribution.js'
export type { UtmClickRow, UtmGroup } from './analytics/utm-attribution.js'

export { recalcWithoutBots, type ClickRow, type FilteredMetrics } from './analytics/bot-filter-metrics.js'
export { computeNewVsReturning, type VisitorRow, type NewVsReturningResult } from './analytics/new-vs-returning.js'

export { computeConversion, matchGoal, type Goal, type GoalResult, type ConversionResult } from './analytics/goals.js'
export { computeQrFunnel, type QrFunnelInput, type FunnelStep, type QrFunnelResult } from './analytics/qr-funnel.js'
export { generateCsv, type CsvRow } from './analytics/csv-export.js'

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
